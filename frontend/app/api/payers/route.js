const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  if (!BACKEND_URL) {
    return Response.json([], { status: 200 })
  }

  let res
  try {
    res = await fetch(`${BACKEND_URL}/payers`, { cache: 'no-store' })
  } catch {
    return Response.json([], { status: 200 })
  }

  if (!res.ok) return Response.json([], { status: 200 })

  const data = await res.json()
  return Response.json(Array.isArray(data) ? data : [])
}
