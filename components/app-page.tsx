'use client'

import { startTransition, useEffect, useEffectEvent, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Search, SortAsc, SortDesc, Grid, List, Plus, Camera, Sparkles, Type, Zap } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { VirtualizedItemCollection } from '@/components/virtualized-item-collection'
import { getAllTags, getItems } from '@/app/actions/items'
import { getLocations } from '@/app/actions/locations'
import type { Item, Location, SearchMode } from '@/lib/types'

const ITEM_BATCH_SIZE = 36

function parseRestoreIndex(value: string | null) {
  if (value === null) return -1
  const parsedValue = Number.parseInt(value, 10)
  return Number.isNaN(parsedValue) ? -1 : parsedValue
}

function CardCollectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, index) => (
        <Card key={index} className="overflow-hidden">
          <div className="relative aspect-square animate-pulse bg-gray-200" />
          <CardContent className="p-4">
            <div className="mb-2 h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="mb-2 h-4 w-16 animate-pulse rounded bg-gray-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ListCollectionSkeleton() {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[980px] overflow-hidden rounded-xl border">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[72px_minmax(180px,1.4fr)_minmax(110px,0.9fr)_minmax(140px,1fr)_minmax(140px,0.9fr)_minmax(120px,0.8fr)_minmax(220px,1.2fr)] items-center gap-x-4 border-b px-4 py-3"
          >
            <div className="h-[50px] w-[50px] animate-pulse rounded-full bg-gray-200" />
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

function mergePageIntoCache(
  currentItems: Array<Item | undefined>,
  totalItems: number,
  page: number,
  pageItems: Item[]
) {
  const nextItems = Array.from({ length: totalItems }, (_, index) => currentItems[index])
  const startIndex = (page - 1) * ITEM_BATCH_SIZE
  pageItems.forEach((item, offset) => {
    const targetIndex = startIndex + offset
    if (targetIndex < totalItems) {
      nextItems[targetIndex] = item
    }
  })
  return nextItems
}

const SEARCH_MODE_CONFIG: Record<SearchMode, { icon: typeof Search; label: string; placeholder: string }> = {
  auto: { icon: Zap, label: 'Auto', placeholder: 'Search items (text + AI)...' },
  text: { icon: Type, label: 'Text', placeholder: 'Search by name, tags, notes...' },
  ai: { icon: Sparkles, label: 'AI', placeholder: 'Describe what you\'re looking for...' },
}

export function Page() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestVersionRef = useRef(0)
  const loadedPagesRef = useRef<Set<number>>(new Set())
  const loadingPagesRef = useRef<Set<number>>(new Set())

  const [itemsByIndex, setItemsByIndex] = useState<Array<Item | undefined>>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isFiltersLoading, setIsFiltersLoading] = useState(true)

  const searchTerm = searchParams.get('q') || ''
  const searchMode = (searchParams.get('mode') as SearchMode) || 'auto'
  const selectedTagsParam = searchParams.get('tags') || ''
  const selectedLocation = searchParams.get('location') || 'All'
  const selectedTags = selectedTagsParam ? selectedTagsParam.split(',').filter(Boolean) : []
  const sortBy = searchParams.get('sort') || 'name'
  const sortOrder = (searchParams.get('order') || 'asc') as 'asc' | 'desc'
  const viewMode = (searchParams.get('view') || 'card') as 'card' | 'list'
  const restoreIndex = parseRestoreIndex(searchParams.get('index'))
  const [searchInput, setSearchInput] = useState(searchTerm)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const filterSignature = [
    searchTerm,
    searchMode,
    selectedTagsParam,
    selectedLocation,
    sortBy,
    sortOrder,
  ].join('::')
  const restoreKey = restoreIndex >= 0 ? `${filterSignature}::${restoreIndex}` : null
  const loadedItemsCount = itemsByIndex.reduce((count, item) => count + (item ? 1 : 0), 0)

  useEffect(() => {
    setSearchInput(searchTerm)
  }, [searchTerm])

  useEffect(() => {
    let cancelled = false
    const loadFilters = async () => {
      try {
        const [tags, locationsResult] = await Promise.all([getAllTags(), getLocations()])
        if (cancelled) return
        setAllTags(tags)
        if (locationsResult.locations) setLocations(locationsResult.locations)
      } catch {
        console.error('Failed to load filters')
      } finally {
        if (!cancelled) setIsFiltersLoading(false)
      }
    }
    void loadFilters()
    return () => { cancelled = true }
  }, [])

  const loadPage = async (page: number) => {
    if (page < 1) return
    const requestVersion = requestVersionRef.current
    if (loadedPagesRef.current.has(page) || loadingPagesRef.current.has(page)) return
    loadingPagesRef.current.add(page)
    try {
      const itemsResult = await getItems({
        page,
        pageSize: ITEM_BATCH_SIZE,
        orderBy: { field: sortBy, direction: sortOrder },
        tags: selectedTags,
        search: searchTerm,
        searchMode,
        location: selectedLocation,
      })
      if (requestVersionRef.current !== requestVersion || itemsResult.error) return
      loadedPagesRef.current.add(page)
      setTotalItems(itemsResult.totalItems)
      setItemsByIndex((currentItems) =>
        mergePageIntoCache(currentItems, itemsResult.totalItems, page, itemsResult.items)
      )
    } catch {
      console.error('Failed to load items')
    } finally {
      if (requestVersionRef.current === requestVersion) {
        loadingPagesRef.current.delete(page)
        setIsLoading(false)
      }
    }
  }

  const loadPagesForRange = (startIndex: number, endIndex: number) => {
    if (totalItems === 0) return
    const lastIndex = Math.max(0, totalItems - 1)
    const clampedStart = Math.max(0, startIndex)
    const clampedEnd = Math.min(lastIndex, endIndex)
    const maxPage = Math.max(1, Math.ceil(totalItems / ITEM_BATCH_SIZE))
    const startPage = Math.max(1, Math.floor(clampedStart / ITEM_BATCH_SIZE) + 1)
    const endPage = Math.max(startPage, Math.floor(clampedEnd / ITEM_BATCH_SIZE) + 1)
    const preloadStart = Math.max(1, startPage - 1)
    const preloadEnd = Math.min(maxPage, endPage + 1)
    for (let page = preloadStart; page <= preloadEnd; page += 1) {
      void loadPage(page)
    }
  }

  const loadInitialPage = useEffectEvent((page: number) => {
    void loadPage(page)
  })

  useEffect(() => {
    requestVersionRef.current += 1
    loadedPagesRef.current = new Set()
    loadingPagesRef.current = new Set()
    setItemsByIndex([])
    setTotalItems(0)
    setIsLoading(true)
    if (restoreIndex < 0) {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
    const initialPage = Math.max(1, Math.floor(Math.max(restoreIndex, 0) / ITEM_BATCH_SIZE) + 1)
    const timeoutId = window.setTimeout(() => { loadInitialPage(initialPage) }, 100)
    return () => { window.clearTimeout(timeoutId) }
  }, [filterSignature, restoreIndex])

  const updateUrlParams = (
    updates: Record<string, string | null>,
    options?: { preserveIndex?: boolean }
  ) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('page')
    if (!options?.preserveIndex && !Object.prototype.hasOwnProperty.call(updates, 'index')) {
      params.delete('index')
    }
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) params.delete(key)
      else params.set(key, value)
    })
    const query = params.toString()
    startTransition(() => { router.push(query ? `${pathname}?${query}` : pathname) })
  }

  const handleSearchInput = (value: string) => {
    setSearchInput(value)
    // Debounce: for text/auto mode update URL on each keystroke (debounced),
    // for AI mode wait for Enter since it's expensive
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    if (searchMode === 'ai') return // AI mode requires explicit submit
    searchTimerRef.current = setTimeout(() => {
      updateUrlParams({ q: value || null })
    }, 300)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    updateUrlParams({ q: searchInput || null })
  }

  const cycleSearchMode = () => {
    const modes: SearchMode[] = ['auto', 'text', 'ai']
    const nextMode = modes[(modes.indexOf(searchMode) + 1) % modes.length]
    updateUrlParams({ mode: nextMode === 'auto' ? null : nextMode })
  }

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag) ? [] : [tag]
    updateUrlParams({ tags: newTags.length > 0 ? newTags.join(',') : null })
  }

  const handleViewModeChange = () => {
    updateUrlParams({ view: viewMode === 'card' ? 'list' : 'card' }, { preserveIndex: true })
  }

  const handleItemClick = (id: string, index: number) => {
    const currentFilters = new URLSearchParams(searchParams.toString())
    currentFilters.set('index', index.toString())
    currentFilters.delete('page')
    router.push(`/item/${id}?${currentFilters.toString()}`)
  }

  const modeConfig = SEARCH_MODE_CONFIG[searchMode]
  const ModeIcon = modeConfig.icon

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 transition-colors duration-200">
        <header className="mb-8 flex flex-col items-center justify-between md:flex-row">
          <h1 className="mb-4 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-4xl font-bold text-transparent md:mb-0">
            Personal Inventory
          </h1>
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push('/item/new')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Regular Add
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/quick-add')}>
                  <Camera className="mr-2 h-4 w-4" />
                  Quick Add
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
          </div>
        </header>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="md:col-span-3">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={cycleSearchMode}
                className="shrink-0"
                title={`Search mode: ${modeConfig.label}. Click to cycle.`}
              >
                <ModeIcon className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  type="text"
                  placeholder={modeConfig.placeholder}
                  value={searchInput}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="pl-9 transition-colors duration-200"
                />
              </div>
              {searchMode === 'ai' && (
                <Button type="submit" size="sm" className="shrink-0 gap-1">
                  <Sparkles className="h-3 w-3" />
                  Search
                </Button>
              )}
            </form>
            {searchTerm && (
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs gap-1">
                  <ModeIcon className="h-3 w-3" />
                  {modeConfig.label}
                </Badge>
                {searchMode === 'auto' && (
                  <span className="text-xs text-muted-foreground">
                    Combining text + AI results
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <span className="inline-block h-4 w-28 animate-pulse rounded bg-gray-200" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  {totalItems > loadedItemsCount ? `, ${loadedItemsCount} loaded` : ''}
                </p>
              )}
              <Select value={sortBy} onValueChange={(value) => updateUrlParams({ sort: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="createdAt">Date Added</SelectItem>
                  <SelectItem value="updatedAt">Last Updated</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => updateUrlParams({ order: sortOrder === 'asc' ? 'desc' : 'asc' })}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleViewModeChange}>
                {viewMode === 'card' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="space-y-6">
            <div>
              <Label>Location</Label>
              {isFiltersLoading ? (
                <div className="mt-2 h-10 w-full animate-pulse rounded bg-gray-200" />
              ) : (
                <Select
                  value={selectedLocation}
                  onValueChange={(value) => updateUrlParams({ location: value === 'All' ? null : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.name}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Tags</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {isFiltersLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="h-6 w-16 animate-pulse rounded-full bg-gray-200" />
                  ))
                ) : (
                  allTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-3">
            {isLoading ? (
              viewMode === 'card' ? <CardCollectionSkeleton /> : <ListCollectionSkeleton />
            ) : totalItems === 0 ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No items matched the current filters.
                  {searchMode === 'ai' ? ' Try a different description or switch to text search.' : ''}
                </CardContent>
              </Card>
            ) : (
              <VirtualizedItemCollection
                itemsByIndex={itemsByIndex}
                totalItems={totalItems}
                viewMode={viewMode}
                onItemClick={handleItemClick}
                onVisibleRangeChange={loadPagesForRange}
                restoreIndex={restoreIndex}
                restoreKey={restoreKey}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
