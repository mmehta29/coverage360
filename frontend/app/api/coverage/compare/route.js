const BACKEND_URL = process.env.BACKEND_URL

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const drug = searchParams.get('drug')
  const payersParam = searchParams.get('payers')

  if (!drug?.trim()) {
    return Response.json({ error: 'drug parameter required' }, { status: 400 })
  }

  if (!BACKEND_URL) {
    // Return empty comparison when no backend configured
    return Response.json({ comparison: {}, payers: [] })
  }

  let url = `${BACKEND_URL}/compare/${encodeURIComponent(drug)}`
  if (payersParam) {
    url += `?payers=${encodeURIComponent(payersParam)}`
  }

  let res
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }

  if (!res.ok) {
    return Response.json({ comparison: {}, payers: [] })
  }

  const data = await res.json()
  return Response.json(adaptComparison(data))
}

function adaptComparison(data) {
  // Backend returns: { drug_name, payer_count, comparison: [{ payer_name, indications: [...] }, ...] }
  // Frontend expects: { comparison: Record<payerName, PayerComparison>, payers: string[] }

  if (!data.comparison || data.comparison.length === 0) {
    return { comparison: {}, payers: [] }
  }

  const comparisonMap = {}
  const payers = []

  for (const payerData of data.comparison) {
    const payerName = payerData.payer_name
    payers.push(payerName)

    // Map indications — keep all fields CompareView and RecommendPage need
    const indications = (payerData.indications || []).map(ind => ({
      indication_name: ind.indication_name,
      coverage_status: ind.coverage_status,
      requires_prior_auth: !!ind.requires_prior_auth,
      site_of_care_restriction: ind.site_of_care_restriction || null,
      limitations: Array.isArray(ind.limitations) ? ind.limitations : [],
      icd10_codes: ind.icd10_codes || [],
    }))

    // Parse step_therapy from first indication
    let stepTherapy = []
    const firstInd = payerData.indications?.[0]
    if (firstInd?.step_therapy) {
      try {
        stepTherapy = typeof firstInd.step_therapy === 'string'
          ? JSON.parse(firstInd.step_therapy)
          : (firstInd.step_therapy || [])
      } catch {
        stepTherapy = []
      }
    }

    // Determine overall coverage status (worst case across indications)
    const statusRank = {
      covered: 0, preferred: 0, preferred_specialty: 0,
      non_preferred: 1, non_specialty: 1,
      unproven: 2, not_covered: 3,
    }
    const worstStatus = (payerData.indications || []).reduce((worst, ind) => {
      const rank = statusRank[ind.coverage_status] ?? 1
      const worstRank = statusRank[worst] ?? 1
      return rank > worstRank ? ind.coverage_status : worst
    }, 'covered')

    // Parse PA criteria from first indication
    let paCriteria = null
    if (firstInd?.pa_criteria) {
      try {
        paCriteria = typeof firstInd.pa_criteria === 'string'
          ? JSON.parse(firstInd.pa_criteria)
          : firstInd.pa_criteria
      } catch {
        paCriteria = null
      }
    }

    comparisonMap[payerName] = {
      payer_name: payerName,
      payer_type: payerData.payer_type || 'commercial',
      drug_brand_name: payerData.drug_brand_name || null,
      drug_generic_name: payerData.drug_generic_name || null,
      coverage_status: worstStatus,
      requires_prior_auth: (payerData.indications || []).some(i => i.requires_prior_auth),
      coverage_tier: null,
      coverage_tier_detail: null,
      indications,
      step_therapy: stepTherapy,
      pa_criteria: paCriteria,
      approval_duration_months: paCriteria?.approval_duration_months || null,
      policy_title: payerData.policy_title || null,
      effective_date: payerData.effective_date || null
    }
  }

  return { comparison: comparisonMap, payers }
}
