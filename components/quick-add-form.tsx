'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Camera, Loader2, X } from 'lucide-react'
import { createItem, checkItemIdExists } from '@/app/actions/items'
import { getLocations } from '@/app/actions/locations'
import { TagInput } from '@/components/item/components/TagInput'
import { prepareUploadImage } from '@/lib/client/prepare-upload-image'
import type { Location } from '@/lib/types'

export function QuickAddForm() {
  const [locations, setLocations] = useState<Location[]>([])
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [id, setId] = useState('')
  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [showMoreFields, setShowMoreFields] = useState(false)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [idValidationStatus, setIdValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isBusy = isPreparingPhoto || isSubmitting

  useEffect(() => {
    const load = async () => {
      const result = await getLocations()
      if (result.locations) setLocations(result.locations)
    }
    load()
  }, [])

  useEffect(() => {
    if (!photo) {
      setPhotoPreviewUrl(null)
      return
    }
    const objectUrl = URL.createObjectURL(photo)
    setPhotoPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  const resetForm = () => {
    setPhoto(null)
    setId('')
    setName('')
    setTags([])
    setIdValidationStatus('idle')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setMessage(null)
    setIsPreparingPhoto(true)

    try {
      const preparedPhoto = await prepareUploadImage(file)
      setPhoto(preparedPhoto)
    } finally {
      setIsPreparingPhoto(false)
    }
  }

  const handleIdBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    if (isBusy) return

    const itemId = e.target.value.trim()
    if (!itemId) {
      setIdValidationStatus('invalid')
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
    if (!photo || !id || isBusy) return

    setIsSubmitting(true)
    setMessage(null)
    try {
      const exists = await checkItemIdExists(id)
      if (exists) {
        setMessage({ type: 'error', text: 'Item ID already exists' })
        return
      }

      const formData = new FormData()
      formData.append('itemId', id)
      formData.append('name', name.trim() || id)
      formData.append('images', photo)
      if (locationId) formData.append('locationId', locationId)
      tags.forEach((tag, index) => {
        formData.append(`tags[${index}]`, tag)
      })

      const result = await createItem(formData)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
        return
      }

      setMessage({ type: 'success', text: `Item ${id} added successfully.` })
      resetForm()
    } catch {
      setMessage({ type: 'error', text: 'Failed to save item' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={isBusy}>
      {isBusy && (
        <div
          className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {isSubmitting ? 'Adding item. Fields are locked until it finishes.' : 'Processing photo...'}
        </div>
      )}
      {message && (
        <div className={`p-3 rounded-md ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </div>
      )}
      <fieldset disabled={isBusy} className="flex min-w-0 flex-col gap-4">
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
                  className="w-full h-64 object-cover rounded-lg"
                />
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 rounded-full"
                onClick={() => {
                  setPhoto(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                disabled={isBusy}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="w-full h-64 bg-gray-200 dark:bg-gray-800 rounded-lg flex items-center justify-center">
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
            disabled={isBusy}
          />
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full"
            disabled={isBusy}
          >
            {isPreparingPhoto ? 'Processing Photo...' : photo ? 'Retake Photo' : 'Take Photo'}
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="item-id">Item ID</Label>
          <Input
            id="item-id"
            type="text"
            placeholder="Enter item ID"
            value={id}
            onChange={(e) => setId(e.target.value)}
            onBlur={handleIdBlur}
            className={getIdInputClassName()}
            required
            disabled={isBusy}
          />
          {idValidationStatus === 'invalid' && (
            <p className="text-sm text-red-500 mt-1">This ID is already taken or invalid</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label>Location</Label>
          <Select
            value={locationId || 'null'}
            onValueChange={(v) => setLocationId(v === 'null' ? null : v)}
            disabled={isBusy}
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
          disabled={isBusy}
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
                placeholder="Defaults to the item ID"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isBusy}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tags</Label>
              <TagInput
                tags={tags}
                onTagsChange={setTags}
                disabled={isBusy}
              />
            </div>
          </>
        )}
        <Button type="submit" className="w-full" disabled={!photo || !id || isBusy}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Adding Item...
            </>
          ) : isPreparingPhoto ? (
            'Processing Photo...'
          ) : (
            'Add Item'
          )}
        </Button>
      </fieldset>
    </form>
  )
}
