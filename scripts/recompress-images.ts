import 'dotenv/config'
import sharp from 'sharp'
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { Storage } from '@google-cloud/storage'

const MAX_WIDTH = 1024
const THUMB_WIDTH = 300
const JPEG_QUALITY = 70
const BUCKET_NAME = process.env.GCS_BUCKET_NAME || 'stuffy-uploads'
const CONCURRENCY = 5

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
}

const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)
const storage = new Storage({
  projectId: serviceAccount.projectId as string,
  credentials: {
    client_email: serviceAccount.clientEmail as string,
    private_key: serviceAccount.privateKey as string,
  },
})
const bucket = storage.bucket(BUCKET_NAME)

interface ImageRecord {
  storedFilename: string
  thumbnailFilename: string
  publicUrl: string
  thumbnailUrl: string
  mimeType: string
  size: number
  deleted?: boolean
}

const dryRun = process.argv.includes('--dry-run')
const limit = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '0', 10)
const skip = parseInt(process.argv.find(a => a.startsWith('--skip='))?.split('=')[1] || '0', 10)

async function recompressFile(gcsPath: string, maxWidth: number): Promise<{ buffer: Buffer; skipped: boolean }> {
  const file = bucket.file(gcsPath)
  const [exists] = await file.exists()
  if (!exists) {
    return { buffer: Buffer.alloc(0), skipped: true }
  }

  const [original] = await file.download()
  const recompressed = await sharp(original)
    .rotate()
    .resize(maxWidth, null, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  return { buffer: recompressed, skipped: false }
}

async function processItem(
  docId: string,
  images: ImageRecord[]
): Promise<{ savedBytes: number; processedCount: number }> {
  let savedBytes = 0
  let processedCount = 0
  const updatedImages: ImageRecord[] = []
  let changed = false

  for (const img of images) {
    if (img.deleted) {
      updatedImages.push(img)
      continue
    }

    const fullPath = `images/${img.storedFilename}`
    const thumbPath = `images/${img.thumbnailFilename}`

    let fullResult: { buffer: Buffer; skipped: boolean }
    let thumbResult: { buffer: Buffer; skipped: boolean }
    try {
      fullResult = await recompressFile(fullPath, MAX_WIDTH)
      thumbResult = await recompressFile(thumbPath, THUMB_WIDTH)
    } catch (err) {
      console.warn(`  ⚠ Skipping ${img.storedFilename}: ${(err as Error).message}`)
      updatedImages.push(img)
      continue
    }

    const { buffer: fullBuffer, skipped: fullSkipped } = fullResult
    const { buffer: thumbBuffer, skipped: thumbSkipped } = thumbResult

    if (fullSkipped && thumbSkipped) {
      updatedImages.push(img)
      continue
    }

    const oldSize = img.size
    const newSize = fullSkipped ? oldSize : fullBuffer.length
    savedBytes += oldSize - newSize
    processedCount++

    if (!dryRun) {
      if (!fullSkipped) {
        await bucket.file(fullPath).save(fullBuffer, {
          metadata: { contentType: 'image/jpeg' },
        })
      }
      if (!thumbSkipped) {
        await bucket.file(thumbPath).save(thumbBuffer, {
          metadata: { contentType: 'image/jpeg' },
        })
      }
    }

    updatedImages.push({
      ...img,
      size: newSize,
      mimeType: 'image/jpeg',
    })
    changed = true
  }

  if (changed && !dryRun) {
    await db.collection('items').doc(docId).update({ images: updatedImages })
  }

  return { savedBytes, processedCount }
}

async function main() {
  console.log(dryRun ? '=== DRY RUN ===' : '=== RECOMPRESSING IMAGES ===')
  console.log(`Target: ${MAX_WIDTH}px, JPEG q${JPEG_QUALITY} mozjpeg`)
  if (limit) console.log(`Limit: ${limit} items`)
  if (skip) console.log(`Skipping first ${skip} items`)
  console.log()

  const snap = await db.collection('items').where('deleted', '==', false).get()

  let totalSaved = 0
  let totalProcessed = 0
  let itemIndex = 0

  const docs = snap.docs.slice(skip, limit ? skip + limit : undefined)
  const totalDocs = docs.length
  for (let i = 0; i < docs.length; i += CONCURRENCY) {
    const batch = docs.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (doc) => {
        const data = doc.data()
        const images = (data.images || []) as ImageRecord[]
        const activeImages = images.filter(img => !img.deleted)
        if (activeImages.length === 0) return { savedBytes: 0, processedCount: 0, name: data.name }

        const result = await processItem(doc.id, images)
        return { ...result, name: data.name }
      })
    )

    for (const r of results) {
      itemIndex++
      if (r.processedCount > 0) {
        totalSaved += r.savedBytes
        totalProcessed += r.processedCount
        const savedKB = (r.savedBytes / 1024).toFixed(0)
        console.log(`[${itemIndex}/${totalDocs}] ${r.name}: ${r.processedCount} image(s), ${savedKB} KB saved`)
      }
    }
  }

  console.log()
  console.log(`Done. ${totalProcessed} images recompressed.`)
  console.log(`Total saved: ${(totalSaved / 1024 / 1024).toFixed(1)} MB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
