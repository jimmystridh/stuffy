'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Loader2, Sparkles, Trash2 } from 'lucide-react'
import { getItemByItemId, refreshItemAi, removeItem } from '@/app/actions/items'
import type { Item } from '@/lib/types'

export function Page({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshingAi, setRefreshingAi] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    const loadItem = async () => {
      try {
        const result = await getItemByItemId(params.id)
        if (result.item) {
          setItem(result.item)
        }
      } catch {
        console.error('Failed to load item')
      } finally {
        setLoading(false)
      }
    }
    loadItem()
  }, [params.id])

  const handleRemove = async () => {
    if (!item) return
    setRemoving(true)
    try {
      const result = await removeItem(item.id)
      if ('success' in result) {
        router.push('/removed')
      }
    } catch (error) {
      console.error('Remove error:', error)
    } finally {
      setRemoving(false)
    }
  }

  const handleRefreshAi = async () => {
    if (!item) return

    setRefreshingAi(true)
    try {
      const result = await refreshItemAi(item.id)
      if (result.item) {
        setItem(result.item)
      }
    } catch (error) {
      console.error('AI refresh error:', error)
    } finally {
      setRefreshingAi(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  if (!item) {
    return <div className="flex justify-center items-center min-h-screen">Item not found</div>
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{item.name}</h1>
        <div className="flex gap-2">
          <Link href={`/item/${item.id}`} passHref>
            <Button>Edit Item</Button>
          </Link>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={removing}>
                {removing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Remove
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this item?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the item from active inventory and moves it into the soft-delete Removed trashcan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemove} className="bg-red-600 hover:bg-red-700">
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <p><strong>ID:</strong> {item.itemId}</p>
            <p><strong>Date Created:</strong> {new Date(item.createdAt).toLocaleDateString()}</p>
            <p><strong>Purchase Price:</strong> {item.purchasePrice ? `$${item.purchasePrice}` : 'N/A'}</p>
            <p><strong>Acquisition Date:</strong> {item.acquisitionDate ? new Date(item.acquisitionDate).toLocaleDateString() : 'N/A'}</p>
            <p><strong>Location:</strong> {item.location?.name || 'N/A'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{item.notes || 'No notes'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {item.tags.map(tag => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {item.images?.map((image, index) => (
                <div key={image.id} className="relative aspect-square">
                  <Image
                    src={image.publicUrl}
                    alt={`${item.name} - Image ${index + 1}`}
                    fill
                    className="object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle>AI Identification</CardTitle>
            <Button
              variant="outline"
              onClick={handleRefreshAi}
              disabled={refreshingAi || item.images.length === 0}
              className="gap-2"
            >
              {refreshingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {item.ai ? 'Refresh AI' : 'Analyze Images'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {item.ai ? (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Identified as</p>
                  <p className="font-semibold">{item.ai.analysis.identifiedName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Summary</p>
                  <p>{item.ai.analysis.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{item.ai.analysis.category}</Badge>
                  <Badge variant="outline">Confidence: {item.ai.analysis.confidence}</Badge>
                  <Badge variant="outline">
                    Indexed: {item.ai.imageEmbedding.dimensions}d
                  </Badge>
                </div>
                {item.ai.analysis.attributes.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Visible attributes</p>
                    <div className="flex flex-wrap gap-2">
                      {item.ai.analysis.attributes.map(attribute => (
                        <Badge key={attribute} variant="outline">{attribute}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {item.ai.analysis.suggestedTags.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Suggested tags</p>
                    <div className="flex flex-wrap gap-2">
                      {item.ai.analysis.suggestedTags.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No AI analysis has been generated for this item yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
