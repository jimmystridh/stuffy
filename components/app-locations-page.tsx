'use client'

import { useEffect, useState } from 'react'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Pencil, Trash2, X, Check, LayoutGrid } from 'lucide-react'
import Link from 'next/link'
import { getLocations, createLocation, updateLocation, deleteLocation } from '@/app/actions/locations'
import type { Location } from '@/lib/types'

export function Page() {
  const [locations, setLocations] = useState<Location[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'failed'>('loading')
  const [newLocation, setNewLocation] = useState({ name: '', notes: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', notes: '' })

  const loadLocations = async (showLoadingState = true) => {
    if (showLoadingState) {
      setStatus('loading')
    }
    const result = await getLocations()
    if (result.error) {
      setStatus('failed')
    } else {
      setLocations(result.locations)
      setStatus('idle')
    }
  }

  useEffect(() => {
    let isCancelled = false

    async function loadInitialLocations() {
      const result = await getLocations()
      if (isCancelled) {
        return
      }

      if (result.error) {
        setStatus('failed')
      } else {
        setLocations(result.locations)
        setStatus('idle')
      }
    }

    void loadInitialLocations()

    return () => {
      isCancelled = true
    }
  }, [])

  const handleAddLocation = async () => {
    if (newLocation.name) {
      await createLocation(newLocation)
      await loadLocations()
      setNewLocation({ name: '', notes: '' })
    }
  }

  const handleUpdateLocation = async () => {
    if (editingId) {
      await updateLocation(editingId, editForm)
      await loadLocations()
      setEditingId(null)
    }
  }

  const handleDeleteLocation = async (id: string) => {
    await deleteLocation(id)
    await loadLocations()
  }

  const handleEditLocation = (location: Location) => {
    setEditingId(location.id)
    setEditForm({ name: location.name, notes: location.notes || '' })
  }

  if (status === 'loading') {
    return <div className="container mx-auto p-4">Loading...</div>
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Manage Locations</h1>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Add New Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-location-name">Location Name</Label>
              <Input
                id="new-location-name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                placeholder="Enter location name"
              />
            </div>
            <div>
              <Label htmlFor="new-location-notes">Notes</Label>
              <Textarea
                id="new-location-notes"
                value={newLocation.notes}
                onChange={(e) => setNewLocation({ ...newLocation, notes: e.target.value })}
                placeholder="Enter location notes"
              />
            </div>
            <Button onClick={handleAddLocation} className="w-full">Add Location</Button>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        {locations.map((location) => (
          <Card key={location.id}>
            <CardContent className="p-4">
              {editingId === location.id ? (
                <div className="space-y-4">
                  <div>
                    <Label>Location Name</Label>
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button onClick={handleUpdateLocation} size="sm">
                      <Check className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button onClick={() => setEditingId(null)} size="sm" variant="outline">
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold">{location.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{location.notes}</p>
                  </div>
                  <div className="flex space-x-2">
                    <Link href={`/locations/${location.id}/collage`}>
                      <Button variant="outline" size="sm">
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => handleEditLocation(location)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteLocation(location.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
