'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Search, SortAsc, SortDesc, Grid, List, Plus, Camera } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { getItems, getAllTags } from '@/app/actions/items'
import { getLocations } from '@/app/actions/locations'
import type { Item, Location } from '@/lib/types'

export function Page() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [items, setItems] = useState<Item[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  const searchTerm = searchParams.get('q') || ''
  const selectedLocation = searchParams.get('location') || 'All'
  const selectedTags = searchParams.get('tags')?.split(',').filter(Boolean) || []
  const sortBy = searchParams.get('sort') || 'name'
  const sortOrder = (searchParams.get('order') || 'asc') as 'asc' | 'desc'
  const viewMode = (searchParams.get('view') || 'card') as 'card' | 'list'
  const currentPage = parseInt(searchParams.get('page') || '1', 10)
  const itemsPerPage = viewMode === 'card' ? 18 : 100

  useEffect(() => {
    const loadData = async () => {
      try {
        const [itemsResult, tags, locationsResult] = await Promise.all([
          getItems({
            page: currentPage,
            pageSize: itemsPerPage,
            orderBy: { field: sortBy, direction: sortOrder },
            tags: selectedTags,
            search: searchTerm,
            location: selectedLocation,
          }),
          getAllTags(),
          getLocations(),
        ])

        if (!itemsResult.error) {
          setItems(itemsResult.items)
          setTotalItems(itemsResult.totalItems)
        }
        setAllTags(tags)
        if (locationsResult.locations) {
          setLocations(locationsResult.locations)
        }
      } catch {
        console.error('Failed to load data')
      } finally {
        setIsLoading(false)
      }
    }

    const timeoutId = setTimeout(loadData, 100)
    return () => clearTimeout(timeoutId)
  }, [searchParams, currentPage, itemsPerPage, sortBy, sortOrder, searchTerm, selectedLocation, selectedTags])

  const totalPages = Math.ceil(totalItems / itemsPerPage)

  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    })
    router.push(`${pathname}?${params.toString()}`)
  }

  const toggleTag = (tag: string) => {
    const newTags = selectedTags.includes(tag) ? [] : [tag]
    updateUrlParams({
      tags: newTags.length > 0 ? newTags.join(',') : null,
      page: '1'
    })
  }

  const handlePageChange = (page: number) => {
    updateUrlParams({ page: page.toString() })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleViewModeChange = () => {
    updateUrlParams({ view: viewMode === 'card' ? 'list' : 'card', page: '1' })
  }

  const handleItemClick = (id: string, index: number) => {
    const currentFilters = new URLSearchParams(searchParams.toString())
    currentFilters.set('index', index.toString())
    router.push(`/item/${id}?${currentFilters.toString()}`)
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-4 transition-colors duration-200">
        <header className="flex flex-col md:flex-row justify-between items-center mb-8">
          <h1 className="text-4xl font-bold mb-4 md:mb-0 bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
            Personal Inventory
          </h1>
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push('/item/new')}>
                  <Plus className="h-4 w-4 mr-2" />
                  Regular Add
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/quick-add')}>
                  <Camera className="h-4 w-4 mr-2" />
                  Quick Add
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeToggle />
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="md:col-span-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => updateUrlParams({ q: e.target.value || null, page: '1' })}
                className="pl-10 transition-colors duration-200"
              />
            </div>
          </div>
          <div className="flex space-x-2">
            <div className="flex items-center gap-2">
              {isLoading ? (
                <span className="h-4 w-20 bg-gray-200 rounded animate-pulse inline-block" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {totalItems} {totalItems === 1 ? 'item' : 'items'}
                </p>
              )}
              <Select value={sortBy} onValueChange={(value) => updateUrlParams({ sort: value, page: '1' })}>
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
                onClick={() => updateUrlParams({ order: sortOrder === 'asc' ? 'desc' : 'asc', page: '1' })}
              >
                {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={handleViewModeChange}>
                {viewMode === 'card' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="space-y-6">
            <div>
              <Label>Location</Label>
              {isLoading ? (
                <div className="h-10 w-full bg-gray-200 rounded animate-pulse mt-2" />
              ) : (
                <Select value={selectedLocation} onValueChange={(value) => updateUrlParams({ location: value === 'All' ? null : value, page: '1' })}>
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
              <div className="flex flex-wrap gap-2 mt-2">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-6 w-16 bg-gray-200 rounded-full animate-pulse" />
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
            <AnimatePresence>
              {viewMode === 'card' ? (
                isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 9 }).map((_, index) => (
                      <Card key={index} className="overflow-hidden">
                        <div className="aspect-square relative bg-gray-200 animate-pulse" />
                        <CardContent className="p-4">
                          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                          <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {items.map((item, index) => (
                      <motion.div key={item.id} layout>
                        <Card
                          className="overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-105"
                          onClick={() => handleItemClick(item.id, index)}
                        >
                          <div className="aspect-square relative">
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
                              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                No image
                              </div>
                            )}
                          </div>
                          <CardContent className="p-4">
                            <p className="text-sm text-gray-500 mb-2">ID: {item.itemId}</p>
                            <p className="text-sm font-semibold mb-2">{item.name}</p>
                            <div className="flex flex-wrap gap-2">
                              {item.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs rounded-full">{tag}</Badge>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </motion.div>
                )
              ) : (
                <motion.div
                  className="overflow-x-auto"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        <th className="p-2 text-left">Image</th>
                        <th className="p-2 text-left">Name</th>
                        <th className="p-2 text-left">ID</th>
                        <th className="p-2 text-left">Location</th>
                        <th className="p-2 text-left">Date Created</th>
                        <th className="p-2 text-left">Price</th>
                        <th className="p-2 text-left">Tags</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <motion.tr
                          key={item.id}
                          className="border-b cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
                          onClick={() => handleItemClick(item.id, index)}
                        >
                          <td className="p-2">
                            <div className="relative w-[50px] h-[50px]">
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
                                <div className="w-full h-full rounded-full bg-gray-200 dark:bg-gray-700" />
                              )}
                            </div>
                          </td>
                          <td className="p-2 font-medium">{item.name}</td>
                          <td className="p-2 text-sm text-gray-500">{item.itemId}</td>
                          <td className="p-2">{item.location?.name}</td>
                          <td className="p-2 text-sm">{new Date(item.createdAt).toLocaleDateString()}</td>
                          <td className="p-2 font-semibold">{item.purchasePrice ? `$${item.purchasePrice}` : ''}</td>
                          <td className="p-2">
                            <div className="flex flex-wrap gap-1">
                              {item.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs rounded-full">{tag}</Badge>
                              ))}
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-8 flex justify-center">
              <nav className="inline-flex rounded-md shadow">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-l-md"
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    onClick={() => handlePageChange(page)}
                    className="rounded-none"
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-r-md"
                >
                  Next
                </Button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
