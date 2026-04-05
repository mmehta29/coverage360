const BACKEND_URL = process.env.BACKEND_URL

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').trim()
  if (!query) return Response.json({ error: 'Query required' }, { status: 400 })

  if (!BACKEND_URL) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 })
  }

  let res
  try {
    res = await fetch(`${BACKEND_URL}/search/drug/${encodeURIComponent(query)}`, {
      cache: 'no-store',
    })
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }

  if (!res.ok) return Response.json({ error: 'Not found' }, { status: res.status })

  const data = await res.json()
  if (!data.coverage || data.coverage.length === 0) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json(adaptDrugSearch(data))
}

// ─── Shape adapter ────────────────────────────────────────────────────────────

// Backend coverage_status → frontend status (covered | restricted | denied)
function mapStatus(backendStatus) {
  if (['covered', 'preferred', 'preferred_specialty'].includes(backendStatus)) return 'covered'
  if (['non_preferred', 'non_specialty'].includes(backendStatus)) return 'restricted'
  return 'denied' // not_covered, unproven, unknown
}

// Worst status wins when consolidating multiple rules for the same payer
const STATUS_RANK = { denied: 2, restricted: 1, covered: 0 }
function worstStatus(rules) {
  return rules
    .map(r => mapStatus(r.coverage_status))
    .reduce((worst, s) => STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst, 'covered')
}

// "Jan 2026" from "2026-01-15" or null
function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// Parse JSON field safely (handles string or object)
function parseJsonField(field) {
  if (!field) return null
  if (typeof field === 'string') {
    try { return JSON.parse(field) } catch { return null }
  }
  return field
}

// Bold headline (e.g. "Step therapy." or "PA required.")
function buildHeadline(rules) {
  const hasStep = rules.some(r => {
    const st = parseJsonField(r.step_therapy)
    return Array.isArray(st) && st.length > 0
  })
  if (hasStep) return 'Step therapy.'
  const hasPA = rules.some(r => r.requires_prior_auth)
  if (hasPA) return 'PA required.'
  return ''
}

// Plain-text criteria summary built from rule fields
function buildCriteria(rules) {
  const parts = []

  // Step therapy drugs from the first rule that has them
  const stepRule = rules.find(r => {
    const st = parseJsonField(r.step_therapy)
    return Array.isArray(st) && st.length > 0
  })
  if (stepRule) {
    const stepTherapy = parseJsonField(stepRule.step_therapy) || []
    const agents = stepTherapy
      .flatMap(s => s.required_agents ?? [])
      .filter(Boolean)
    if (agents.length) parts.push(`Requires trial of: ${agents.slice(0, 3).join(', ')}.`)
  }

  // PA notes from pa_criteria criteria descriptions
  const paRule = rules.find(r => {
    const pa = parseJsonField(r.pa_criteria)
    return pa?.criteria?.length > 0
  })
  if (paRule) {
    const paCriteria = parseJsonField(paRule.pa_criteria)
    const descs = (paCriteria?.criteria || [])
      .slice(0, 2)
      .map(c => c.description)
      .filter(Boolean)
    parts.push(...descs)
  }

  // General requirements
  const genRule = rules.find(r => r.general_requirements?.length > 0)
  if (genRule && parts.length < 2) {
    parts.push(...genRule.general_requirements.slice(0, 2))
  }

  // Site-of-care
  const socRule = rules.find(r => r.site_of_care_restriction)
  if (socRule) parts.push(`Site of care: ${socRule.site_of_care_restriction}.`)

  if (parts.length === 0) return 'See policy for details.'
  return parts.slice(0, 3).join(' ')
}

// Burden score (0–100): PA + step therapy + denial weighting across payer rows
function computeBurden(payerRows) {
  if (!payerRows.length) return 0
  const score = payerRows.reduce((sum, row) => {
    let pts = 0
    if (row.status === 'denied') pts += 40
    else if (row.status === 'restricted') pts += 20
    if (row._hasPA) pts += 20
    if (row._hasStep) pts += 15
    if (row._hasSoC) pts += 10
    return sum + pts
  }, 0)
  return Math.min(99, Math.round(score / payerRows.length))
}

function adaptDrugSearch(data) {
  // Group rules by payer name
  const byPayer = {}
  for (const rule of data.coverage) {
    const key = rule.policies?.payers?.name ?? 'Unknown'
    ;(byPayer[key] ??= []).push(rule)
  }

  // One row per payer
  const payerRows = Object.entries(byPayer).map(([payerName, rules]) => {
    const representative = rules[0]
    const effectiveDate = representative.policies?.effective_date || null
    return {
      payer: payerName,
      status: worstStatus(rules),
      criteriaHeadline: buildHeadline(rules),
      criteria: buildCriteria(rules),
      effective: formatDate(effectiveDate),
      evidence: rules.map(rule => ({
        payer: payerName,
        policyTitle: rule.policies?.policy_title || 'Policy',
        effectiveDate,
        indication: rule.indication_name || 'All indications',
        coverageStatus: mapStatus(rule.coverage_status),
        requiresPriorAuth: !!rule.requires_prior_auth,
        stepTherapy: summarizeStepTherapy(rule.step_therapy),
      })),
      // private fields used for burden computation only
      _hasPA: rules.some(r => r.requires_prior_auth),
      _hasStep: rules.some(r => {
        const st = parseJsonField(r.step_therapy)
        return Array.isArray(st) && st.length > 0
      }),
      _hasSoC: rules.some(r => r.site_of_care_restriction),
    }
  })

  const burdenScore = computeBurden(payerRows)

  // Strip private fields before returning
  const coverage = payerRows.map(({ _hasPA, _hasStep, _hasSoC, ...row }) => row)

  // Build tags: unique HCPCS codes + biosimilar flag
  const hcpcsCodes = [...new Set(data.coverage.map(r => r.hcpcs_code).filter(Boolean))]
  const genericNames = [...new Set(data.coverage.map(r => r.drug_generic_name).filter(Boolean))]
  const brandNames = [...new Set(data.coverage.map(r => r.drug_brand_name).filter(Boolean))]
  const tags = [...hcpcsCodes.slice(0, 2)]
  // Add biosimilar label if multiple generic names (brand + biosimilars)
  if (genericNames.length > 1) tags.push('Includes biosimilars')

  return {
    name: capitalize(data.drug_name),
    generic: [...brandNames, ...genericNames].slice(0, 4).join(' · ') || data.resolved_name || data.drug_name,
    tags,
    burdenScore,
    coverage,
  }
}

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function summarizeStepTherapy(value) {
  const steps = parseJsonField(value)
  if (!Array.isArray(steps) || steps.length === 0) return null
  const agents = steps.flatMap(step => step.required_agents ?? []).filter(Boolean)
  if (!agents.length) return 'Required'
  return `Try ${agents.slice(0, 3).join(', ')} first`
}
