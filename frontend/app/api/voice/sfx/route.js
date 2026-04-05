const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

// Prompts tuned for a clean medical/professional UI context
const SFX_PROMPTS = {
  negative: 'Short two-tone descending soft chime, subtle alert, medical UI notification, 1 second',
  positive: 'Short ascending soft chime, success notification, clean and pleasant, 1 second',
  warning:  'Single soft mid-tone bell, neutral notification, subtle UI sound, 0.8 seconds',
}

export async function GET(request) {
  if (!ELEVENLABS_API_KEY) {
    return Response.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'warning'
  const prompt = SFX_PROMPTS[type] ?? SFX_PROMPTS.warning

  let res
  try {
    res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: prompt,
        duration_seconds: 1.0,
        prompt_influence: 0.3,
      }),
    })
  } catch {
    return Response.json({ error: 'ElevenLabs unreachable' }, { status: 502 })
  }

  if (!res.ok) {
    let message = 'SFX generation failed'
    try { const e = await res.json(); message = e.detail?.message || e.detail || message } catch {}
    return Response.json({ error: message }, { status: res.status })
  }

  return new Response(res.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      // Cache for 24h — same prompt = same sound, no need to regenerate
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
