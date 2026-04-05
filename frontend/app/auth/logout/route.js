import { NextResponse } from 'next/server'

export function GET(request) {
  const url = new URL('/api/auth/logout', request.url)
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value)
  })
  return NextResponse.redirect(url)
}
