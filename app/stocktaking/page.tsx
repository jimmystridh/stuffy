'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Check, X, ArrowLeft, ArrowRight, List, Play, CheckCircle2, Trash2 } from 'lucide-react'
import { getLocations } from '@/app/actions/locations'
import {
  startStocktaking,
  getStocktakingItems,
  markItem,
  completeStocktaking,
  type StocktakingSession,
} from '@/app/actions/stocktaking'
import type { Location, Item, StocktakingResultStatus } from '@/lib/types'

function getStatusCardClass(status?: StocktakingResultStatus) {
  if (status === 'found') {
    return 'border-green-300 bg-green-50 dark:bg-green-950/30'
  }
  if (status === 'missing') {
    return 'border-red-300 bg-red-50 dark:bg-red-950/30'
  }
  if (status === 'removed') {
    return 'border-amber-300 bg-amber-50 dark:bg-amber-950/30'
  }
  return ''
}

function getStatusButtonClass(status: StocktakingResultStatus, selectedStatus?: StocktakingResultStatus) {
  if (status !== selectedStatus) {
    return ''
  }

  if (status === 'found') {
    return 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/40 dark:text-green-300'
  }
  if (status === 'missing') {
    return 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
  }
  return 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
}

function SessionHeader({
  session,
  items,
  viewMode,
  onToggleMode,
}: {
  session: StocktakingSession
  items: Item[]
  viewMode: 'guided' | 'list'
  onToggleMode: () => void
}) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h1 className="text-xl font-bold">{session.locationName}</h1>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          {Object.keys(session.results).length} / {items.length}
        </Badge>
        <Button variant="ghost" size="icon" onClick={onToggleMode} title={viewMode === 'guided' ? 'Switch to list' : 'Switch to guided'}>
          {viewMode === 'guided' ? <List className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

export default function StocktakingPage() {
  const router = useRouter()
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null)
  const [session, setSession] = useState<StocktakingSession | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [viewMode, setViewMode] = useState<'guided' | 'list'>('guided')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getLocations().then(res => {
      if (res.locations) setLocations(res.locations)
    })
  }, [])

  const handleStart = async () => {
    if (!selectedLocationId) return
    setLoading(true)
    const result = await startStocktaking(selectedLocationId)
    if (result.session) {
      setSession(result.session)
      const itemList = await getStocktakingItems(selectedLocationId)
      setItems(itemList)
      setCurrentIndex(0)
    }
    setLoading(false)
  }

  const handleMark = async (itemId: string, status: StocktakingResultStatus) => {
    if (!session) return
    const result = await markItem(session.id, itemId, status)
    if (result.error) return
    const newResults = { ...session.results, [itemId]: status }
    setSession(prev => prev ? {
      ...prev,
      results: newResults,
      checkedItems: Object.keys(newResults).length,
    } : null)

    if (viewMode === 'guided') {
      const updatedResults = newResults
      const nextUnchecked = items.findIndex(
        (item, i) => i > currentIndex && !updatedResults[item.id]
      )
      if (nextUnchecked >= 0) {
        setCurrentIndex(nextUnchecked)
      } else {
        const fromStart = items.findIndex(item => !updatedResults[item.id])
        if (fromStart >= 0) {
          setCurrentIndex(fromStart)
        } else {
          setCurrentIndex(items.length)
        }
      }
    }
  }

  const handleComplete = async () => {
    if (!session) return
    await completeStocktaking(session.id)
    setSession(prev => prev ? { ...prev, completedAt: new Date().toISOString() } : null)
  }

  const toggleMode = () => setViewMode(m => m === 'guided' ? 'list' : 'guided')

  const allChecked = session && items.length > 0 && Object.keys(session.results).length >= items.length
  const foundCount = session ? Object.values(session.results).filter(s => s === 'found').length : 0
  const missingCount = session ? Object.values(session.results).filter(s => s === 'missing').length : 0
  const removedCount = session ? Object.values(session.results).filter(s => s === 'removed').length : 0

  if (!session) {
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <h1 className="text-3xl font-bold mb-6">Stocktaking</h1>
        <Card>
          <CardHeader>
            <CardTitle>Start New Session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Select a location for stocktaking. Go through each item and confirm whether it&apos;s still there.
              Missing items will have their location cleared, and Removed items will move into the soft-delete Removed trashcan.
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
            <Button onClick={handleStart} disabled={!selectedLocationId || loading} className="w-full" size="lg">
              {loading ? 'Starting...' : 'Start Stocktaking'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (session.completedAt || (allChecked && currentIndex >= items.length)) {
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <h1 className="text-3xl font-bold mb-6">Stocktaking Complete</h1>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              {session.locationName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-center sm:grid-cols-4">
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
              <div>
                <p className="text-2xl font-bold text-amber-600">{removedCount}</p>
                <p className="text-sm text-muted-foreground">Removed</p>
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

  if (viewMode === 'guided') {
    const item = items[currentIndex]
    if (!item) return null
    const status = session.results[item.id]

    return (
      <div className="container mx-auto p-4 max-w-lg">
        <SessionHeader session={session} items={items} viewMode={viewMode} onToggleMode={toggleMode} />

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
              <p className="text-sm text-muted-foreground">ID: {item.itemId || 'No ID'}</p>
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

        <div className="grid grid-cols-3 gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => handleMark(item.id, 'missing')}
            className={`h-14 text-base ${getStatusButtonClass('missing', status)}`}
          >
            <X className="h-5 w-5 mr-2" />
            Missing
          </Button>
          <Button
            variant="outline"
            onClick={() => handleMark(item.id, 'removed')}
            className={`h-14 text-base ${getStatusButtonClass('removed', status)}`}
          >
            <Trash2 className="h-5 w-5 mr-2" />
            Removed
          </Button>
          <Button
            variant="outline"
            onClick={() => handleMark(item.id, 'found')}
            className={`h-14 text-base ${getStatusButtonClass('found', status)}`}
          >
            <Check className="h-5 w-5 mr-2" />
            Found
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

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <SessionHeader session={session} items={items} viewMode={viewMode} onToggleMode={toggleMode} />

      {allChecked && (
        <Card className="mb-4 bg-green-50 dark:bg-green-950 border-green-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-700 dark:text-green-300">All items checked!</p>
              <p className="text-sm text-green-600 dark:text-green-400">
                {foundCount} found, {missingCount} missing, {removedCount} removed
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
              className={getStatusCardClass(status)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                {item.images[0]?.thumbnailUrl ? (
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <Image
                      src={item.images[0].thumbnailUrl}
                      alt={item.name}
                      fill
                      className="object-cover rounded"
                      sizes="80px"
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 flex-shrink-0 bg-gray-200 dark:bg-gray-700 rounded" />
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.itemId || 'No ID'}</p>
                </div>

                <div className="flex gap-1 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMark(item.id, 'missing')}
                    className={getStatusButtonClass('missing', status)}
                    aria-label={`Mark ${item.name} as missing`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMark(item.id, 'removed')}
                    className={getStatusButtonClass('removed', status)}
                    aria-label={`Mark ${item.name} as removed`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMark(item.id, 'found')}
                    className={getStatusButtonClass('found', status)}
                    aria-label={`Mark ${item.name} as found`}
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
