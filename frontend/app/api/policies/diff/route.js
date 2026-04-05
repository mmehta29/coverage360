const BACKEND_URL = process.env.BACKEND_URL

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const policyId = searchParams.get('policyId')

  if (!policyId?.trim()) {
    return Response.json({ error: 'policyId is required' }, { status: 400 })
  }

  if (!BACKEND_URL) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 })
  }

  let res
  try {
    res = await fetch(`${BACKEND_URL}/diff/${encodeURIComponent(policyId)}`, { cache: 'no-store' })
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }

  const data = await res.json()
  if (!res.ok) {
    return Response.json({ error: data?.detail || data?.error || 'Unable to load policy diff' }, { status: res.status })
  }

  return Response.json(data)
}
