import { NextResponse } from 'next/server'
import { auth0 } from '@/lib/auth0'

export async function GET(request, { params }) {
  const action = params.auth0?.[0]

  if (!process.env.AUTH0_DOMAIN) {
    if (action === 'me') return new NextResponse(null, { status: 204 })
    return NextResponse.redirect(new URL('/', request.url))
  }

  if (action === 'login')    return auth0.handleLogin(request)
  if (action === 'logout')   return auth0.handleLogout(request)
  if (action === 'callback') return auth0.handleCallback(request)
  if (action === 'me')       return auth0.handleProfile(request)

  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
