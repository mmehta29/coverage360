const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request) {
  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { question, drug } = body
  if (!question?.trim()) {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }

  if (!BACKEND_URL) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 })
  }

  try {
    const res = await fetch(`${BACKEND_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, drug }),
      signal: AbortSignal.timeout(25000),
    })
    const data = await res.json()
    if (!res.ok) return Response.json({ error: data.detail || data.error || 'Chat failed' }, { status: res.status })
    return Response.json({
      answer: data.answer || '',
      sources: Array.isArray(data.sources) ? data.sources : data.sources ? [data.sources] : [],
      context_rows_used: data.context_rows_used ?? 0,
    })
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }
}
