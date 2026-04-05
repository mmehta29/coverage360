const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  if (!BACKEND_URL) {
    return Response.json({ drugs: [], payers: [], matrix: {}, error: 'Backend not configured' }, { status: 503 })
  }

  let drugsRes
  try {
    drugsRes = await fetch(`${BACKEND_URL}/drugs`, { cache: 'no-store' })
  } catch {
    return Response.json({ drugs: [], payers: [], matrix: {}, error: 'Backend unreachable' }, { status: 502 })
  }

  if (!drugsRes.ok) {
    return Response.json({ drugs: [], payers: [], matrix: {}, error: 'Unable to load drugs' }, { status: drugsRes.status })
  }

  const drugsData = await drugsRes.json()
  const drugs = (Array.isArray(drugsData) ? drugsData : [])
    .map(drug => drug.brand_name || drug.generic_name)
    .filter(Boolean)
    .slice(0, 8)

  const coverageResults = await Promise.all(
    drugs.map(async drug => {
      try {
        const res = await fetch(`${BACKEND_URL}/search/drug/${encodeURIComponent(drug)}`, { cache: 'no-store' })
        if (!res.ok) return { drug, coverage: [] }
        return { drug, coverage: (await res.json()).coverage ?? [] }
      } catch {
        return { drug, coverage: [] }
      }
    })
  )

  const payerSet = new Set()
  const matrix = {}

  for (const { drug, coverage } of coverageResults) {
    const grouped = {}
    for (const row of coverage) {
      const payer = row.policies?.payers?.name || 'Unknown'
      payerSet.add(payer)
      ;(grouped[payer] ??= []).push(normalizeRule(row))
    }

    matrix[drug] = {}
    for (const [payer, rows] of Object.entries(grouped)) {
      matrix[drug][payer] = {
        status: worstStatus(rows),
        note: buildNote(rows),
      }
    }
  }

  return Response.json({
    drugs,
    payers: Array.from(payerSet),
    matrix,
  })
}

function normalizeRule(rule) {
  return {
    ...rule,
    step_therapy: parseJsonField(rule.step_therapy, []),
    pa_criteria: parseJsonField(rule.pa_criteria, null),
    limitations: Array.isArray(rule.limitations) ? rule.limitations : [],
  }
}

function parseJsonField(value, fallback) {
  if (value == null || value === '') return fallback
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapStatus(status) {
  if (['covered', 'preferred', 'preferred_specialty'].includes(status)) return 'covered'
  if (['non_preferred', 'non_specialty'].includes(status)) return 'restricted'
  if (status === 'not_covered' || status === 'unproven') return 'denied'
  return 'unknown'
}

function worstStatus(rows) {
  const rank = { denied: 3, restricted: 2, covered: 1, unknown: 0 }
  return rows
    .map(row => mapStatus(row.coverage_status))
    .reduce((worst, current) => (rank[current] > rank[worst] ? current : worst), 'unknown')
}

function buildNote(rows) {
  const stepRule = rows.find(row => row.step_therapy?.length)
  if (stepRule) {
    const agents = stepRule.step_therapy
      .flatMap(step => step.required_agents ?? [])
      .filter(Boolean)
    if (agents.length) return `Step therapy: ${agents.slice(0, 2).join(', ')} first.`
    return 'Step therapy required.'
  }

  const paRule = rows.find(row => row.requires_prior_auth)
  if (paRule?.pa_criteria?.criteria?.length) {
    return paRule.pa_criteria.criteria
      .map(item => item.description)
      .filter(Boolean)
      .slice(0, 1)[0] ?? 'Prior authorization required.'
  }

  if (paRule) return 'Prior authorization required.'

  const limitation = rows.flatMap(row => row.limitations || []).find(Boolean)
  if (limitation) return limitation

  return 'See policy for details.'
}
