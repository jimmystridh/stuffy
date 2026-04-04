import { initializeApp, getApps, cert, type ServiceAccount, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'

let _app: App | undefined
let _db: Firestore | undefined
let _auth: Auth | undefined

function getAdminApp(): App {
  if (_app) return _app
  if (getApps().length > 0) {
    _app = getApps()[0]
    return _app
  }

  const serviceAccount: ServiceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }

  _app = initializeApp({ credential: cert(serviceAccount) })
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
