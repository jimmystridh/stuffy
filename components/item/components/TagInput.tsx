'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X } from 'lucide-react'
import { getAllTags } from '@/app/actions/items'

interface TagInputProps {
  tags: string[]
  onTagsChange: (newTags: string[]) => void
  disabled?: boolean
}

export function TagInput({ tags, onTagsChange, disabled }: TagInputProps) {
  const [newTag, setNewTag] = useState('')
  const [existingTags, setExistingTags] = useState<string[]>([])
  const datalistId = useId()

  useEffect(() => {
    let isMounted = true

    const loadTags = async () => {
      try {
        const loadedTags = await getAllTags()
        if (isMounted) {
          setExistingTags(loadedTags)
        }
      } catch (error) {
        console.error('Failed to load tag suggestions:', error)
      }
    }

    loadTags()

    return () => {
      isMounted = false
    }
  }, [])

  const normalizedSelectedTags = useMemo(
    () => tags.map(tag => tag.trim().toLowerCase()),
    [tags]
  )

  const suggestedTags = useMemo(() => {
    const query = newTag.trim().toLowerCase()

    return existingTags.filter(tag => {
      const normalizedTag = tag.trim().toLowerCase()
      if (normalizedSelectedTags.includes(normalizedTag)) {
        return false
      }

      return !query || normalizedTag.includes(query)
    })
  }, [existingTags, newTag, normalizedSelectedTags])

  const handleAddTag = (value?: string) => {
    const valueToAdd = typeof value === 'string' ? value : newTag
    const trimmedValue = valueToAdd.trim()
    if (!trimmedValue) return

    const canonicalTag =
      existingTags.find(tag => tag.trim().toLowerCase() === trimmedValue.toLowerCase()) ??
      trimmedValue

    if (normalizedSelectedTags.includes(canonicalTag.trim().toLowerCase())) {
      setNewTag('')
      return
    }

    onTagsChange([...tags, canonicalTag])
    setNewTag('')
  }

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTag()
    }
  }

  return (
    <div>
      <div className="flex gap-2 mb-2">
        <Input
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pick or create a tag"
          list={datalistId}
          disabled={disabled}
        />
        <Button
          type="button"
          onClick={() => handleAddTag()}
          disabled={disabled || !newTag.trim()}
        >
          Add
        </Button>
      </div>
      <datalist id={datalistId}>
        {suggestedTags.map(tag => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <Badge
            key={tag}
            variant="secondary"
            className="flex items-center gap-1"
          >
            {tag}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => handleRemoveTag(tag)}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        ))}
      </div>
    </div>
  )
}
