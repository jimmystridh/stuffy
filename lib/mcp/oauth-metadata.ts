function safeBaseOrigin() {
  return process.env.MCP_RESOURCE_URL ?? 'http://localhost:3000'
}

export function getPublicOrigin(request: Request) {
  try {
    const forwardedProtoHeader = request.headers.get('x-forwarded-proto')
    const forwardedProto =
      forwardedProtoHeader?.split(',')[0]?.trim() === 'http' ? 'http' : 'https'

    // Cloud Run: x-forwarded-host or Host header contains the real hostname
    const forwardedHost = request.headers.get('x-forwarded-host')
    const hostHeader = request.headers.get('host')
    const host = forwardedHost?.split(',')[0]?.trim() || hostHeader

    if (host) {
      const normalizedHost = host.replace(/^https?:\/\//, '').split('/')[0]?.trim()
      if (normalizedHost && !normalizedHost.startsWith('0.0.0.0') && !normalizedHost.startsWith('127.0.0.1')) {
        return `${forwardedProto}://${normalizedHost}`
      }
    }

    // Fallback to configured URL or request URL
    const explicit = process.env.MCP_RESOURCE_URL
    if (explicit) {
      return new URL(explicit).origin
    }

    return new URL(request.url).origin
  } catch {
    try {
      return new URL(safeBaseOrigin()).origin
    } catch {
      return 'http://localhost:3000'
    }
  }
}

export function getPublicUrl(request: Request, path: string) {
  try {
    return new URL(path, `${getPublicOrigin(request)}/`).toString()
  } catch {
    return new URL(path, 'http://localhost:3000/').toString()
  }
}

const defaultScopes = ['items:read', 'items:write', 'locations:read', 'locations:write']

export function getScopes() {
  const configured = process.env.MCP_AUTH_SCOPES
  if (!configured) return defaultScopes

  const scopes = configured
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)

  return scopes.length > 0 ? scopes : defaultScopes
}

export function getAudience(request: Request) {
  return process.env.MCP_RESOURCE_URL ?? `${getPublicOrigin(request)}/api/mcp`
}

function getAuthorizationServerIssuer(request: Request) {
  return (
    process.env.MCP_AUTH_ISSUER_URL ??
    getPublicUrl(request, '/api/mcp/oauth/authorization-server')
  )
}

export function buildAuthorizationServerMetadata(request: Request) {
  const scopes = getScopes()
  const issuer = getAuthorizationServerIssuer(request)

  return {
    issuer,
    authorization_endpoint: getPublicUrl(request, '/api/mcp/auth/authorize'),
    token_endpoint: getPublicUrl(request, '/api/mcp/auth/token'),
    registration_endpoint: getPublicUrl(request, '/api/mcp/auth/register'),
    jwks_uri: getPublicUrl(request, '/api/mcp/auth/jwks'),
    response_types_supported: ['code', 'token'],
    grant_types_supported: [
      'client_credentials',
      'authorization_code',
      'refresh_token',
    ],
    token_endpoint_auth_methods_supported: ['none'],
    registration_endpoint_auth_methods_supported: ['none'],
    token_endpoint_auth_signing_alg_values_supported: ['RS256'],
    code_challenge_methods_supported: ['S256'],
    revocation_endpoint: getPublicUrl(request, '/api/mcp/auth/revoke'),
    introspection_endpoint: getPublicUrl(request, '/api/mcp/auth/introspect'),
    scopes_supported: scopes,
    resource: getAudience(request),
  }
}

export function buildProtectedResourceMetadata(request: Request) {
  const issuer = getAuthorizationServerIssuer(request)

  return {
    resource: getAudience(request),
    authorization_servers: [issuer],
    bearer_methods_supported: ['header'],
    scopes_supported: getScopes(),
  }
}
