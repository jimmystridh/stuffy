'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { getLocationById } from '@/app/actions/locations'
import { getItemsByLocationId } from '@/app/actions/items'
import type { Item, ItemImage, Location } from '@/lib/types'

interface CollageViewProps {
  locationId: string
}

export function CollageView({ locationId }: CollageViewProps) {
  const [location, setLocation] = useState<Location | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [status, setStatus] = useState<'loading' | 'idle' | 'error'>('loading')
  const [thumbnailSize, setThumbnailSize] = useState(120)

  useEffect(() => {
    async function load() {
      const [locationResult, itemsResult] = await Promise.all([
        getLocationById(locationId),
        getItemsByLocationId(locationId),
      ])

      if (locationResult.error || !locationResult.location) {
        setStatus('error')
        return
      }

      setLocation(locationResult.location)
      setItems(itemsResult.items)
      setStatus('idle')
    }
    load()
  }, [locationId])

  const allImages = useMemo(() => {
    const result: { image: ItemImage; item: Item }[] = []
    for (const item of items) {
      for (const image of item.images) {
        result.push({ image, item })
      }
    }
    return result
  }, [items])

  if (status === 'loading') {
    return (
      <div className="container mx-auto p-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-4" />
        <div className="grid gap-0" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))` }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (status === 'error' || !location) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-muted-foreground">Location not found.</p>
        <Link href="/locations">
          <Button variant="outline" size="sm" className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Locations
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{location.name}</h1>
        <Link href="/locations">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Locations
          </Button>
        </Link>
      </div>

      <p className="mb-2 text-sm text-muted-foreground">
        {items.length} {items.length === 1 ? 'item' : 'items'}, {allImages.length} {allImages.length === 1 ? 'photo' : 'photos'}
      </p>

      <div className="sticky top-0 md:top-16 z-10 bg-background/80 backdrop-blur-sm py-3 mb-2">
        <div className="flex items-center gap-4 max-w-xs">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Size</span>
          <Slider
            min={60}
            max={300}
            step={10}
            defaultValue={[thumbnailSize]}
            onValueChange={([value]) => setThumbnailSize(value)}
          />
        </div>
      </div>

      {allImages.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center">No photos at this location.</p>
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${thumbnailSize}px, 1fr))`,
            gap: 0,
          }}
        >
          {allImages.map(({ image, item }) => (
            <Link key={image.id} href={`/item/${item.id}/view`}>
              <div className="relative aspect-square overflow-hidden">
                <Image
                  src={image.thumbnailUrl}
                  alt={item.name}
                  fill
                  sizes={`${thumbnailSize * 2}px`}
                  className="object-cover"
                />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
