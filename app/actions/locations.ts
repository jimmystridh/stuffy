'use server'

import { adminDb } from '@/lib/firebase/admin'
import type { Location } from '@/lib/types'

const locationsCol = () => adminDb.collection('locations')

export async function getLocations() {
  try {
    const snapshot = await locationsCol().orderBy('name', 'asc').get()
    const locations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Location[]
    return { locations }
  } catch (error) {
    console.error('Failed to fetch locations:', error)
    return { locations: [] as Location[], error: 'Failed to fetch locations' }
  }
}

export async function createLocation(data: { name: string; notes?: string }) {
  try {
    const now = new Date().toISOString()
    const ref = locationsCol().doc()
    const locationData = {
      name: data.name,
      notes: data.notes || null,
      createdAt: now,
      updatedAt: now,
    }
    await ref.set(locationData)
    return { location: { id: ref.id, ...locationData } as Location }
  } catch (error) {
    console.error('Failed to create location:', error)
    return { error: 'Failed to create location' }
  }
}

export async function updateLocation(id: string, data: { name: string; notes?: string }) {
  try {
    const now = new Date().toISOString()
    const ref = locationsCol().doc(id)
    await ref.update({
      name: data.name,
      notes: data.notes || null,
      updatedAt: now,
    })
    const doc = await ref.get()
    return { location: { id: doc.id, ...doc.data() } as Location }
  } catch (error) {
    console.error('Failed to update location:', error)
    return { error: 'Failed to update location' }
  }
}

export async function getLocationById(id: string) {
  try {
    const doc = await locationsCol().doc(id).get()
    if (!doc.exists) {
      return { error: 'Location not found' }
    }
    return { location: { id: doc.id, ...doc.data() } as Location }
  } catch (error) {
    console.error('Failed to fetch location:', error)
    return { error: 'Failed to fetch location' }
  }
}

export async function deleteLocation(id: string) {
  try {
    await locationsCol().doc(id).delete()
    return { success: true }
  } catch (error) {
    console.error('Failed to delete location:', error)
    return { error: 'Failed to delete location' }
  }
}
