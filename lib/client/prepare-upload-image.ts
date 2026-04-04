'use client'

const MAX_IMAGE_DIMENSION = 1600
const TARGET_IMAGE_BYTES = 900 * 1024
const JPEG_QUALITY_STEPS = [0.86, 0.78, 0.7, 0.62, 0.55]

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error(`Failed to load image: ${file.name}`))
    }

    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create image blob'))
        return
      }
      resolve(blob)
    }, type, quality)
  })
}

function getOutputType(file: File) {
  return file.type === 'image/png' ? 'image/png' : 'image/jpeg'
}

function getOutputFilename(file: File, outputType: string) {
  if (outputType !== 'image/jpeg') {
    return file.name
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
  return `${baseName}.jpg`
}

export async function prepareUploadImage(file: File): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/')) {
    return file
  }

  try {
    const image = await loadImage(file)
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const didResize = width !== image.naturalWidth || height !== image.naturalHeight

    if (!didResize && file.size <= TARGET_IMAGE_BYTES) {
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const context = canvas.getContext('2d')
    if (!context) {
      return file
    }

    context.drawImage(image, 0, 0, width, height)

    const outputType = getOutputType(file)
    let blob = await canvasToBlob(canvas, outputType, outputType === 'image/jpeg' ? JPEG_QUALITY_STEPS[0] : undefined)

    if (outputType === 'image/jpeg') {
      for (const quality of JPEG_QUALITY_STEPS.slice(1)) {
        if (blob.size <= TARGET_IMAGE_BYTES) {
          break
        }

        blob = await canvasToBlob(canvas, outputType, quality)
      }
    }

    if (blob.size >= file.size) {
      return file
    }

    return new File(
      [blob],
      getOutputFilename(file, outputType),
      { type: outputType, lastModified: file.lastModified }
    )
  } catch (error) {
    console.warn('Falling back to original upload image:', error)
    return file
  }
}

export async function prepareUploadImages(files: File[]) {
  return Promise.all(files.map(file => prepareUploadImage(file)))
}
