import { initAuth0 } from '@auth0/nextjs-auth0'

const issuerBaseURL = normalizeUrl(
  process.env.AUTH0_ISSUER_BASE_URL || process.env.AUTH0_DOMAIN || ''
)

const baseURL = normalizeUrl(
  process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || ''
)

const auth0 = initAuth0({
  issuerBaseURL,
  baseURL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  secret: process.env.AUTH0_SECRET,
})

export const GET = auth0.handleAuth()

function normalizeUrl(value) {
  if (!value) return value
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}
