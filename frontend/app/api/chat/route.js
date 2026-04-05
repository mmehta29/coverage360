const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request) {
  const { question, drug } = await request.json()
  if (!question?.trim()) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  if (!BACKEND_URL) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 })
  }

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

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: err || 'Backend error' }, { status: res.status })
  }

  const data = await res.json()

  // Backend returns sources as string[], UI expects a single string
  const sources = Array.isArray(data.sources)
    ? data.sources.join(' · ')
    : (data.sources ?? '')

  return Response.json({
    answer: data.answer,
    sources,
    evidence: Array.isArray(data.evidence) ? data.evidence : [],
  })
}
