const BACKEND_URL = process.env.BACKEND_URL

export async function POST(request) {
  if (!BACKEND_URL) {
    return Response.json({ error: 'Backend not configured' }, { status: 503 })
  }

  let formData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const documentUrl = formData.get('document_url')

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const backendForm = new FormData()
  backendForm.append('file', file)
  if (documentUrl) backendForm.append('document_url', documentUrl)

  let res
  try {
    res = await fetch(`${BACKEND_URL}/ingest/upload`, {
      method: 'POST',
      body: backendForm,
    })
  } catch {
    return Response.json({ error: 'Backend unreachable' }, { status: 502 })
  }

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
