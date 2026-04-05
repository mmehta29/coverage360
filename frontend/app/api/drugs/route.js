const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  if (!BACKEND_URL) {
    return Response.json([])
  }

  let res
  try {
    res = await fetch(`${BACKEND_URL}/drugs`, { cache: 'no-store' })
  } catch {
    return Response.json([], { status: 502 })
  }

  if (!res.ok) return Response.json([])
  return Response.json(await res.json())
}
