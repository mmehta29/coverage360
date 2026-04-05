import { lookupDrug } from '@/lib/mockData'

const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/+$/, '')

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

  // Drug exists but no coverage data
  if (data.no_coverage_data && data.drug_info) {
    return Response.json({
      name: capitalize(data.drug_info.brand_name || data.drug_name),
      generic: data.drug_info.generic_name || data.resolved_name || '',
      tags: parseHcpcsCodes(data.drug_info.hcpcs_codes),
      drugClass: data.drug_info.drug_class,
      burdenScore: null,
      coverage: [],
      noCoverageData: true,
    })
  }

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
  // Build detailed rows - one per indication/payer combination
  const coverageRows = data.coverage.map(rule => {
    const stepTherapy = parseJsonField(rule.step_therapy) || []
    const paCriteria = parseJsonField(rule.pa_criteria) || {}
    const limitations = rule.limitations || []
    const generalReqs = rule.general_requirements || []
    const coveredAlts = parseJsonField(rule.covered_alternatives) || []

    // Extract step therapy agents
    const stepAgents = stepTherapy
      .flatMap(s => s.required_agents ?? [])
      .filter(Boolean)

    // Extract PA criteria descriptions
    const paDescriptions = (paCriteria?.criteria || [])
      .map(c => c.description)
      .filter(Boolean)

    // Build conditions summary
    const conditions = []
    if (stepAgents.length) conditions.push(`Must try: ${stepAgents.slice(0, 3).join(', ')}`)
    if (paDescriptions.length) conditions.push(...paDescriptions.slice(0, 2))
    if (generalReqs.length) conditions.push(...generalReqs.slice(0, 2))

    const status = mapStatus(rule.coverage_status)

    return {
      payer: rule.policies?.payers?.name ?? 'Unknown',
      status,
      indication: rule.indication_name || 'General',
      requiresPriorAuth: rule.requires_prior_auth || false,
      priorAuthType: rule.prior_auth_type || null,
      conditions: conditions.slice(0, 3),
      stepTherapy: stepAgents,
      approvalDuration: paCriteria?.approval_duration_days || paCriteria?.approval_duration_months
        ? (paCriteria.approval_duration_months ? `${paCriteria.approval_duration_months} months` : `${paCriteria.approval_duration_days} days`)
        : null,
      siteOfCare: rule.site_of_care_restriction || null,
      limitations: limitations.slice(0, 3),
      coveredAlternatives: coveredAlts.map(a => a.drug_name).filter(Boolean),
      lineOfTherapy: rule.line_of_therapy || null,
      evidenceBasis: rule.evidence_basis || null,
      effective: formatDate(rule.policies?.effective_date),
      policyTitle: rule.policies?.policy_title || null,
      // For burden calculation
      _hasPA: rule.requires_prior_auth,
      _hasStep: stepAgents.length > 0,
      _hasSoC: !!rule.site_of_care_restriction,
    }
  })

  const burdenScore = computeBurden(coverageRows)

  // Strip private fields
  const coverage = coverageRows.map(({ _hasPA, _hasStep, _hasSoC, ...row }) => row)

  // Build tags
  const hcpcsCodes = [...new Set(data.coverage.map(r => r.hcpcs_code).filter(Boolean))]
  const genericNames = [...new Set(data.coverage.map(r => r.drug_generic_name).filter(Boolean))]
  const brandNames = [...new Set(data.coverage.map(r => r.drug_brand_name).filter(Boolean))]
  const tags = [...hcpcsCodes.slice(0, 2)]
  if (genericNames.length > 1) tags.push('Includes biosimilars')

  return {
    name: capitalize(data.drug_name),
    generic: [...brandNames, ...genericNames].slice(0, 4).join(' · ') || data.resolved_name || data.drug_name,
    tags,
    burdenScore,
    coverage,
  }
}

// Parse HCPCS codes from drugs table JSON field
function parseHcpcsCodes(hcpcsJson) {
  if (!hcpcsJson) return []
  try {
    const parsed = typeof hcpcsJson === 'string' ? JSON.parse(hcpcsJson) : hcpcsJson
    if (Array.isArray(parsed)) {
      return parsed.map(h => h.code).filter(Boolean).slice(0, 2)
    }
  } catch {}
  return []
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
