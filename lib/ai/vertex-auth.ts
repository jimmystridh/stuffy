import { GoogleAuth, type GoogleAuthOptions } from 'google-auth-library'

const VERTEX_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

function readInlineCredentials() {
  const clientEmail =
    process.env.GOOGLE_VERTEX_CLIENT_EMAIL ||
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = (
    process.env.GOOGLE_VERTEX_PRIVATE_KEY ||
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  )?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey) return undefined

  return {
    client_email: clientEmail,
    private_key: privateKey,
  }
}

export function getVertexProject() {
  const project =
    process.env.GOOGLE_VERTEX_PROJECT ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (!project) {
    throw new Error('Missing GOOGLE_VERTEX_PROJECT or FIREBASE_ADMIN_PROJECT_ID')
  }

  return project
}

export function getVertexLocation() {
  return process.env.GOOGLE_VERTEX_LOCATION || 'us-central1'
}

export function getGoogleAuthOptions(): GoogleAuthOptions {
  const credentials = readInlineCredentials()
  return credentials ? { credentials } : {}
}

let auth: GoogleAuth | undefined

function getVertexAuth() {
  if (!auth) {
    auth = new GoogleAuth({
      ...getGoogleAuthOptions(),
      scopes: [VERTEX_SCOPE],
    })
  }

  return auth
}

export async function getVertexAccessToken() {
  const token = await getVertexAuth().getAccessToken()

  if (!token) {
    throw new Error('Failed to acquire Google Vertex access token')
  }

  return token
}
