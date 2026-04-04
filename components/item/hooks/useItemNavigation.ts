'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { getAdjacentItems } from '@/app/actions/items'

export const useItemNavigation = (totalItems: number) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentIndex = parseInt(searchParams.get('index') || '0', 10)
  const itemsPerPage = searchParams.get('view') === 'list' ? 100 : 18
  const currentPage = parseInt(searchParams.get('page') || '1', 10)

  const hasPrevious = currentIndex > 0 || (currentIndex === 0 && currentPage > 1)
  const hasNext = currentIndex < itemsPerPage - 1 || (currentIndex === itemsPerPage - 1 && totalItems > itemsPerPage * currentPage)

  const navigateToAdjacent = async (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1

    const filterParams = {
      search: searchParams.get('q') || '',
      location: searchParams.get('location') || '',
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
      orderBy: {
        field: searchParams.get('sort') || 'name',
        direction: (searchParams.get('order') || 'asc') as 'asc' | 'desc'
      },
      page: currentPage,
      pageSize: itemsPerPage
    }

    const adjacentItems = await getAdjacentItems(currentIndex, filterParams)
    const targetItem = direction === 'prev' ? adjacentItems.prevItem : adjacentItems.nextItem

    if (targetItem) {
      const currentFilters = new URLSearchParams(searchParams.toString())
      currentFilters.set('index', newIndex.toString())

      if (newIndex < 0) {
        currentFilters.set('page', (currentPage - 1).toString())
        currentFilters.set('index', (itemsPerPage - 1).toString())
      } else if (newIndex >= itemsPerPage) {
        currentFilters.set('page', (currentPage + 1).toString())
        currentFilters.set('index', '0')
      }

      router.push(`/item/${targetItem.id}?${currentFilters.toString()}`)
    }
  }

  const navigateBack = () => {
    router.push(`/?${searchParams.toString()}`)
  }

  return {
    hasPrevious,
    hasNext,
    navigateToAdjacent,
    navigateBack
  }
}
