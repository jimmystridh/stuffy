'use server'

import crypto from 'crypto'
import sharp from 'sharp'
import { bucket } from './firebase/storage'

const THUMBNAIL_WIDTH = 300
const MAX_IMAGE_WIDTH = 1280

export interface SavedFile {
  filename: string
  storedFilename: string
  thumbnailFilename: string
  publicUrl: string
  thumbnailUrl: string
  mimeType: string
  size: number
}

export async function saveFile(file: File): Promise<SavedFile> {
  const fileExtension = file.name.split('.').pop() || 'jpg'
  const uniqueId = crypto.randomBytes(16).toString('hex')
  const storedFilename = `${uniqueId}.${fileExtension}`
  const thumbnailFilename = `${uniqueId}_thumb.${fileExtension}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const image = sharp(buffer)
  const metadata = await image.metadata()

  // Process full image
  let fullBuffer: Buffer
  if (metadata.width && metadata.width > MAX_IMAGE_WIDTH) {
    fullBuffer = await image
      .rotate()
      .resize(MAX_IMAGE_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
      .toBuffer()
  } else {
    fullBuffer = await image.rotate().toBuffer()
  }

  // Process thumbnail
  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize(THUMBNAIL_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
    .toBuffer()

  // Upload full image to GCS
  const fullFile = bucket.file(`images/${storedFilename}`)
  await fullFile.save(fullBuffer, {
    metadata: { contentType: file.type },
  })
  await fullFile.makePublic()

  // Upload thumbnail to GCS
  const thumbFile = bucket.file(`images/${thumbnailFilename}`)
  await thumbFile.save(thumbBuffer, {
    metadata: { contentType: file.type },
  })
  await thumbFile.makePublic()

  const bucketName = process.env.GCS_BUCKET_NAME || 'stuffy-uploads'

  return {
    filename: file.name,
    storedFilename,
    thumbnailFilename,
    publicUrl: `https://storage.googleapis.com/${bucketName}/images/${storedFilename}`,
    thumbnailUrl: `https://storage.googleapis.com/${bucketName}/images/${thumbnailFilename}`,
    mimeType: file.type,
    size: file.size,
  }
}

export async function deleteFile(storedFilename: string) {
  try {
    await bucket.file(`images/${storedFilename}`).delete()
    const thumbnailFilename = storedFilename.replace('.', '_thumb.')
    await bucket.file(`images/${thumbnailFilename}`).delete().catch(() => {})
  } catch (error) {
    console.error('Error deleting file from GCS:', error)
  }
}
