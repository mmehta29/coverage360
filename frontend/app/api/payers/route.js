import { PAYERS } from '@/lib/mockData'

const BACKEND_URL = process.env.BACKEND_URL

export async function GET() {
  if (!BACKEND_URL) {
    return Response.json(PAYERS.map(name => ({ name })))
  }

  let res
  try {
    res = await fetch(`${BACKEND_URL}/payers`, { cache: 'no-store' })
  } catch {
    return Response.json(PAYERS.map(name => ({ name })))
  }

  if (!res.ok) return Response.json(PAYERS.map(name => ({ name })))

  const data = await res.json()
  return Response.json(data) // [{ id, name, short_name, type, ... }]
}
