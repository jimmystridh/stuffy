'use client'

import { useEffect, useMemo } from 'react'
import { prepareUploadImages } from '@/lib/client/prepare-upload-image'
import type { ItemImage } from '@/lib/types'

export const useImageHandling = (images: (File | ItemImage)[]) => {
  const imageUrls = useMemo(() => {
    return images.map(image => {
      if (image instanceof File) {
        return URL.createObjectURL(image)
      }
      return (image as ItemImage).thumbnailUrl || (image as ItemImage).publicUrl
    })
  }, [images])

  useEffect(() => {
    return () => {
      imageUrls.forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      })
    }
  }, [imageUrls])

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onUpdate: (newImages: (File | ItemImage)[]) => void
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files)
      const preparedFiles = await prepareUploadImages(files)
      onUpdate([...images, ...preparedFiles])
      e.target.value = ''
    }
  }

  const handleRemoveImage = (index: number, onUpdate: (newImages: (File | ItemImage)[]) => void) => {
    onUpdate(images.filter((_, i) => i !== index))
  }

  return {
    imageUrls,
    handleImageUpload,
    handleRemoveImage
  }
}
