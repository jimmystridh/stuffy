import { createHash, createHmac } from 'crypto'
import { redirectUrisMatch } from './redirect-uri'

type CodeChallengeMethod = 'S256' | 'plain'

type CodePayload = {
  st: string
  cid?: string
  ru?: string
  cc?: string
  ccm?: CodeChallengeMethod
  exp: number
  jti: string
}

const CODE_TTL_MS = 5 * 60 * 1000

const consumedCodes = new Map<string, number>()

function pruneConsumedCodes() {
  const now = Date.now()
  for (const [jti, exp] of consumedCodes) {
    if (exp < now) consumedCodes.delete(jti)
  }
}

function toBase64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(input: string) {
  const padding = '='.repeat((4 - (input.length % 4)) % 4)
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/') + padding
  return Buffer.from(base64, 'base64')
}

function getSigningSecret() {
  const secret = process.env.MCP_AUTH_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MCP_AUTH_SECRET must be set in production')
    }
    return 'dev-mcp-secret'
  }
  return secret
}

function sign(payloadBase64Url: string) {
  return toBase64Url(
    createHmac('sha256', getSigningSecret()).update(payloadBase64Url).digest()
  )
}

function parseCode(code: string) {
  const [payloadPart, signaturePart] = code.split('.')
  if (!payloadPart || !signaturePart) return null

  const expectedSignature = sign(payloadPart)
  if (signaturePart !== expectedSignature) return null

  try {
    const payload = JSON.parse(fromBase64Url(payloadPart).toString('utf8')) as CodePayload
    return payload
  } catch {
    return null
  }
}

export function issueAuthorizationCode(input: {
  sessionToken: string
  clientId?: string
  redirectUri?: string
  codeChallenge?: string
  codeChallengeMethod?: string
}) {
  const method =
    input.codeChallengeMethod === 'plain' || input.codeChallengeMethod === 'S256'
      ? input.codeChallengeMethod
      : undefined

  const payload: CodePayload = {
    st: input.sessionToken,
    cid: input.clientId,
    ru: input.redirectUri,
    cc: input.codeChallenge,
    ccm: method,
    exp: Date.now() + CODE_TTL_MS,
    jti: crypto.randomUUID(),
  }

  const payloadPart = toBase64Url(JSON.stringify(payload))
  const signaturePart = sign(payloadPart)
  return `${payloadPart}.${signaturePart}`
}

export function consumeAuthorizationCode(input: {
  code: string
  clientId?: string
  redirectUri?: string
  codeVerifier?: string
}) {
  const payload = parseCode(input.code)
  if (!payload || payload.exp < Date.now()) {
    return { ok: false as const, error: 'Invalid or expired authorization code' }
  }

  pruneConsumedCodes()

  if (consumedCodes.has(payload.jti)) {
    return { ok: false as const, error: 'Authorization code has already been used' }
  }

  if (payload.cid && input.clientId && payload.cid !== input.clientId) {
    return { ok: false as const, error: 'Client mismatch for authorization code' }
  }

  if (payload.ru && input.redirectUri && !redirectUrisMatch(payload.ru, input.redirectUri)) {
    return { ok: false as const, error: 'Redirect URI mismatch for authorization code' }
  }

  if (payload.cc) {
    if (!input.codeVerifier) {
      return { ok: false as const, error: 'Missing code_verifier' }
    }

    if (payload.ccm === 'plain') {
      if (input.codeVerifier !== payload.cc) {
        return { ok: false as const, error: 'Invalid code_verifier' }
      }
    } else {
      const digest = toBase64Url(createHash('sha256').update(input.codeVerifier).digest())
      if (digest !== payload.cc) {
        return { ok: false as const, error: 'Invalid code_verifier' }
      }
    }
  }

  consumedCodes.set(payload.jti, payload.exp)

  return { ok: true as const, sessionToken: payload.st }
}
