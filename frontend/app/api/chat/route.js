import { mockChatAnswer } from '@/lib/mockData'

const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request) {
  const { question, drug } = await request.json()

  if (BACKEND_URL) {
    try {
      const res = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, drug }),
      })
      if (res.ok) return Response.json(await res.json())
    } catch {
      // fall through to mock
    }
  }

  const result = mockChatAnswer(question, drug)
  // Normalize sources to array for consistent frontend handling
  return Response.json({
    ...result,
    sources: result.sources ? [result.sources] : [],
    context_rows_used: 0,
  })
}