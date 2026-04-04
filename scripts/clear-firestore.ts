import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
  })
})
const db = getFirestore(app)

async function deleteCollection(name: string) {
  const snap = await db.collection(name).get()
  const batchSize = 500
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = db.batch()
    snap.docs.slice(i, i + batchSize).forEach(doc => batch.delete(doc.ref))
    await batch.commit()
  }
  console.log(`Deleted ${snap.size} docs from ${name}`)
}

async function main() {
  await deleteCollection('items')
  await deleteCollection('locations')
  console.log('Done')
}

main().catch(console.error)
