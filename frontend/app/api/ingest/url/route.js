const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request) {
  if (!BACKEND_URL) return Response.json({ error: 'Backend not configured' }, { status: 503 })

  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { url } = body
  if (!url?.trim()) return Response.json({ error: 'url is required' }, { status: 400 })

  try {
    const res = await fetch(`${BACKEND_URL}/ingest/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    const data = await res.json()
    return Response.json(data, { status: res.status })
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }
}
