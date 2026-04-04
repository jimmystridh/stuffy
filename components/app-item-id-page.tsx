'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2 } from 'lucide-react'
import { getItemById, getItems } from '@/app/actions/items'
import { getLocations } from '@/app/actions/locations'
import { ItemHeader } from './item/components/ItemHeader'
import { FormFields } from './item/components/FormFields'
import { ImageUpload } from './item/components/ImageUpload'
import { TagInput } from './item/components/TagInput'
import { LocationSelect } from './item/components/LocationSelect'
import { useItemForm } from './item/hooks/useItemForm'
import { useItemNavigation } from './item/hooks/useItemNavigation'
import type { Location } from '@/lib/types'

export function Page({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams()
  const isNewItem = params.id === 'new'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalItems, setTotalItems] = useState(0)

  const {
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
  } = useItemForm(isNewItem)

  const {
    hasPrevious,
    hasNext,
    navigateToAdjacent,
    navigateBack
  } = useItemNavigation(totalItems)

  useEffect(() => {
    const loadData = async () => {
      if (isNewItem) {
        setIsLoading(false)
        return
      }

      try {
        const result = await getItemById(params.id)
        if (result.error || !result.item) {
          console.error(result.error)
          return
        }

        const acquisitionDate = result.item.acquisitionDate
          ? new Date(result.item.acquisitionDate)
          : null

        setItem({
          id: result.item.id,
          itemId: result.item.itemId,
          name: result.item.name,
          notes: result.item.notes || '',
          purchasePrice: result.item.purchasePrice?.toString() || '',
          acquisitionDate,
          tags: result.item.tags || [],
          images: result.item.images || [],
          locationId: result.item.locationId
        })

        const filterParams = {
          search: searchParams.get('q') || '',
          location: searchParams.get('location') || '',
          tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
          orderBy: {
            field: searchParams.get('sort') || 'name',
            direction: (searchParams.get('order') || 'asc') as 'asc' | 'desc'
          }
        }

        const itemsResult = await getItems(filterParams)
        setTotalItems(itemsResult.totalItems)
      } catch (err) {
        console.error('Failed to load item:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [params.id, searchParams, isNewItem, setItem])

  useEffect(() => {
    const loadLocations = async () => {
      const result = await getLocations()
      if (result.locations) {
        setLocations(result.locations)
      }
    }
    loadLocations()
  }, [])

  return (
    <div className="container mx-auto p-4">
      <ItemHeader
        isNewItem={isNewItem}
        hasPrevious={hasPrevious}
        hasNext={hasNext}
        onNavigateBack={navigateBack}
        onNavigateAdjacent={navigateToAdjacent}
      />

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <FormFields
          isLoading={isLoading}
          itemId={item.itemId}
          name={item.name}
          notes={item.notes}
          purchasePrice={item.purchasePrice}
          acquisitionDate={item.acquisitionDate}
          idValidationStatus={idValidationStatus}
          onInputChange={handleInputChange}
          onDateSelect={handleDateSelect}
          onIdBlur={handleIdBlur}
          disabled={isSaving}
        />

        <div>
          <Label>Location</Label>
          <LocationSelect
            locations={locations}
            value={item.locationId}
            onChange={handleLocationChange}
            disabled={isSaving}
          />
        </div>

        <div>
          <Label>Tags</Label>
          <TagInput
            tags={item.tags}
            onTagsChange={tags => setItem(prev => ({ ...prev, tags }))}
            disabled={isSaving}
          />
        </div>

        <div>
          <Label>Images</Label>
          <ImageUpload
            images={item.images}
            onImagesChange={images => setItem(prev => ({ ...prev, images }))}
            disabled={isSaving}
            fileInputRef={fileInputRef}
          />
        </div>

        <Button type="submit" disabled={isSaving} className="w-full">
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Item'
          )}
        </Button>
      </form>
    </div>
  )
}
