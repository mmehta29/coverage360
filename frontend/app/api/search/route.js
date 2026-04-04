import { lookupDrug } from '@/lib/mockData'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') ?? ''

  // TODO: replace with real backend call:
  // const res = await fetch(`${process.env.BACKEND_URL}/search?q=${encodeURIComponent(query)}`)
  // return Response.json(await res.json())

  const drug = lookupDrug(query)
  if (!drug) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  return Response.json(drug)
}
