import 'dotenv/config'

import { adminDb } from '@/lib/firebase/admin'
import { buildItemAiData } from '@/lib/ai/item-intelligence'
import type { Item } from '@/lib/types'

async function main() {
  const snapshot = await adminDb.collection('items').where('deleted', '==', false).get()
  let indexed = 0
  let skipped = 0

  for (const doc of snapshot.docs) {
    const item = { id: doc.id, ...doc.data() } as Item
    const activeImages = (item.images || []).filter(image => !image.deleted)

    if (activeImages.length === 0) {
      skipped += 1
      continue
    }

    try {
      const ai = await buildItemAiData(item)
      await doc.ref.update({
        ai,
        updatedAt: new Date().toISOString(),
      })
      indexed += 1
      console.log(`Indexed ${item.itemId} (${item.name})`)
    } catch (error) {
      console.error(`Failed to index ${item.itemId} (${item.name}):`, error)
    }
  }

  console.log(`Done. Indexed ${indexed} items, skipped ${skipped} items without images.`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
