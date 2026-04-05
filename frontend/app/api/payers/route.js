const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  if (!BACKEND_URL) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 })
  }

  let res
  try {
    res = await fetch(`${BACKEND_URL}/payers`, { cache: 'no-store' })
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }

  if (!res.ok) return Response.json({ error: 'Unable to load payers' }, { status: res.status })

  const data = await res.json()
  return Response.json(data) // [{ id, name, short_name, type, ... }]
}
