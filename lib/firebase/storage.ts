import { Storage, type Bucket } from '@google-cloud/storage'

let _storage: Storage | undefined
let _bucket: Bucket | undefined

function getStorage(): Storage {
  if (!_storage) {
    _storage = new Storage({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      credentials: {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    })
  }
  return _storage
}

export const bucket: Bucket = new Proxy({} as Bucket, {
  get(_, prop) {
    if (!_bucket) {
      const bucketName = process.env.GCS_BUCKET_NAME || 'stuffy-uploads'
      _bucket = getStorage().bucket(bucketName)
    }
    return Reflect.get(_bucket, prop)
  },
})
