'use client'

import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface ItemHeaderProps {
  isNewItem: boolean
  hasPrevious: boolean
  hasNext: boolean
  onNavigateBack: () => void
  onNavigateAdjacent: (direction: 'prev' | 'next') => void
}

export function ItemHeader({
  isNewItem,
  hasPrevious,
  hasNext,
  onNavigateBack,
  onNavigateAdjacent
}: ItemHeaderProps) {
  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <Button
          variant="outline"
          onClick={onNavigateBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onNavigateAdjacent('prev')}
            disabled={!hasPrevious}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            onClick={() => onNavigateAdjacent('next')}
            disabled={!hasNext}
            className="gap-2"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <h1 className="text-3xl font-bold mb-6">{isNewItem ? 'Create New Item' : 'Edit Item'}</h1>
    </>
  )
}
