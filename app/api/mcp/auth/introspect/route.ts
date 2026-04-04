import { getConfiguredMcpBearerTokens } from '@/lib/mcp/auth'
import { getAudience, getScopes } from '@/lib/mcp/oauth-metadata'
import { adminAuth } from '@/lib/firebase/admin'

function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export async function POST(request: Request) {
  const body = await request.text()
  const params = new URLSearchParams(body)
  const token = params.get('token') ?? ''

  let isActive = false

  if (token.length > 0) {
    if (getConfiguredMcpBearerTokens().includes(token)) {
      isActive = true
    } else {
      try {
        await adminAuth.verifySessionCookie(token, true)
        isActive = true
      } catch {
        // expired or invalid
      }
    }
  }

  return jsonResponse(
    {
      active: isActive,
      scope: isActive ? getScopes().join(' ') : '',
      token_type: isActive ? 'Bearer' : undefined,
      aud: isActive ? getAudience(request) : undefined,
      iss: isActive ? new URL(request.url).origin : undefined,
    },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  )
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
