const BACKEND_URL = process.env.BACKEND_URL

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const drug = searchParams.get('drug')
  if (!drug?.trim() || !BACKEND_URL) return Response.json({ positions: [] })
  try {
    const res = await fetch(`${BACKEND_URL}/category/${encodeURIComponent(drug)}`, { cache: 'no-store' })
    if (!res.ok) return Response.json({ positions: [] })
    return Response.json(await res.json())
  } catch {
    return Response.json({ positions: [] })
  }
}
