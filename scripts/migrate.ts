/**
 * Migration script: Import data from PostgreSQL backup into Firestore and upload images to GCS.
 *
 * Usage:
 *   npx tsx scripts/migrate.ts
 *
 * Requires:
 *   - .env.local with Firebase Admin + GCS credentials
 *   - ../stuff-tracker/stufftracker_backup.sql
 *   - ../stuff-tracker/uploads/ directory with image files
 */

import * as fs from 'fs'
import * as path from 'path'
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { Storage } from '@google-cloud/storage'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

const serviceAccount: ServiceAccount = {
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
  clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
  privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY!.replace(/\\n/g, '\n'),
}

const app = initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore(app)
const storage = new Storage({
  projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
  credentials: {
    client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
})
const bucketName = process.env.GCS_BUCKET_NAME || 'stuffy-uploads'
const bucket = storage.bucket(bucketName)

const SQL_FILE = path.resolve(__dirname, '../../stuff-tracker/stufftracker_backup.sql')
const UPLOADS_DIR = path.resolve(__dirname, '../../stuff-tracker/uploads')

interface PgLocation {
  id: number
  name: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

interface PgItem {
  id: number
  itemId: string
  name: string
  notes: string | null
  purchasePrice: string | null
  acquisitionDate: string | null
  locationId: number | null
  tags: string[]
  createdAt: string
  updatedAt: string
  deleted: boolean
  deletedAt: string | null
}

interface PgItemImage {
  id: number
  itemId: number
  filename: string
  storedFilename: string
  thumbnailFilename: string
  publicUrl: string
  thumbnailUrl: string
  mimeType: string
  size: number
  createdAt: string
  deleted: boolean
  deletedAt: string | null
}

function parseCopyData(sql: string, tableName: string): string[][] {
  const regex = new RegExp(`COPY public\\."${tableName}" \\([^)]+\\) FROM stdin;\n([\\s\\S]*?)\n\\\\.`, 'm')
  const match = sql.match(regex)
  if (!match) return []
  return match[1].trim().split('\n').map(line => line.split('\t'))
}

function parseNull(val: string): string | null {
  return val === '\\N' ? null : val
}

function parseBool(val: string): boolean {
  return val === 't'
}

function parsePgArray(val: string): string[] {
  if (val === '{}' || val === '\\N') return []
  // Format: {tag1,tag2,tag3}
  return val.slice(1, -1).split(',').filter(Boolean)
}

async function uploadImage(filename: string): Promise<boolean> {
  const localPath = path.resolve(UPLOADS_DIR, filename)
  if (!fs.existsSync(localPath)) {
    console.warn(`  File not found: ${filename}`)
    return false
  }

  const stat = fs.statSync(localPath)
  if (stat.size === 0) {
    console.warn(`  Skipping empty file: ${filename}`)
    return false
  }

  const destination = `images/${filename}`
  try {
    await bucket.upload(localPath, {
      destination,
      metadata: { contentType: 'image/jpeg' },
    })
    await bucket.file(destination).makePublic()
    return true
  } catch (err) {
    console.error(`  Failed to upload ${filename}:`, err)
    return false
  }
}

async function main() {
  console.log('Reading SQL backup...')
  const sql = fs.readFileSync(SQL_FILE, 'utf-8')

  // Parse locations
  console.log('\n=== Migrating Locations ===')
  const locationRows = parseCopyData(sql, 'Location')
  const pgIdToFirestoreId: Record<number, string> = {}
  const locationMap: Record<number, { id: string; name: string; notes: string | null; createdAt: string; updatedAt: string }> = {}

  for (const row of locationRows) {
    const loc: PgLocation = {
      id: parseInt(row[0]),
      name: row[1],
      notes: parseNull(row[2]),
      createdAt: row[3],
      updatedAt: row[4],
    }

    const ref = db.collection('locations').doc()
    await ref.set({
      name: loc.name,
      notes: loc.notes,
      createdAt: new Date(loc.createdAt).toISOString(),
      updatedAt: new Date(loc.updatedAt).toISOString(),
    })

    pgIdToFirestoreId[loc.id] = ref.id
    locationMap[loc.id] = {
      id: ref.id,
      name: loc.name,
      notes: loc.notes,
      createdAt: new Date(loc.createdAt).toISOString(),
      updatedAt: new Date(loc.updatedAt).toISOString(),
    }
    console.log(`  Location "${loc.name}" -> ${ref.id}`)
  }

  // Parse images and build a map of pgItemId -> images
  console.log('\n=== Parsing Images ===')
  const imageRows = parseCopyData(sql, 'ItemImage')
  const imagesByPgItemId: Record<number, PgItemImage[]> = {}

  for (const row of imageRows) {
    const img: PgItemImage = {
      id: parseInt(row[0]),
      itemId: parseInt(row[1]),
      filename: row[2],
      storedFilename: row[3],
      thumbnailFilename: row[4],
      publicUrl: row[5],
      thumbnailUrl: row[6],
      mimeType: row[7],
      size: parseInt(row[8]),
      createdAt: row[9],
      deleted: parseBool(row[10]),
      deletedAt: parseNull(row[11]),
    }

    if (!imagesByPgItemId[img.itemId]) {
      imagesByPgItemId[img.itemId] = []
    }
    imagesByPgItemId[img.itemId].push(img)
  }
  console.log(`  Found ${imageRows.length} image records`)

  // Upload images to GCS
  console.log('\n=== Uploading Images to GCS ===')
  const allImageFiles = new Set<string>()
  for (const images of Object.values(imagesByPgItemId)) {
    for (const img of images) {
      allImageFiles.add(img.storedFilename)
      allImageFiles.add(img.thumbnailFilename)
    }
  }

  let uploaded = 0
  let skipped = 0
  for (const filename of allImageFiles) {
    const success = await uploadImage(filename)
    if (success) uploaded++
    else skipped++
  }
  console.log(`  Uploaded: ${uploaded}, Skipped: ${skipped}`)

  // Parse and migrate items
  console.log('\n=== Migrating Items ===')
  const itemRows = parseCopyData(sql, 'Item')
  let itemCount = 0

  for (const row of itemRows) {
    const item: PgItem = {
      id: parseInt(row[0]),
      itemId: row[1],
      name: row[2],
      notes: parseNull(row[3]),
      purchasePrice: parseNull(row[4]),
      acquisitionDate: parseNull(row[5]),
      locationId: row[6] !== '\\N' ? parseInt(row[6]) : null,
      tags: parsePgArray(row[7]),
      createdAt: row[8],
      updatedAt: row[9],
      deleted: parseBool(row[10]),
      deletedAt: parseNull(row[11]),
    }

    const ref = db.collection('items').doc()
    const pgImages = imagesByPgItemId[item.id] || []

    const images = pgImages.map((img, idx) => ({
      id: `${ref.id}_img_${idx}`,
      itemId: ref.id,
      filename: img.filename,
      storedFilename: img.storedFilename,
      thumbnailFilename: img.thumbnailFilename,
      publicUrl: `https://storage.googleapis.com/${bucketName}/images/${img.storedFilename}`,
      thumbnailUrl: `https://storage.googleapis.com/${bucketName}/images/${img.thumbnailFilename}`,
      mimeType: img.mimeType,
      size: img.size,
      createdAt: new Date(img.createdAt).toISOString(),
      deleted: img.deleted,
      deletedAt: img.deletedAt ? new Date(img.deletedAt).toISOString() : null,
    }))

    const location = item.locationId && locationMap[item.locationId]
      ? locationMap[item.locationId]
      : null

    await ref.set({
      itemId: item.itemId.toLowerCase(),
      name: item.name,
      notes: item.notes,
      purchasePrice: item.purchasePrice,
      acquisitionDate: item.acquisitionDate ? new Date(item.acquisitionDate).toISOString() : null,
      locationId: item.locationId ? pgIdToFirestoreId[item.locationId] || null : null,
      tags: item.tags,
      images,
      location,
      createdAt: new Date(item.createdAt).toISOString(),
      updatedAt: new Date(item.updatedAt).toISOString(),
      deleted: item.deleted,
      deletedAt: item.deletedAt ? new Date(item.deletedAt).toISOString() : null,
    })

    itemCount++
    if (itemCount % 50 === 0) {
      console.log(`  Migrated ${itemCount} items...`)
    }
  }

  console.log(`\n=== Migration Complete ===`)
  console.log(`  Locations: ${locationRows.length}`)
  console.log(`  Items: ${itemCount}`)
  console.log(`  Images uploaded: ${uploaded}`)
}

main().catch(console.error)
