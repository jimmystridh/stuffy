import { GoogleAuth, type GoogleAuthOptions } from 'google-auth-library'
import {
  getGoogleCloudProject,
  getVertexCredentials,
} from '@/lib/google-cloud-auth'

const VERTEX_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

export function getVertexProject() {
  const project =
    process.env.GOOGLE_VERTEX_PROJECT ||
    getGoogleCloudProject()

  if (!project) {
    throw new Error('Missing GOOGLE_VERTEX_PROJECT or FIREBASE_ADMIN_PROJECT_ID')
  }

  return project
}

export function getVertexLocation() {
  return process.env.GOOGLE_VERTEX_LOCATION || 'us-central1'
}

export function getGoogleAuthOptions(): GoogleAuthOptions {
  const credentials = getVertexCredentials()
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
