import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL?.replace(/\/+$/, '')

interface Payer {
  id: string
  name: string
  type?: string | null
}

export async function GET() {
  if (!BACKEND_URL) {
    // Return empty array when backend not configured
    return NextResponse.json([])
  }

  try {
    const res = await fetch(`${BACKEND_URL}/payers`, { cache: 'no-store' })

    if (!res.ok) {
      console.error(`Payers API returned ${res.status}`)
      return NextResponse.json([])
    }

    const data = await res.json()

    // Ensure we return an array of { id, name }
    if (Array.isArray(data)) {
      const payers: Payer[] = data.map((p, idx) => ({
        id: p.id || String(idx),
        name: p.name || p.payer_name || 'Unknown',
        type: p.type || p.payer_type || null,
      }))
      return NextResponse.json(payers)
    }

    return NextResponse.json([])
  } catch (error) {
    console.error('Payers API error:', error)
    return NextResponse.json(
      { error: 'Backend unreachable' },
      { status: 502 }
    )
  }
}
