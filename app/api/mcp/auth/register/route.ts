import { getPublicUrl } from '@/lib/mcp/oauth-metadata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      // empty body is fine
    }

    const id = crypto.randomUUID()
    const clientId = `mcp-client-${id}`
    const jwksUri = getPublicUrl(request, '/api/mcp/auth/jwks')

    const redirectUris = Array.isArray(body.redirect_uris)
      ? (body.redirect_uris as string[])
      : []
    const clientName =
      typeof body.client_name === 'string' ? body.client_name : 'mcp-dynamic-client'

    return jsonResponse(
      {
        client_id: clientId,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        redirect_uris: redirectUris,
        client_name: clientName,
        jwks_uri: jwksUri,
        token_endpoint_auth_method: 'none',
        grant_types: ['client_credentials', 'authorization_code', 'refresh_token'],
        response_types: ['code', 'token'],
        registration_client_uri: getPublicUrl(request, '/api/mcp/auth/register'),
      },
      { status: 201, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (error) {
    console.error('[mcp/register] error:', error)
    return jsonResponse(
      { error: 'server_error', error_description: 'Failed to register OAuth client' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
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
