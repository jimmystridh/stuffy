'use client'

import { useState } from 'react'
import { createItem, updateItem, checkItemIdExists } from '@/app/actions/items'
import type { ItemImage } from '@/lib/types'

interface ItemFormState {
  id: string
  itemId: string
  name: string
  notes: string
  purchasePrice: string
  acquisitionDate: Date | null
  tags: string[]
  images: (File | ItemImage)[]
  locationId: string | null
}

export const useItemForm = (isNewItem: boolean) => {
  const [item, setItem] = useState<ItemFormState>({
    id: '',
    itemId: '',
    name: '',
    notes: '',
    purchasePrice: '',
    acquisitionDate: null,
    tags: [],
    images: [],
    locationId: null,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [idValidationStatus, setIdValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setItem({ ...item, [e.target.name]: e.target.value })
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setItem({ ...item, acquisitionDate: date })
    }
  }

  const handleLocationChange = (locationId: string) => {
    setItem(prev => ({
      ...prev,
      locationId: locationId === 'null' ? null : locationId
    }))
  }

  const handleIdBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
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
      setError('Failed to validate ID')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setIsSaving(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('itemId', item.itemId)
      formData.append('name', item.name)
      formData.append('notes', item.notes || '')
      if (item.purchasePrice) {
        formData.append('purchasePrice', item.purchasePrice)
      }
      if (item.acquisitionDate) {
        formData.append('acquisitionDate', item.acquisitionDate.toISOString())
      }
      if (item.locationId) {
        formData.append('locationId', item.locationId)
      }
      item.tags.forEach((tag, index) => {
        formData.append(`tags[${index}]`, tag)
      })

      const fileImages = item.images.filter((img): img is File => img instanceof File)
      fileImages.forEach((file) => {
        formData.append('images', file)
      })

      const result = isNewItem
        ? await createItem(formData)
        : await updateItem(item.id, formData)

      if (result.error) {
        setError(result.error)
        return
      }

      if (isNewItem) {
        const currentLocationId = item.locationId
        setItem({
          id: '',
          itemId: '',
          name: '',
          notes: '',
          purchasePrice: '',
          acquisitionDate: null,
          tags: [],
          images: [],
          locationId: currentLocationId
        })
        setIdValidationStatus('idle')
      }
    } catch (err) {
      console.error('Form submission error:', err)
      setError('Failed to save item')
    } finally {
      setIsSaving(false)
    }
  }

  return {
    item,
    setItem,
    isSaving,
    idValidationStatus,
    error,
    handleInputChange,
    handleDateSelect,
    handleLocationChange,
    handleIdBlur,
    handleSubmit,
  }
}
