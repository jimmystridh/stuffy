'use client'

import { format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"

interface FormFieldsProps {
  isLoading: boolean
  itemId: string
  name: string
  notes: string
  purchasePrice: string
  acquisitionDate: Date | null
  idValidationStatus: 'idle' | 'valid' | 'invalid'
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onDateSelect: (date: Date | undefined) => void
  onIdBlur: (e: React.FocusEvent<HTMLInputElement>) => void
  disabled?: boolean
}

export function FormFields({
  isLoading,
  itemId,
  name,
  notes,
  purchasePrice,
  acquisitionDate,
  idValidationStatus,
  onInputChange,
  onDateSelect,
  onIdBlur,
  disabled
}: FormFieldsProps) {
  const getIdInputClassName = () => {
    const baseClasses = "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
    switch (idValidationStatus) {
      case 'valid':
        return `${baseClasses} border-green-500`
      case 'invalid':
        return `${baseClasses} border-red-500`
      default:
        return baseClasses
    }
  }

  if (isLoading) {
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="itemId">Item ID</Label>
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Label htmlFor="name">Name</Label>
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label htmlFor="purchasePrice">Purchase Price</Label>
            <Skeleton className="h-10 w-full" />
          </div>
          <div>
            <Label>Acquisition Date</Label>
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="itemId">Item ID</Label>
          <Input
            id="itemId"
            name="itemId"
            value={itemId}
            onChange={onInputChange}
            onBlur={onIdBlur}
            className={getIdInputClassName()}
            required
            disabled={disabled}
          />
          {idValidationStatus === 'invalid' && (
            <p className="text-sm text-red-500 mt-1">
              This Item ID is already taken or invalid
            </p>
          )}
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={onInputChange}
            required
            disabled={disabled}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          name="notes"
          value={notes}
          onChange={onInputChange}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Label htmlFor="purchasePrice">Purchase Price</Label>
          <Input
            id="purchasePrice"
            name="purchasePrice"
            type="number"
            value={purchasePrice}
            onChange={onInputChange}
            disabled={disabled}
          />
        </div>
        <div>
          <Label>Acquisition Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {acquisitionDate ? format(acquisitionDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={acquisitionDate || undefined}
                onSelect={onDateSelect}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </>
  )
}
