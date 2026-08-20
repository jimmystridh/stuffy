import * as dotenv from 'dotenv'
import * as path from 'path'
import { adminDb } from '@/lib/firebase/admin'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const db = adminDb

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
