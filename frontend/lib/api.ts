// Call local Next.js API routes which proxy to the backend
const API_BASE = ''

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const message = (data && data.detail) || (data && data.error) || `Request failed: ${response.status}`
    throw new Error(message)
  }

  return data as T
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && String(value).length > 0) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  })

  return parseJson<T>(response)
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  return parseJson<T>(response)
}

export interface DrugSearchResult {
  id: string
  brand_name: string | null
  generic_name: string | null
  drug_class: string | null
  is_biosimilar: boolean
}

export interface PayerResult {
  id: string
  name: string
  type: string | null
}

export interface AskResponse {
  answer: string
  sources: string[]
}

export interface CompareResponse {
  comparison: Record<string, {
    payer_name: string
    payer_type: string | null
    drug_brand_name: string | null
    drug_generic_name: string | null
    coverage_status: string | null
    requires_prior_auth: boolean
    coverage_tier: string | null
    indications: Array<{
      indication_name: string | null
      coverage_status: string | null
      icd10_codes: string[]
    }>
    step_therapy: Array<Record<string, unknown>>
    pa_criteria: Record<string, unknown> | null
    approval_duration_months: number | null
    policy_title: string | null
    effective_date: string | null
  }>
  payers: string[]
}

export function searchDrugs(q: string, limit = 20) {
  return get<DrugSearchResult[]>('/api/search', { q, limit })
}

export function getPayers() {
  return get<PayerResult[]>('/api/payers')
}

export function compareCoverage(drug: string, payers?: string[]) {
  return get<CompareResponse>('/api/coverage/compare', {
    drug,
    payers: payers && payers.length > 0 ? payers.join(',') : undefined,
  })
}

export function askCoverageQuestion(question: string) {
  return post<AskResponse>('/api/chat', { question })
}
