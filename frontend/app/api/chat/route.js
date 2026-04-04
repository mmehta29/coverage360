import { mockChatAnswer } from '@/lib/mockData'

export async function POST(request) {
  const { question, drug } = await request.json()

  // TODO: replace with real backend call:
  // const res = await fetch(`${process.env.BACKEND_URL}/chat`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ question, drug }),
  // })
  // return Response.json(await res.json())

  const result = mockChatAnswer(question, drug)
  return Response.json(result)
}
