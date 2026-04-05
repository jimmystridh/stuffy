'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import Image from 'next/image'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { Item } from '@/lib/types'

const CARD_ROW_ESTIMATE = 420
const LIST_ROW_ESTIMATE = 84

interface VirtualizedItemCollectionProps {
  itemsByIndex: Array<Item | undefined>
  totalItems: number
  viewMode: 'card' | 'list'
  onItemClick: (id: string, index: number) => void
  onVisibleRangeChange: (startIndex: number, endIndex: number) => void
  restoreIndex?: number
  restoreKey?: string | null
}

function CardPlaceholder() {
  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square animate-pulse bg-gray-200" />
      <CardContent className="p-4">
        <div className="mb-2 h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mb-2 h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-5 w-14 animate-pulse rounded-full bg-gray-200" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" />
        </div>
      </CardContent>
    </Card>
  )
}

function ListPlaceholderRow() {
  return (
    <div className="grid grid-cols-[72px_minmax(180px,1.4fr)_minmax(110px,0.9fr)_minmax(140px,1fr)_minmax(140px,0.9fr)_minmax(120px,0.8fr)_minmax(220px,1.2fr)] items-center gap-x-4 border-x border-b bg-background px-4 py-3">
      <div className="h-[50px] w-[50px] animate-pulse rounded-full bg-gray-200" />
      <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
      <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
    </div>
  )
}

export function VirtualizedItemCollection({
  itemsByIndex,
  totalItems,
  viewMode,
  onItemClick,
  onVisibleRangeChange,
  restoreIndex = -1,
  restoreKey = null,
}: VirtualizedItemCollectionProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const lastRestoreKeyRef = useRef<string | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === 'undefined' ? 0 : window.innerWidth
  )

  const columns = viewMode === 'card'
    ? viewportWidth >= 1024
      ? 3
      : viewportWidth >= 640
        ? 2
        : 1
    : 1

  const rowCount = viewMode === 'card'
    ? Math.ceil(totalItems / columns)
    : totalItems

  const rowVirtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: rowCount,
    estimateSize: () => viewMode === 'card' ? CARD_ROW_ESTIMATE : LIST_ROW_ESTIMATE,
    overscan: viewMode === 'card' ? 2 : 6,
    scrollMargin,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const reportVisibleRange = useEffectEvent((startIndex: number, endIndex: number) => {
    onVisibleRangeChange(startIndex, endIndex)
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const updateMeasurements = () => {
      setViewportWidth(window.innerWidth)

      if (containerRef.current) {
        setScrollMargin(containerRef.current.getBoundingClientRect().top + window.scrollY)
      }
    }

    updateMeasurements()
    window.addEventListener('resize', updateMeasurements)

    return () => {
      window.removeEventListener('resize', updateMeasurements)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !containerRef.current) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      if (containerRef.current) {
        setScrollMargin(containerRef.current.getBoundingClientRect().top + window.scrollY)
      }
    })

    return () => {
      window.cancelAnimationFrame(frame)
    }
  }, [columns, rowCount, viewMode])

  useEffect(() => {
    if (totalItems === 0 || virtualRows.length === 0) {
      return
    }

    const startRow = virtualRows[0]
    const endRow = virtualRows[virtualRows.length - 1]
    const startIndex = startRow.index * columns
    const endIndex = Math.min(totalItems - 1, ((endRow.index + 1) * columns) - 1)

    reportVisibleRange(startIndex, endIndex)
  }, [columns, totalItems, virtualRows])

  useEffect(() => {
    lastRestoreKeyRef.current = null
  }, [restoreKey, viewMode])

  useEffect(() => {
    if (!restoreKey || restoreIndex < 0 || restoreIndex >= totalItems) {
      return
    }

    const appliedRestoreKey = `${restoreKey}:${columns}`
    if (lastRestoreKeyRef.current === appliedRestoreKey) {
      return
    }

    rowVirtualizer.scrollToIndex(Math.floor(restoreIndex / columns), { align: 'center' })
    lastRestoreKeyRef.current = appliedRestoreKey
  }, [columns, restoreIndex, restoreKey, rowVirtualizer, totalItems])

  if (totalItems === 0) {
    return null
  }

  if (viewMode === 'list') {
    return (
      <div className="overflow-x-auto">
        <div className="grid min-w-[980px] grid-cols-[72px_minmax(180px,1.4fr)_minmax(110px,0.9fr)_minmax(140px,1fr)_minmax(140px,0.9fr)_minmax(120px,0.8fr)_minmax(220px,1.2fr)] items-center gap-x-4 rounded-t-xl border bg-muted/40 px-4 py-3 text-sm font-medium text-muted-foreground">
          <div>Image</div>
          <div>Name</div>
          <div>ID</div>
          <div>Location</div>
          <div>Date Created</div>
          <div>Price</div>
          <div>Tags</div>
        </div>

        <div
          ref={containerRef}
          className="relative min-w-[980px]"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {virtualRows.map((virtualRow) => {
            const item = itemsByIndex[virtualRow.index]

            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
              >
                {item ? (
                  <div
                    className="grid cursor-pointer grid-cols-[72px_minmax(180px,1.4fr)_minmax(110px,0.9fr)_minmax(140px,1fr)_minmax(140px,0.9fr)_minmax(120px,0.8fr)_minmax(220px,1.2fr)] items-center gap-x-4 border-x border-b bg-background px-4 py-3 transition-colors duration-200 hover:bg-muted/40"
                    onClick={() => onItemClick(item.id, virtualRow.index)}
                  >
                    <div className="relative h-[50px] w-[50px]">
                      {item.images[0]?.thumbnailUrl ? (
                        <Image
                          src={item.images[0].thumbnailUrl}
                          alt={item.name}
                          fill
                          sizes="50px"
                          style={{ objectFit: 'cover' }}
                          className="rounded-full"
                        />
                      ) : (
                        <div className="h-full w-full rounded-full bg-gray-200 dark:bg-gray-700" />
                      )}
                    </div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-500">{item.itemId || 'No ID'}</div>
                    <div>{item.location?.name || 'Unassigned'}</div>
                    <div className="text-sm">{new Date(item.createdAt).toLocaleDateString()}</div>
                    <div className="font-semibold">{item.purchasePrice ? `$${item.purchasePrice}` : ''}</div>
                    <div className="flex flex-wrap gap-1 py-1">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <ListPlaceholderRow />
                )}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
    >
      {virtualRows.map((virtualRow) => {
        const rowIndexes = Array.from(
          { length: columns },
          (_, offset) => (virtualRow.index * columns) + offset
        ).filter((index) => index < totalItems)

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="absolute left-0 top-0 grid w-full gap-6"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            {rowIndexes.map((index) => {
              const item = itemsByIndex[index]

              if (!item) {
                return <CardPlaceholder key={`placeholder-${index}`} />
              }

              return (
                <Card
                  key={item.id}
                  className="cursor-pointer overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
                  onClick={() => onItemClick(item.id, index)}
                >
                  <div className="relative aspect-square">
                    {item.images[0]?.thumbnailUrl ? (
                      <Image
                        src={item.images[0].thumbnailUrl}
                        alt={item.name}
                        fill
                        priority={index < 9}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        style={{ objectFit: 'cover' }}
                        className="transition-transform duration-300 hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-200 text-gray-400 dark:bg-gray-700">
                        No image
                      </div>
                    )}
                  </div>

                  <CardContent className="p-4">
                    <p className="mb-2 text-sm text-gray-500">ID: {item.itemId || 'No ID'}</p>
                    <p className="mb-2 text-sm font-semibold">{item.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="rounded-full text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
