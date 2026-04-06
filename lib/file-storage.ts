'use server'

import crypto from 'crypto'
import sharp from 'sharp'
import { bucket } from './firebase/storage'
import type { UploadedImageFile } from './types'

const THUMBNAIL_WIDTH = 300
const MAX_IMAGE_WIDTH = 1024
const JPEG_QUALITY = 70

export type SavedFile = UploadedImageFile

export async function saveFile(file: File): Promise<SavedFile> {
  const uniqueId = crypto.randomBytes(16).toString('hex')
  const storedFilename = `${uniqueId}.jpg`
  const thumbnailFilename = `${uniqueId}_thumb.jpg`

  const buffer = Buffer.from(await file.arrayBuffer())

  const fullBuffer = await sharp(buffer)
    .rotate()
    .resize(MAX_IMAGE_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize(THUMBNAIL_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  const fullFile = bucket.file(`images/${storedFilename}`)
  await fullFile.save(fullBuffer, {
    metadata: { contentType: 'image/jpeg' },
  })

  const thumbFile = bucket.file(`images/${thumbnailFilename}`)
  await thumbFile.save(thumbBuffer, {
    metadata: { contentType: 'image/jpeg' },
  })

  const bucketName = process.env.GCS_BUCKET_NAME || 'stuffy-uploads'

  return {
    filename: file.name,
    storedFilename,
    thumbnailFilename,
    publicUrl: `https://storage.googleapis.com/${bucketName}/images/${storedFilename}`,
    thumbnailUrl: `https://storage.googleapis.com/${bucketName}/images/${thumbnailFilename}`,
    mimeType: 'image/jpeg',
    size: fullBuffer.length,
  }
}

export async function saveFileFromUrl(url: string): Promise<SavedFile> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch image from ${url}: ${response.status}`)

  const contentType = response.headers.get('content-type') || 'image/jpeg'
  const buffer = Buffer.from(await response.arrayBuffer())
  const urlPath = new URL(url).pathname
  const filename = urlPath.split('/').pop() || 'image.jpg'

  return saveFileFromBuffer(buffer, filename, contentType)
}

export async function saveFileFromBuffer(
  buffer: Buffer,
  filename: string,
  _mimeType: string
): Promise<SavedFile> {
  const uniqueId = crypto.randomBytes(16).toString('hex')
  const storedFilename = `${uniqueId}.jpg`
  const thumbnailFilename = `${uniqueId}_thumb.jpg`

  const fullBuffer = await sharp(buffer)
    .rotate()
    .resize(MAX_IMAGE_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize(THUMBNAIL_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer()

  const fullFile = bucket.file(`images/${storedFilename}`)
  await fullFile.save(fullBuffer, { metadata: { contentType: 'image/jpeg' } })

  const thumbFile = bucket.file(`images/${thumbnailFilename}`)
  await thumbFile.save(thumbBuffer, { metadata: { contentType: 'image/jpeg' } })

  const bucketName = process.env.GCS_BUCKET_NAME || 'stuffy-uploads'

  return {
    filename,
    storedFilename,
    thumbnailFilename,
    publicUrl: `https://storage.googleapis.com/${bucketName}/images/${storedFilename}`,
    thumbnailUrl: `https://storage.googleapis.com/${bucketName}/images/${thumbnailFilename}`,
    mimeType: 'image/jpeg',
    size: fullBuffer.length,
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
