const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  if (!BACKEND_URL) {
    return Response.json({ drugs: [], payers: [], matrix: {} })
  }
  try {
    const res = await fetch(`${BACKEND_URL}/heatmap`, { cache: 'no-store' })
    if (!res.ok) return Response.json({ drugs: [], payers: [], matrix: {} })
    return Response.json(await res.json())
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }
}
