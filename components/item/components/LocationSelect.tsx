'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Location } from '@/lib/types'

interface LocationSelectProps {
  locations: Location[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
}

export function LocationSelect({
  locations,
  value,
  onChange,
  disabled
}: LocationSelectProps) {
  return (
    <Select
      value={value?.toString() || 'null'}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select a location" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="null">No location</SelectItem>
        {locations.map(location => (
          <SelectItem
            key={location.id}
            value={location.id}
          >
            {location.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
