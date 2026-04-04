import { getIssuedMcpBearerToken } from '@/lib/mcp/auth'
import { getAudience, getScopes } from '@/lib/mcp/oauth-metadata'
import { resolveSessionBearerToken } from '@/lib/mcp/session-token'
import { consumeAuthorizationCode } from '@/lib/mcp/oauth-codes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { ...init, headers })
}

type TokenRequest = {
  grant_type?: string
  grantType?: string
  resource?: string
  scope?: string
  code?: string
  code_verifier?: string
  codeVerifier?: string
  redirect_uri?: string
  redirectUri?: string
  client_id?: string
  clientId?: string
  refresh_token?: string
}

function parseFormBody(body: string): TokenRequest {
  const params = new URLSearchParams(body)
  return {
    grant_type: params.get('grant_type') ?? undefined,
    grantType: params.get('grantType') ?? undefined,
    resource: params.get('resource') ?? undefined,
    scope: params.get('scope') ?? undefined,
    code: params.get('code') ?? undefined,
    code_verifier: params.get('code_verifier') ?? undefined,
    codeVerifier: params.get('codeVerifier') ?? undefined,
    redirect_uri: params.get('redirect_uri') ?? undefined,
    redirectUri: params.get('redirectUri') ?? undefined,
    client_id: params.get('client_id') ?? undefined,
    clientId: params.get('clientId') ?? undefined,
    refresh_token: params.get('refresh_token') ?? undefined,
  }
}

function parseBody(contentType: string | null, body: string): TokenRequest {
  if (contentType?.includes('application/json')) {
    try {
      return JSON.parse(body) as TokenRequest
    } catch {
      return {}
    }
  }
  return parseFormBody(body)
}

function jsonError(status: number, error: string, description: string) {
  return jsonResponse(
    { error, error_description: description },
    { status, headers: { 'Access-Control-Allow-Origin': '*' } }
  )
}

export async function POST(request: Request) {
  try {
    const bodyText = await request.text()
    const input = parseBody(request.headers.get('content-type'), bodyText)

    const grantType = input.grant_type ?? input.grantType ?? 'client_credentials'
    const supportedGrantTypes = new Set([
      'client_credentials',
      'authorization_code',
      'refresh_token',
    ])

    if (!supportedGrantTypes.has(grantType)) {
      return jsonError(400, 'unsupported_grant_type', `Unsupported grant_type: ${grantType}`)
    }

    let token: string | undefined

    if (grantType === 'authorization_code') {
      if (!input.code) {
        return jsonError(400, 'invalid_request', 'Missing authorization code')
      }

      const consumed = consumeAuthorizationCode({
        code: input.code,
        clientId: input.client_id ?? input.clientId,
        redirectUri: input.redirect_uri ?? input.redirectUri,
        codeVerifier: input.code_verifier ?? input.codeVerifier,
      })

      if (!consumed.ok) {
        return jsonError(400, 'invalid_grant', consumed.error)
      }

      token = consumed.sessionToken
    }

    if (grantType === 'refresh_token' && input.refresh_token) {
      // Return the same token — the Firebase session cookie is still valid
      // until it expires (5 days). The client refreshes hourly (expires_in: 3600).
      token = input.refresh_token
    }

    if (!token) {
      token = getIssuedMcpBearerToken()
    }

    if (!token) {
      token = await resolveSessionBearerToken({ request })

      if (!token) {
        return jsonError(
          401,
          'invalid_request',
          'No configured MCP token and no active authenticated session'
        )
      }
    }

    const scopes = getScopes()

    return jsonResponse(
      {
        access_token: token,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: token,
        scope: input.scope ?? scopes.join(' '),
        resource: input.resource ?? getAudience(request),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    console.error('[mcp/token] error:', error)
    return jsonError(500, 'server_error', 'Failed to issue OAuth token')
  }
}

export function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    },
  })
}
