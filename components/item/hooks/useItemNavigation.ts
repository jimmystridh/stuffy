'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { getAdjacentItems } from '@/app/actions/items'

const parseIndex = (value: string | null) => {
  const parsedValue = Number.parseInt(value || '0', 10)
  return Number.isNaN(parsedValue) ? 0 : parsedValue
}

export const useItemNavigation = (totalItems: number) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentIndex = parseIndex(searchParams.get('index'))

  const hasPrevious = currentIndex > 0
  const hasNext = totalItems > 0 && currentIndex < totalItems - 1

  const navigateToAdjacent = async (direction: 'prev' | 'next') => {
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1

    if (targetIndex < 0 || targetIndex >= totalItems) {
      return
    }

    const filterParams = {
      search: searchParams.get('q') || '',
      semanticQuery: searchParams.get('semanticQ') || '',
      location: searchParams.get('location') || '',
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || [],
      orderBy: {
        field: searchParams.get('sort') || 'name',
        direction: (searchParams.get('order') || 'asc') as 'asc' | 'desc'
      },
    }

    const adjacentItems = await getAdjacentItems(currentIndex, filterParams)
    const targetItem = direction === 'prev' ? adjacentItems.prevItem : adjacentItems.nextItem

    if (targetItem) {
      const currentFilters = new URLSearchParams(searchParams.toString())
      currentFilters.set('index', targetIndex.toString())
      currentFilters.delete('page')

      router.push(`/item/${targetItem.id}?${currentFilters.toString()}`)
    }
  }

  const navigateBack = () => {
    const query = searchParams.toString()
    router.push(query ? `/?${query}` : '/')
  }

  return {
    hasPrevious,
    hasNext,
    navigateToAdjacent,
    navigateBack
  }
}
