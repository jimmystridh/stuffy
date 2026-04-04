import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { z } from 'zod'
import { adminAuth } from '@/lib/firebase/admin'

const tokenConfigSchema = z.union([
  z.string().min(1),
  z.object({
    userId: z.string().min(1),
    name: z.string().nullable().optional(),
    clientId: z.string().min(1).optional(),
    scopes: z.array(z.string().min(1)).optional(),
    expiresAt: z.number().int().positive().optional(),
  }),
])

const tokenMapSchema = z.record(z.string().min(1), tokenConfigSchema)

type TokenConfig = z.infer<typeof tokenConfigSchema>

const defaultScopes = ['items:read', 'items:write', 'locations:read', 'locations:write']

let cachedTokenMap: Record<string, TokenConfig> | null = null

function getTokenMap() {
  if (cachedTokenMap) return cachedTokenMap

  const raw = process.env.MCP_TOKENS_JSON
  if (!raw) {
    cachedTokenMap = {}
    return cachedTokenMap
  }

  const parsed = tokenMapSchema.parse(JSON.parse(raw))
  cachedTokenMap = parsed
  return cachedTokenMap
}

export function getConfiguredMcpBearerTokens() {
  return Object.keys(getTokenMap())
}

export function getIssuedMcpBearerToken() {
  const preferred = process.env.MCP_OAUTH_ISSUED_TOKEN
  if (preferred && getTokenMap()[preferred]) {
    return preferred
  }

  return getConfiguredMcpBearerTokens()[0]
}

function getTokenConfig(token: string) {
  return getTokenMap()[token]
}

function readScopes() {
  const configured = process.env.MCP_AUTH_SCOPES
  if (!configured) return defaultScopes

  const scopes = configured
    .split(',')
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)

  return scopes.length > 0 ? scopes : defaultScopes
}

function readResourceUrl(request: Request) {
  const explicit = process.env.MCP_RESOURCE_URL
  if (explicit) {
    try {
      return new URL(explicit)
    } catch {
      return undefined
    }
  }

  try {
    return new URL('/api/mcp', request.url)
  } catch {
    return undefined
  }
}

export async function verifyMcpBearerToken(
  request: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined

  const tokenConfig = getTokenConfig(bearerToken)

  if (!tokenConfig) {
    // Not a configured static token — treat as Firebase session cookie
    try {
      const decoded = await adminAuth.verifySessionCookie(bearerToken, true)
      return {
        token: bearerToken,
        clientId: `mcp-session:${decoded.uid}`,
        scopes: readScopes(),
        resource: readResourceUrl(request),
        extra: {
          userId: decoded.uid,
          email: decoded.email ?? null,
          name: decoded.name ?? null,
        },
      }
    } catch {
      return undefined
    }
  }

  if (typeof tokenConfig === 'string') {
    return {
      token: bearerToken,
      clientId: `mcp:${tokenConfig}`,
      scopes: readScopes(),
      resource: readResourceUrl(request),
      extra: {
        userId: tokenConfig,
        name: null,
      },
    }
  }

  if (tokenConfig.expiresAt && tokenConfig.expiresAt < Date.now() / 1000) {
    return undefined
  }

  return {
    token: bearerToken,
    clientId: tokenConfig.clientId ?? `mcp:${tokenConfig.userId}`,
    scopes: tokenConfig.scopes ?? readScopes(),
    expiresAt: tokenConfig.expiresAt,
    resource: readResourceUrl(request),
    extra: {
      userId: tokenConfig.userId,
      name: tokenConfig.name ?? null,
    },
  }
}
