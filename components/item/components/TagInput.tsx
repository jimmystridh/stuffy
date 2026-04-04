'use client'

import { useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X } from 'lucide-react'

interface TagInputProps {
  tags: string[]
  onTagsChange: (newTags: string[]) => void
  disabled?: boolean
}

export function TagInput({ tags, onTagsChange, disabled }: TagInputProps) {
  const [newTag, setNewTag] = useState('')

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      onTagsChange([...tags, newTag])
      setNewTag('')
    }
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
          placeholder="Add a tag"
          disabled={disabled}
        />
        <Button
          type="button"
          onClick={handleAddTag}
          disabled={disabled || !newTag}
        >
          Add
        </Button>
      </div>
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
