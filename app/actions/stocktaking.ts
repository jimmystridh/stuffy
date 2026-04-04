'use server'

import { adminDb } from '@/lib/firebase/admin'
import type { Item, Location, StocktakingResultStatus } from '@/lib/types'

const SESSIONS_COLLECTION = 'inventering_sessions'

export interface StocktakingSession {
  id: string
  locationId: string
  locationName: string
  startedAt: string
  completedAt: string | null
  totalItems: number
  checkedItems: number
  results: Record<string, StocktakingResultStatus>
}

export async function startStocktaking(locationId: string): Promise<{ session?: StocktakingSession; error?: string }> {
  try {
    const locDoc = await adminDb.collection('locations').doc(locationId).get()
    if (!locDoc.exists) return { error: 'Location not found' }

    const locData = locDoc.data()!

    // Get all non-deleted items at this location
    const snapshot = await adminDb.collection('items')
      .where('locationId', '==', locationId)
      .where('deleted', '==', false)
      .get()

    const now = new Date().toISOString()
    const ref = adminDb.collection(SESSIONS_COLLECTION).doc()
    const session: StocktakingSession = {
      id: ref.id,
      locationId,
      locationName: locData.name,
      startedAt: now,
      completedAt: null,
      totalItems: snapshot.size,
      checkedItems: 0,
      results: {},
    }

    await ref.set(session)
    return { session }
  } catch (error) {
    console.error('Failed to start stocktaking:', error)
    return { error: 'Failed to start stocktaking' }
  }
}

export async function getStocktakingItems(locationId: string): Promise<Item[]> {
  const snapshot = await adminDb.collection('items')
    .where('locationId', '==', locationId)
    .where('deleted', '==', false)
    .get()

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }) as Item)
    .map(item => ({
      ...item,
      images: (item.images || []).filter(img => !img.deleted),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function markItem(
  sessionId: string,
  itemId: string,
  status: StocktakingResultStatus
): Promise<{ error?: string }> {
  try {
    await adminDb.runTransaction(async transaction => {
      const sessionRef = adminDb.collection(SESSIONS_COLLECTION).doc(sessionId)
      const itemRef = adminDb.collection('items').doc(itemId)
      const sessionDoc = await transaction.get(sessionRef)
      if (!sessionDoc.exists) {
        throw new Error('Session not found')
      }

      const itemDoc = await transaction.get(itemRef)
      if (!itemDoc.exists) {
        throw new Error('Item not found')
      }

      const session = sessionDoc.data() as StocktakingSession
      const results = { ...session.results, [itemId]: status }
      const checkedItems = Object.keys(results).length
      const updatedAt = new Date().toISOString()
      const itemUpdate: Partial<Item> = { updatedAt }

      if (status === 'missing') {
        itemUpdate.deleted = false
        itemUpdate.deletedAt = null
        itemUpdate.locationId = null
        itemUpdate.location = null
      } else {
        const locationDoc = await transaction.get(adminDb.collection('locations').doc(session.locationId))
        const location = locationDoc.exists
          ? ({ id: locationDoc.id, ...locationDoc.data() } as Location)
          : null

        itemUpdate.deleted = status === 'removed'
        itemUpdate.deletedAt = status === 'removed' ? updatedAt : null
        itemUpdate.locationId = session.locationId
        itemUpdate.location = location
      }

      transaction.update(itemRef, itemUpdate)
      transaction.update(sessionRef, { results, checkedItems })
    })

    return {}
  } catch (error) {
    console.error('Failed to mark item:', error)
    if (error instanceof Error && (error.message === 'Session not found' || error.message === 'Item not found')) {
      return { error: error.message }
    }
    return { error: 'Failed to mark item' }
  }
}

export async function completeStocktaking(sessionId: string): Promise<{ error?: string }> {
  try {
    const ref = adminDb.collection(SESSIONS_COLLECTION).doc(sessionId)
    await ref.update({ completedAt: new Date().toISOString() })
    return {}
  } catch (error) {
    console.error('Failed to complete stocktaking:', error)
    return { error: 'Failed to complete' }
  }
}

export async function getStocktakingSession(sessionId: string): Promise<{ session?: StocktakingSession; error?: string }> {
  try {
    const doc = await adminDb.collection(SESSIONS_COLLECTION).doc(sessionId).get()
    if (!doc.exists) return { error: 'Session not found' }
    return { session: { id: doc.id, ...doc.data() } as StocktakingSession }
  } catch (error) {
    console.error('Failed to get session:', error)
    return { error: 'Failed to get session' }
  }
}
