const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch { }

  if (!BACKEND_URL) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: body.days || 30 }),
    })
    const data = await res.json()
    if (!res.ok) return Response.json({ error: data.detail || 'Notify failed' }, { status: res.status })
    return Response.json(data)
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }
}
