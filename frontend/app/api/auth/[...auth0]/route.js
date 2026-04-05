import { NextResponse } from 'next/server'

// Stub Auth0 API routes for when AUTH0 is not configured.
// Replace this file with the real Auth0 handler once credentials are set up:
//   import { auth0 } from '@/lib/auth0'
//   export const GET = auth0.handleAuth()
export function GET(request, { params }) {
  const action = params.auth0?.[0]

  if (action === 'me') {
    return new NextResponse(null, { status: 204 })
  }

  if (action === 'login' || action === 'logout' || action === 'callback') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
