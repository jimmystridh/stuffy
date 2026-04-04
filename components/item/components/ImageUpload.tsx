'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { useImageHandling } from '../hooks/useImageHandling'
import type { ItemImage } from '@/lib/types'

interface ImageUploadProps {
  images: (File | ItemImage)[]
  onImagesChange: (newImages: (File | ItemImage)[]) => void
  disabled?: boolean
  fileInputRef?: React.RefObject<HTMLInputElement | null>
}

export function ImageUpload({
  images,
  onImagesChange,
  disabled,
  fileInputRef
}: ImageUploadProps) {
  const { imageUrls, handleImageUpload, handleRemoveImage } = useImageHandling(images)

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {imageUrls.map((url, index) => (
          <div key={url} className="relative aspect-square">
            <Image
              src={url}
              alt={`Item image ${index + 1}`}
              fill
              className="object-cover rounded-lg"
            />
            <Button
              variant="outline"
              size="icon"
              className="absolute top-2 right-2 h-6 w-6 bg-background/80"
              onClick={() => handleRemoveImage(index, onImagesChange)}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={e => handleImageUpload(e, onImagesChange)}
        disabled={disabled}
        className="block w-full text-sm text-slate-500
          file:mr-4 file:py-2 file:px-4
          file:rounded-full file:border-0
          file:text-sm file:font-semibold
          file:bg-violet-50 file:text-violet-700
          hover:file:bg-violet-100"
      />
    </div>
  )
}
