import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/+$/, '')

interface BackendComparison {
  payer_name: string
  policy_title: string
  effective_date: string | null
  coverage_status: string
  coverage_tier: string | null
  coverage_tier_detail: string | null
  requires_prior_auth: boolean
  pa_criteria: string[] | null
  step_therapy: Array<{ required_agents?: string[]; reason?: string }> | null
  indications: Array<{ indication_name: string; coverage_status: string }> | null
  site_of_care: string | null
  dosing_notes: string | null
  approval_duration_months: number | null
  limitations: string[] | null
}

interface FrontendComparison {
  payer: string
  policyTitle: string
  effectiveDate: string
  coverageStatus: 'covered' | 'not_covered' | 'unproven'
  tier: string | null
  tierDetail: string | null
  requiresPriorAuth: boolean
  priorAuthCriteria: string[]
  stepTherapy: string[]
  coveredIndications: string[]
  siteOfCare: string | null
  dosingNotes: string | null
  approvalDurationMonths: number | null
  limitations: string[]
}

function transformComparison(data: BackendComparison): FrontendComparison {
  // Extract step therapy agents
  const stepTherapyAgents: string[] = []
  if (data.step_therapy && Array.isArray(data.step_therapy)) {
    for (const step of data.step_therapy) {
      if (step.required_agents) {
        stepTherapyAgents.push(...step.required_agents)
      }
    }
  }

  // Extract covered indications
  const coveredIndications: string[] = []
  if (data.indications && Array.isArray(data.indications)) {
    for (const ind of data.indications) {
      if (ind.coverage_status === 'covered' && ind.indication_name) {
        coveredIndications.push(ind.indication_name)
      }
    }
  }

  // Normalize coverage status
  let coverageStatus: 'covered' | 'not_covered' | 'unproven' = 'covered'
  if (data.coverage_status === 'not_covered' || data.coverage_status === 'denied') {
    coverageStatus = 'not_covered'
  } else if (data.coverage_status === 'unproven' || data.coverage_status === 'experimental') {
    coverageStatus = 'unproven'
  }

  return {
    payer: data.payer_name,
    policyTitle: data.policy_title || 'Unknown Policy',
    effectiveDate: data.effective_date || '',
    coverageStatus,
    tier: data.coverage_tier,
    tierDetail: data.coverage_tier_detail,
    requiresPriorAuth: data.requires_prior_auth,
    priorAuthCriteria: data.pa_criteria || [],
    stepTherapy: stepTherapyAgents,
    coveredIndications,
    siteOfCare: data.site_of_care,
    dosingNotes: data.dosing_notes,
    approvalDurationMonths: data.approval_duration_months,
    limitations: data.limitations || [],
  }
}

export async function GET(request: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'Backend not configured' },
      { status: 503 }
    )
  }

  const { searchParams } = new URL(request.url)
  const drug = searchParams.get('drug')
  const payers = searchParams.get('payers')

  if (!drug) {
    return NextResponse.json(
      { error: 'drug parameter is required' },
      { status: 400 }
    )
  }

  try {
    const url = new URL(`${BACKEND_URL}/compare`)
    url.searchParams.set('drug', drug)
    if (payers) {
      url.searchParams.set('payers', payers)
    }

    const res = await fetch(url.toString(), { cache: 'no-store' })

    if (!res.ok) {
      // Return empty array for not found
      if (res.status === 404) {
        return NextResponse.json([])
      }
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Handle different response shapes from backend
    let comparisons: BackendComparison[] = []

    if (Array.isArray(data)) {
      comparisons = data
    } else if (data.comparison && Array.isArray(data.comparison)) {
      comparisons = data.comparison
    } else if (data.comparison && typeof data.comparison === 'object') {
      // Handle object map format
      comparisons = Object.values(data.comparison)
    }

    // Transform to frontend format
    const transformed = comparisons.map(transformComparison)

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Compare API error:', error)
    return NextResponse.json(
      { error: 'Backend unreachable' },
      { status: 502 }
    )
  }
}
