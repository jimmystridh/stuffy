import { Storage, type Bucket } from '@google-cloud/storage'
import {
  getFirebaseAdminCredentials,
  getGoogleCloudProject,
} from '@/lib/google-cloud-auth'

let _storage: Storage | undefined
let _bucket: Bucket | undefined

function getStorage(): Storage {
  if (!_storage) {
    const credentials = getFirebaseAdminCredentials()
    const projectId = getGoogleCloudProject()

    _storage = new Storage({
      ...(projectId && { projectId }),
      ...(credentials && { credentials }),
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
