const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, name, org_name } = body
  if (!email?.trim()) {
    return Response.json({ error: 'email is required' }, { status: 400 })
  }

  if (!BACKEND_URL) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, org_name }),
    })
    const data = await res.json()
    if (!res.ok) return Response.json({ error: data.detail || 'Subscribe failed' }, { status: res.status })
    return Response.json(data)
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }
}
