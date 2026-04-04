'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Trash2 } from 'lucide-react'
import { deleteItem, getItemByItemId } from '@/app/actions/items'
import type { Item } from '@/lib/types'

export function Page({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)

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

  const handleDelete = async () => {
    if (!item) return
    try {
      const result = await deleteItem(item.id)
      if (!result.error) {
        router.push('/')
      }
    } catch (error) {
      console.error('Delete error:', error)
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
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the item
                  and all associated images.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                  Delete
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
      </div>
    </div>
  )
}
