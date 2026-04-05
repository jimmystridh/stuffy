'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, Loader2, X } from 'lucide-react'
import { checkItemIdExists, createItem, discardUploadedItemImage, uploadItemImage } from '@/app/actions/items'
import { getLocations } from '@/app/actions/locations'
import { TagInput } from '@/components/item/components/TagInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { prepareUploadImage } from '@/lib/client/prepare-upload-image'
import type { Location, UploadedImageFile } from '@/lib/types'

export function QuickAddForm() {
  const [locations, setLocations] = useState<Location[]>([])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [uploadedPhoto, setUploadedPhoto] = useState<UploadedImageFile | null>(null)
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showMoreFields, setShowMoreFields] = useState(false)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [idValidationStatus, setIdValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMountedRef = useRef(true)
  const uploadedPhotoRef = useRef<UploadedImageFile | null>(null)
  const photoUploadVersionRef = useRef(0)

  const isWorking = isPreparingPhoto || isUploadingPhoto || isSubmitting
  const trimmedId = id.trim()
  const canSubmit = !!photo && !!uploadedPhoto && !isPreparingPhoto && !isUploadingPhoto && !isSubmitting

  useEffect(() => {
    const load = async () => {
      const result = await getLocations()
      if (result.locations) setLocations(result.locations)
    }
    load()
  }, [])

  useEffect(() => {
    uploadedPhotoRef.current = uploadedPhoto
  }, [uploadedPhoto])

  useEffect(() => {
    if (!photo) {
      setPhotoPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(photo)
    setPhotoPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      photoUploadVersionRef.current += 1
      const pendingUpload = uploadedPhotoRef.current
      if (pendingUpload) {
        void discardUploadedItemImage(pendingUpload.storedFilename)
      }
    }
  }, [])

  const cleanupUploadedPhoto = (upload: UploadedImageFile | null) => {
    if (!upload) return
    void discardUploadedItemImage(upload.storedFilename)
  }

  const invalidatePhotoUpload = () => {
    photoUploadVersionRef.current += 1
    return photoUploadVersionRef.current
  }

  const clearPhotoState = ({
    cleanupUpload = true,
    clearInput = true,
  }: {
    cleanupUpload?: boolean
    clearInput?: boolean
  } = {}) => {
    const currentUpload = uploadedPhotoRef.current
    uploadedPhotoRef.current = null
    setPhoto(null)
    setUploadedPhoto(null)
    setIsUploadingPhoto(false)

    if (cleanupUpload) {
      cleanupUploadedPhoto(currentUpload)
    }

    if (clearInput && fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const resetForm = () => {
    invalidatePhotoUpload()
    clearPhotoState({ cleanupUpload: false })
    setId('')
    setName('')
    setTags([])
    setIdValidationStatus('idle')
  }

  const startPhotoUpload = async (file: File, uploadVersion: number) => {
    try {
      const formData = new FormData()
      formData.append('image', file)
      const result = await uploadItemImage(formData)
      const nextUploadedPhoto = result.uploadedImage ?? null

      if (!isMountedRef.current || uploadVersion !== photoUploadVersionRef.current) {
        cleanupUploadedPhoto(nextUploadedPhoto)
        return
      }

      if (result.error || !nextUploadedPhoto) {
        uploadedPhotoRef.current = null
        setUploadedPhoto(null)
        setMessage({ type: 'error', text: result.error || 'Failed to upload photo' })
        return
      }

      uploadedPhotoRef.current = nextUploadedPhoto
      setUploadedPhoto(nextUploadedPhoto)
    } catch {
      if (isMountedRef.current && uploadVersion === photoUploadVersionRef.current) {
        uploadedPhotoRef.current = null
        setUploadedPhoto(null)
        setMessage({ type: 'error', text: 'Failed to upload photo' })
      }
    } finally {
      if (isMountedRef.current && uploadVersion === photoUploadVersionRef.current) {
        setIsUploadingPhoto(false)
      }
    }
  }

  const handleCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const uploadVersion = invalidatePhotoUpload()
    setMessage(null)
    clearPhotoState({ clearInput: false })
    setIsPreparingPhoto(true)

    try {
      const preparedPhoto = await prepareUploadImage(file)
      if (!isMountedRef.current || uploadVersion !== photoUploadVersionRef.current) {
        return
      }

      setPhoto(preparedPhoto)
      setIsUploadingPhoto(true)
      void startPhotoUpload(preparedPhoto, uploadVersion)
    } finally {
      if (isMountedRef.current && uploadVersion === photoUploadVersionRef.current) {
        setIsPreparingPhoto(false)
      }
    }
  }

  const handleIdBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    if (isSubmitting) return

    const itemId = e.target.value.trim()
    if (!itemId) {
      setIdValidationStatus('idle')
      return
    }
    try {
      const exists = await checkItemIdExists(itemId)
      setIdValidationStatus(exists ? 'invalid' : 'valid')
    } catch {
      setIdValidationStatus('invalid')
    }
  }

  const getIdInputClassName = () => {
    const base = "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    switch (idValidationStatus) {
      case 'valid': return `${base} border-green-500`
      case 'invalid': return `${base} border-red-500`
      default: return base
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!photo || !uploadedPhoto || !canSubmit) return

    setIsSubmitting(true)
    setMessage(null)
    try {
      if (trimmedId) {
        const exists = await checkItemIdExists(trimmedId)
        if (exists) {
          setMessage({ type: 'error', text: 'Item ID already exists' })
          return
        }
      }

      const formData = new FormData()
      formData.append('itemId', trimmedId)
      formData.append('name', name.trim())
      formData.append('uploadedImages', JSON.stringify(uploadedPhoto))
      if (locationId) formData.append('locationId', locationId)
      tags.forEach((tag, index) => {
        formData.append(`tags[${index}]`, tag)
      })

      const result = await createItem(formData)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setMessage({
        type: 'success',
        text: trimmedId
          ? `Item ${trimmedId} added successfully.`
          : `${result.item?.name || 'Item'} added successfully.`,
      })
      resetForm()
    } catch {
      setMessage({ type: 'error', text: 'Failed to save item' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={isWorking}>
      {isWorking && (
        <div
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {isSubmitting
            ? 'Adding item. Fields are locked until it finishes.'
            : isPreparingPhoto
              ? 'Processing photo...'
              : 'Uploading photo in the background. You can keep filling out the form.'}
        </div>
      )}
      {message && (
        <div className={`p-3 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}
      <fieldset disabled={isSubmitting} className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col items-center gap-2">
          {photo ? (
            <div className="relative w-full">
              {photoPreviewUrl && (
                <Image
                  src={photoPreviewUrl}
                  alt="Captured item"
                  width={1024}
                  height={1024}
                  unoptimized
                  className="h-64 w-full rounded-lg object-cover"
                />
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 rounded-full"
                onClick={() => {
                  invalidatePhotoUpload()
                  clearPhotoState()
                }}
                disabled={isPreparingPhoto || isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex h-64 w-full items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-800">
              <Camera className="h-12 w-12 text-gray-400" />
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleCapture}
            className="hidden"
            ref={fileInputRef}
            disabled={isPreparingPhoto || isSubmitting}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
            disabled={isPreparingPhoto || isSubmitting}
          >
            {isPreparingPhoto ? 'Processing Photo...' : photo ? 'Retake Photo' : 'Take Photo'}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="item-id">Item ID (optional)</Label>
          <Input
            id="item-id"
            type="text"
            placeholder="Leave blank if you do not use item IDs"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onBlur={handleIdBlur}
            className={getIdInputClassName()}
            disabled={isSubmitting}
          />
          {idValidationStatus === 'invalid' && (
            <p className="mt-1 text-sm text-red-500">This ID is already taken or invalid</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label>Location</Label>
          <Select
            value={locationId || 'null'}
            onValueChange={(v) => setLocationId(v === 'null' ? null : v)}
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="null">No Location</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => setShowMoreFields((current) => !current)}
          disabled={isSubmitting}
        >
          {showMoreFields ? 'Hide Extra Fields' : 'Add More Fields'}
        </Button>
        {showMoreFields && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="item-name">Title</Label>
              <Input
                id="item-name"
                type="text"
                placeholder="Defaults to Untitled item if left blank"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tags</Label>
              <TagInput
                tags={tags}
                onTagsChange={setTags}
                disabled={isSubmitting}
              />
            </div>
          </>
        )}
        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Item...
            </>
          ) : isPreparingPhoto ? (
            'Processing Photo...'
          ) : isUploadingPhoto ? (
            'Uploading Photo...'
          ) : (
            'Add Item'
          )}
        </Button>
      </fieldset>
    </form>
  )
}
