const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
// Rachel — clear, professional female voice. Good for clinical content.
const VOICE_ID = '21m00Tcm4TlvDq8ikWAM'

export async function POST(request) {
  if (!ELEVENLABS_API_KEY) {
    return Response.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
  }

  let body
  try { body = await request.json() } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const text = (body.text || '').trim()
  if (!text) return Response.json({ error: 'text is required' }, { status: 400 })

  // Truncate to 500 chars to stay within free tier limits
  const truncated = text.length > 500 ? text.slice(0, 497) + '...' : text

  let res
  try {
    res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: truncated,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    })
  } catch {
    return Response.json({ error: 'ElevenLabs unreachable' }, { status: 502 })
  }

  if (!res.ok) {
    let message = 'TTS failed'
    try { const e = await res.json(); message = e.detail?.message || e.detail || message } catch {}
    return Response.json({ error: message }, { status: res.status })
  }

  // Stream the audio bytes directly back to the browser
  return new Response(res.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  })
}
