import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'
import {
  getFirebaseAdminCredentials,
  getGoogleCloudProject,
} from '@/lib/google-cloud-auth'

let _app: App | undefined
let _db: Firestore | undefined
let _auth: Auth | undefined

function getAdminApp(): App {
  if (_app) return _app
  if (getApps().length > 0) {
    _app = getApps()[0]
    return _app
  }

  const projectId = getGoogleCloudProject()
  const credentials = getFirebaseAdminCredentials()

  if (credentials && !projectId) {
    throw new Error(
      'FIREBASE_ADMIN_PROJECT_ID or GOOGLE_CLOUD_PROJECT is required with inline Firebase Admin credentials',
    )
  }

  _app = initializeApp({
    credential: credentials
      ? cert({
          projectId,
          clientEmail: credentials.client_email,
          privateKey: credentials.private_key,
        })
      : applicationDefault(),
    ...(projectId && { projectId }),
  })
  return _app
}

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    if (!_db) _db = getFirestore(getAdminApp())
    return Reflect.get(_db, prop)
  },
})

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    if (!_auth) _auth = getAuth(getAdminApp())
    return Reflect.get(_auth, prop)
  },
})
