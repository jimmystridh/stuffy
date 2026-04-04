'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Check, X, ArrowLeft, ArrowRight, List, Play, CheckCircle2 } from 'lucide-react'
import { getLocations } from '@/app/actions/locations'
import {
  startInventering,
  getInventeringItems,
  markItem,
  completeInventering,
  type InventeringSession,
} from '@/app/actions/inventering'
import type { Location, Item } from '@/lib/types'
import { Suspense } from 'react'

function InventeringContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [session, setSession] = useState<InventeringSession | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'guided' | 'list'>(
    (searchParams.get('mode') as 'guided' | 'list') || 'guided'
  )
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getLocations().then(res => {
      if (res.locations) setLocations(res.locations)
    })
  }, [])

  const handleStart = async () => {
    if (!selectedLocationId) return
    setLoading(true)
    const result = await startInventering(selectedLocationId)
    if (result.session) {
      setSession(result.session)
      const itemList = await getInventeringItems(selectedLocationId)
      setItems(itemList)
      setCurrentIndex(0)
    }
    setLoading(false)
  }

  const handleMark = async (itemId: string, status: 'found' | 'missing') => {
    if (!session) return
    await markItem(session.id, itemId, status)
    setSession(prev => prev ? {
      ...prev,
      results: { ...prev.results, [itemId]: status },
      checkedItems: Object.keys({ ...prev.results, [itemId]: status }).length,
    } : null)

    // In guided mode, advance to next unchecked item
    if (viewMode === 'guided') {
      const nextUnchecked = items.findIndex(
        (item, i) => i > currentIndex && !session.results[item.id] && item.id !== itemId
      )
      if (nextUnchecked >= 0) {
        setCurrentIndex(nextUnchecked)
      } else {
        // Try from beginning
        const fromStart = items.findIndex(
          item => !session.results[item.id] && item.id !== itemId
        )
        if (fromStart >= 0) {
          setCurrentIndex(fromStart)
        } else {
          // All done — advance past last to show completion
          setCurrentIndex(items.length)
        }
      }
    }
  }

  const handleComplete = async () => {
    if (!session) return
    await completeInventering(session.id)
    setSession(prev => prev ? { ...prev, completedAt: new Date().toISOString() } : null)
  }

  const allChecked = session && items.length > 0 && Object.keys(session.results).length >= items.length
  const foundCount = session ? Object.values(session.results).filter(s => s === 'found').length : 0
  const missingCount = session ? Object.values(session.results).filter(s => s === 'missing').length : 0

  // Start screen — pick a location
  if (!session) {
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <h1 className="text-3xl font-bold mb-6">Inventering</h1>
        <Card>
          <CardHeader>
            <CardTitle>Start New Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Select a location to inventory. You&apos;ll go through each item and confirm whether it&apos;s still there.
              Items marked &quot;No&quot; will have their location cleared.
            </p>
            <Select value={selectedLocationId || ''} onValueChange={setSelectedLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'guided' ? 'default' : 'outline'}
                onClick={() => setViewMode('guided')}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Guided
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                onClick={() => setViewMode('list')}
                className="flex-1"
              >
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
            </div>
            <Button onClick={handleStart} disabled={!selectedLocationId || loading} className="w-full" size="lg">
              {loading ? 'Starting...' : 'Start Inventering'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Completion screen
  if (session.completedAt || (allChecked && viewMode === 'guided' && currentIndex >= items.length)) {
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <h1 className="text-3xl font-bold mb-6">Inventering Complete</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              {session.locationName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{foundCount}</p>
                <p className="text-sm text-muted-foreground">Found</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{missingCount}</p>
                <p className="text-sm text-muted-foreground">Missing</p>
              </div>
            </div>
            {!session.completedAt && (
              <Button onClick={handleComplete} className="w-full" size="lg">
                Finish & Save
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push('/')} className="w-full">
              Back to Inventory
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Guided mode
  if (viewMode === 'guided') {
    const item = items[currentIndex]
    if (!item) return null
    const status = session.results[item.id]

    return (
      <div className="container mx-auto p-4 max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">{session.locationName}</h1>
          <Badge variant="secondary">
            {Object.keys(session.results).length} / {items.length}
          </Badge>
        </div>

        <Card>
          <CardContent className="p-0">
            {item.images[0]?.thumbnailUrl ? (
              <div className="relative aspect-square">
                <Image
                  src={item.images[0].thumbnailUrl}
                  alt={item.name}
                  fill
                  className="object-cover rounded-t-lg"
                />
              </div>
            ) : (
              <div className="aspect-square bg-gray-200 dark:bg-gray-700 flex items-center justify-center rounded-t-lg text-gray-400">
                No image
              </div>
            )}
            <div className="p-4">
              <p className="text-sm text-muted-foreground">ID: {item.itemId}</p>
              <h2 className="text-xl font-semibold">{item.name}</h2>
              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-4">
          <Button
            variant={status === 'missing' ? 'destructive' : 'outline'}
            onClick={() => handleMark(item.id, 'missing')}
            className="flex-1 h-14 text-lg"
          >
            <X className="h-5 w-5 mr-2" />
            No
          </Button>
          <Button
            variant={status === 'found' ? 'default' : 'outline'}
            onClick={() => handleMark(item.id, 'found')}
            className="flex-1 h-14 text-lg"
          >
            <Check className="h-5 w-5 mr-2" />
            Yes
          </Button>
        </div>

        <div className="flex justify-between mt-4">
          <Button
            variant="ghost"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(i => i - 1)}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={currentIndex >= items.length - 1}
            onClick={() => setCurrentIndex(i => i + 1)}
          >
            Next
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    )
  }

  // List mode
  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">{session.locationName}</h1>
        <Badge variant="secondary">
          {Object.keys(session.results).length} / {items.length}
        </Badge>
      </div>

      {allChecked && (
        <Card className="mb-4 bg-green-50 dark:bg-green-950 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-700 dark:text-green-300">All items checked!</p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {foundCount} found, {missingCount} missing
              </p>
            </div>
            <Button onClick={handleComplete}>Finish</Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {items.map(item => {
          const status = session.results[item.id]
          return (
            <Card
              key={item.id}
              className={
                status === 'found' ? 'border-green-300 bg-green-50 dark:bg-green-950/30' :
                status === 'missing' ? 'border-red-300 bg-red-50 dark:bg-red-950/30' :
                ''
              }
            >
              <CardContent className="p-3 flex items-center gap-3">
                {item.images[0]?.thumbnailUrl ? (
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <Image
                      src={item.images[0].thumbnailUrl}
                      alt={item.name}
                      fill
                      className="object-cover rounded"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.itemId}</p>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant={status === 'missing' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => handleMark(item.id, 'missing')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={status === 'found' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleMark(item.id, 'found')}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default function InventeringPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <InventeringContent />
    </Suspense>
  )
}
