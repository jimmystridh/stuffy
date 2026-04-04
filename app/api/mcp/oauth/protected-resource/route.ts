import { buildProtectedResourceMetadata } from '@/lib/mcp/oauth-metadata'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function jsonResponse(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function GET(request: Request) {
  try {
    return jsonResponse(buildProtectedResourceMetadata(request), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'max-age=3600',
      },
    })
  } catch (error) {
    return jsonResponse(
      { error: 'server_error', error_description: error instanceof Error ? error.message : 'Failed to build metadata' },
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
