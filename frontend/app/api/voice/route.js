const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY

export async function POST(request) {
  if (!ELEVENLABS_API_KEY) {
    return Response.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 500 })
  }

  let formData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const audio = formData.get('audio')
  if (!audio) {
    return Response.json({ error: 'audio field is required' }, { status: 400 })
  }

  // Forward audio to ElevenLabs speech-to-text
  const body = new FormData()
  body.append('file', audio, 'recording.webm')
  body.append('model_id', 'scribe_v1')

  let res
  try {
    res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      body,
    })
  } catch {
    return Response.json({ error: 'ElevenLabs unreachable' }, { status: 502 })
  }

  if (!res.ok) {
    const err = await res.text()
    return Response.json({ error: err || 'Transcription failed' }, { status: res.status })
  }

  const data = await res.json()
  return Response.json({ transcript: data.text || '' })
}
