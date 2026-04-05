const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  if (!BACKEND_URL) return Response.json({ policies: 0, payers: 0, last_updated: null })
  try {
    const res = await fetch(`${BACKEND_URL}/stats`, { cache: 'no-store' })
    if (!res.ok) return Response.json({ policies: 0, payers: 0, last_updated: null })
    return Response.json(await res.json())
  } catch {
    return Response.json({ policies: 0, payers: 0, last_updated: null })
  }
}
