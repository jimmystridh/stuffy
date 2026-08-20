import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getFirebaseAdminCredentials,
  getGoogleCloudProject,
  getVertexCredentials,
} from './google-cloud-auth'

test('uses Application Default Credentials when inline credentials are omitted', () => {
  assert.equal(getFirebaseAdminCredentials({}), undefined)
  assert.equal(getVertexCredentials({}), undefined)
})

test('normalizes a complete Firebase service-account credential pair', () => {
  assert.deepEqual(
    getFirebaseAdminCredentials({
      FIREBASE_ADMIN_CLIENT_EMAIL: ' local@example.test ',
      FIREBASE_ADMIN_PRIVATE_KEY: 'first\\nsecond',
    }),
    {
      client_email: 'local@example.test',
      private_key: 'first\nsecond',
    },
  )
})

test('rejects partial Firebase service-account credentials', () => {
  assert.throws(
    () =>
      getFirebaseAdminCredentials({
        FIREBASE_ADMIN_CLIENT_EMAIL: 'local@example.test',
      }),
    /must either both be configured or both be omitted/,
  )
})

test('keeps Vertex overrides as one identity instead of mixing credential pairs', () => {
  assert.throws(
    () =>
      getVertexCredentials({
        GOOGLE_VERTEX_CLIENT_EMAIL: 'vertex@example.test',
        FIREBASE_ADMIN_CLIENT_EMAIL: 'firebase@example.test',
        FIREBASE_ADMIN_PRIVATE_KEY: 'firebase-key',
      }),
    /GOOGLE_VERTEX_CLIENT_EMAIL and GOOGLE_VERTEX_PRIVATE_KEY/,
  )
})

test('falls back to Firebase credentials only when no Vertex override exists', () => {
  assert.deepEqual(
    getVertexCredentials({
      FIREBASE_ADMIN_CLIENT_EMAIL: 'firebase@example.test',
      FIREBASE_ADMIN_PRIVATE_KEY: 'firebase-key',
    }),
    {
      client_email: 'firebase@example.test',
      private_key: 'firebase-key',
    },
  )
})

test('resolves the project from server-only configuration before public fallback', () => {
  assert.equal(
    getGoogleCloudProject({
      FIREBASE_ADMIN_PROJECT_ID: 'firebase-admin-project',
      GOOGLE_CLOUD_PROJECT: 'google-cloud-project',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'public-project',
    }),
    'firebase-admin-project',
  )
  assert.equal(
    getGoogleCloudProject({
      GOOGLE_CLOUD_PROJECT: 'google-cloud-project',
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'public-project',
    }),
    'google-cloud-project',
  )
})
