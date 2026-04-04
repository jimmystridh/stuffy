import { resolveSessionBearerToken } from '@/lib/mcp/session-token'
import { issueAuthorizationCode } from '@/lib/mcp/oauth-codes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { ...init, headers })
}

function redirectResponse(location: string, status = 307) {
  return new Response(null, { status, headers: { Location: location } })
}

function buildRedirectUri(input: { redirectUri: string; state: string | null; code: string }) {
  const redirect = new URL(input.redirectUri)
  redirect.searchParams.set('code', input.code)
  if (input.state) redirect.searchParams.set('state', input.state)
  return redirect.toString()
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const redirectUri = url.searchParams.get('redirect_uri')
    const state = url.searchParams.get('state')
    const clientId = url.searchParams.get('client_id') ?? undefined
    const codeChallenge = url.searchParams.get('code_challenge') ?? undefined
    const codeChallengeMethod = url.searchParams.get('code_challenge_method') ?? undefined

    if (!redirectUri) {
      return jsonResponse(
        { error: 'invalid_request', error_description: 'Missing redirect_uri' },
        { status: 400 }
      )
    }

    const sessionToken = await resolveSessionBearerToken({ request })
    if (!sessionToken) {
      const loginUrl = new URL('/login', new URL(request.url).origin)
      loginUrl.searchParams.set('callbackUrl', request.url)
      return redirectResponse(loginUrl.toString(), 307)
    }

    const code = issueAuthorizationCode({
      sessionToken,
      clientId,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
    })

    return redirectResponse(buildRedirectUri({ redirectUri, state, code }), 307)
  } catch (error) {
    console.error('[mcp/authorize] error:', error)
    return jsonResponse(
      { error: 'server_error', error_description: 'Failed to authorize OAuth request' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  })
}
