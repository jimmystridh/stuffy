'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArchiveRestore, PackageX } from 'lucide-react'
import { getRemovedItems, restoreItem } from '@/app/actions/items'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Item } from '@/lib/types'

function formatRemovedAt(item: Item) {
  if (!item.deletedAt) {
    return 'Unknown'
  }

  return new Date(item.deletedAt).toLocaleString()
}

export function Page() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadItems = async () => {
      const result = await getRemovedItems()
      if (cancelled) {
        return
      }

      if (result.error) {
        setError(result.error)
      } else {
        setItems(result.items)
      }

      setLoading(false)
    }

    void loadItems()

    return () => {
      cancelled = true
    }
  }, [])

  const handleRestore = async (itemId: string) => {
    setRestoringId(itemId)
    setError(null)

    try {
      const result = await restoreItem(itemId)
      if ('error' in result) {
        setError(result.error)
        return
      }

      setItems(currentItems => currentItems.filter(item => item.id !== itemId))
    } catch (restoreError) {
      console.error('Failed to restore item:', restoreError)
      setError('Failed to restore item')
    } finally {
      setRestoringId(current => current === itemId ? null : current)
    }
  }

  if (loading) {
    return <div className="container mx-auto p-4">Loading removed items...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Removed</h1>
          <p className="text-muted-foreground">
            Soft-deleted items stay here until you restore them.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Badge>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-100 p-3 text-red-700 dark:bg-red-900 dark:text-red-200">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <PackageX className="h-10 w-10 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Nothing is in Removed.</p>
              <p className="text-sm text-muted-foreground">
                Items you remove from inventory or stocktaking will show up here.
              </p>
            </div>
            <Link href="/">
              <Button>Back to Inventory</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map(item => (
            <Card key={item.id} className="overflow-hidden">
              <div className="relative aspect-[4/3]">
                {item.images[0]?.thumbnailUrl ? (
                  <Image
                    src={item.images[0].thumbnailUrl}
                    alt={item.name}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                    No image
                  </div>
                )}
              </div>
              <CardHeader className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{item.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">ID: {item.itemId || 'No ID'}</p>
                  </div>
                  <Badge variant="outline">Removed</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm">
                  <p><strong>Removed:</strong> {formatRemovedAt(item)}</p>
                  <p><strong>Stored location:</strong> {item.location?.name || 'Unassigned'}</p>
                  {item.notes && (
                    <p className="text-muted-foreground line-clamp-3">{item.notes}</p>
                  )}
                </div>

                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}

                <Button
                  onClick={() => handleRestore(item.id)}
                  disabled={restoringId === item.id}
                  className="w-full"
                >
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  {restoringId === item.id ? 'Restoring...' : 'Restore to Inventory'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
