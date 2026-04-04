'use server'

import { adminDb } from '@/lib/firebase/admin'
import { saveFile, deleteFile, type SavedFile } from '@/lib/file-storage'
import type { Item, ItemImage, GetItemsParams, GetItemsResponse } from '@/lib/types'

const itemsCol = () => adminDb.collection('items')
const locationsCol = () => adminDb.collection('locations')

export async function checkItemIdExists(itemId: string): Promise<boolean> {
  const snapshot = await itemsCol()
    .where('itemId', '==', itemId.toLowerCase())
    .where('deleted', '==', false)
    .limit(1)
    .get()
  return !snapshot.empty
}

export async function createItem(formData: FormData) {
  try {
    const itemId = formData.get('itemId') as string
    const exists = await checkItemIdExists(itemId)
    if (exists) {
      return { error: 'Item ID already exists' }
    }

    const savedFiles: SavedFile[] = []
    const images = formData.getAll('images') as File[]
    for (const image of images) {
      if (image.size > 0) {
        const savedFile = await saveFile(image)
        savedFiles.push(savedFile)
      }
    }

    const tags: string[] = []
    let i = 0
    while (formData.has(`tags[${i}]`)) {
      tags.push(formData.get(`tags[${i}]`) as string)
      i++
    }

    const purchasePrice = formData.get('purchasePrice') as string | null
    const acquisitionDate = formData.get('acquisitionDate') as string | null
    const locationId = formData.get('locationId') as string | null

    const now = new Date().toISOString()
    const itemRef = itemsCol().doc()

    const imageRecords: ItemImage[] = savedFiles.map((file, idx) => ({
      id: `${itemRef.id}_img_${idx}`,
      itemId: itemRef.id,
      filename: file.filename,
      storedFilename: file.storedFilename,
      thumbnailFilename: file.thumbnailFilename,
      publicUrl: file.publicUrl,
      thumbnailUrl: file.thumbnailUrl,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: now,
      deleted: false,
      deletedAt: null,
    }))

    // Get location data if locationId provided
    let location = null
    if (locationId) {
      const locDoc = await locationsCol().doc(locationId).get()
      if (locDoc.exists) {
        location = { id: locDoc.id, ...locDoc.data() } as unknown as import('@/lib/types').Location
      }
    }

    const itemData: Omit<Item, 'id'> = {
      itemId: itemId.toLowerCase(),
      name: formData.get('name') as string,
      notes: (formData.get('notes') as string) || null,
      purchasePrice: purchasePrice || null,
      acquisitionDate: acquisitionDate || null,
      locationId: locationId || null,
      tags,
      images: imageRecords,
      location,
      createdAt: now,
      updatedAt: now,
      deleted: false,
      deletedAt: null,
    }

    await itemRef.set(itemData)
    return { item: { id: itemRef.id, ...itemData } as Item }
  } catch (error) {
    console.error('Failed to create item:', error)
    return { error: 'Failed to create item' }
  }
}

export async function updateItem(id: string, formData: FormData) {
  try {
    const savedFiles: SavedFile[] = []
    const images = formData.getAll('images') as File[]
    for (const image of images) {
      if (image.size > 0) {
        const savedFile = await saveFile(image)
        savedFiles.push(savedFile)
      }
    }

    const tags: string[] = []
    let i = 0
    while (formData.has(`tags[${i}]`)) {
      tags.push(formData.get(`tags[${i}]`) as string)
      i++
    }

    const purchasePrice = formData.get('purchasePrice') as string | null
    const acquisitionDate = formData.get('acquisitionDate') as string | null
    const locationId = formData.get('locationId') as string | null

    const now = new Date().toISOString()
    const itemRef = itemsCol().doc(id)
    const existingDoc = await itemRef.get()
    if (!existingDoc.exists) {
      return { error: 'Item not found' }
    }

    const existingData = existingDoc.data() as Omit<Item, 'id'>
    const existingImages = (existingData.images || []).filter(img => !img.deleted)

    const newImageRecords: ItemImage[] = savedFiles.map((file, idx) => ({
      id: `${id}_img_${Date.now()}_${idx}`,
      itemId: id,
      filename: file.filename,
      storedFilename: file.storedFilename,
      thumbnailFilename: file.thumbnailFilename,
      publicUrl: file.publicUrl,
      thumbnailUrl: file.thumbnailUrl,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: now,
      deleted: false,
      deletedAt: null,
    }))

    let location = null
    if (locationId) {
      const locDoc = await locationsCol().doc(locationId).get()
      if (locDoc.exists) {
        location = { id: locDoc.id, ...locDoc.data() } as unknown as import('@/lib/types').Location
      }
    }

    const updateData: Partial<Item> = {
      itemId: (formData.get('itemId') as string).toLowerCase(),
      name: formData.get('name') as string,
      notes: (formData.get('notes') as string) || null,
      purchasePrice: purchasePrice || null,
      acquisitionDate: acquisitionDate || null,
      locationId: locationId || null,
      tags,
      images: [...existingImages, ...newImageRecords],
      location,
      updatedAt: now,
    }

    await itemRef.update(updateData)
    const updatedDoc = await itemRef.get()
    return { item: { id: updatedDoc.id, ...updatedDoc.data() } as Item }
  } catch (error) {
    console.error('Failed to update item:', error)
    return { error: 'Failed to update item' }
  }
}

export async function getItems({
  page = 1,
  pageSize = 18,
  orderBy = { field: 'name', direction: 'asc' },
  tags = [],
  search = '',
  location = '',
}: GetItemsParams = {}): Promise<GetItemsResponse> {
  try {
    // Firestore doesn't support LIKE queries, so we fetch and filter in memory
    // For a personal inventory app with ~250 items this is perfectly fine
    let query = itemsCol().where('deleted', '==', false) as FirebaseFirestore.Query

    if (location && location !== 'All') {
      query = query.where('location.name', '==', location)
    }

    if (tags.length > 0) {
      query = query.where('tags', 'array-contains-any', tags)
    }

    const snapshot = await query.get()
    let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Item)

    // Client-side search filter (case-insensitive)
    if (search) {
      const searchLower = search.toLowerCase()
      items = items.filter(item => item.name.toLowerCase().includes(searchLower))
    }

    // Sort
    const field = orderBy.field as keyof Item
    items.sort((a, b) => {
      const aVal = (a[field] || '') as string
      const bVal = (b[field] || '') as string
      const cmp = aVal.localeCompare(bVal)
      return orderBy.direction === 'asc' ? cmp : -cmp
    })

    const totalItems = items.length
    const start = (page - 1) * pageSize
    const paginatedItems = items.slice(start, start + pageSize)

    // Filter out deleted images
    const cleanItems = paginatedItems.map(item => ({
      ...item,
      images: (item.images || []).filter(img => !img.deleted),
    }))

    return { items: cleanItems, totalItems }
  } catch (error) {
    console.error('Failed to fetch items:', error)
    return { items: [], totalItems: 0, error: 'Failed to fetch items' }
  }
}

export async function getItemById(id: string) {
  try {
    const doc = await itemsCol().doc(id).get()
    if (!doc.exists) {
      return { error: 'Item not found' }
    }
    const item = { id: doc.id, ...doc.data() } as Item
    if (item.deleted) {
      return { error: 'Item not found' }
    }
    item.images = (item.images || []).filter(img => !img.deleted)
    return { item }
  } catch (error) {
    console.error('Failed to get item:', error)
    return { error: 'Failed to get item' }
  }
}

export async function getItemByItemId(itemId: string) {
  try {
    const snapshot = await itemsCol()
      .where('itemId', '==', itemId.toLowerCase())
      .where('deleted', '==', false)
      .limit(1)
      .get()

    if (snapshot.empty) {
      return { error: 'Item not found' }
    }

    const doc = snapshot.docs[0]
    const item = { id: doc.id, ...doc.data() } as Item
    item.images = (item.images || []).filter(img => !img.deleted)
    return { item }
  } catch (error) {
    console.error('Failed to get item by item ID:', error)
    return { error: 'Failed to get item by item ID' }
  }
}

export async function deleteItem(id: string) {
  try {
    const now = new Date().toISOString()
    const itemRef = itemsCol().doc(id)
    const doc = await itemRef.get()
    if (!doc.exists) {
      return { error: 'Item not found' }
    }

    const data = doc.data() as Omit<Item, 'id'>
    const updatedImages = (data.images || []).map(img => ({
      ...img,
      deleted: true,
      deletedAt: now,
    }))

    await itemRef.update({
      deleted: true,
      deletedAt: now,
      images: updatedImages,
    })

    return { success: true }
  } catch (error) {
    console.error('Failed to delete item:', error)
    return { error: 'Failed to delete item' }
  }
}

export async function deleteItemImage(itemId: string, imageId: string) {
  try {
    const itemRef = itemsCol().doc(itemId)
    const doc = await itemRef.get()
    if (!doc.exists) {
      return { error: 'Item not found' }
    }

    const data = doc.data() as Omit<Item, 'id'>
    const now = new Date().toISOString()

    const updatedImages = (data.images || []).map(img => {
      if (img.id === imageId) {
        deleteFile(img.storedFilename)
        return { ...img, deleted: true, deletedAt: now }
      }
      return img
    })

    await itemRef.update({ images: updatedImages, updatedAt: now })
    return { success: true }
  } catch (error) {
    console.error('Failed to delete image:', error)
    return { error: 'Failed to delete image' }
  }
}

export async function getAllTags(): Promise<string[]> {
  try {
    const snapshot = await itemsCol().where('deleted', '==', false).get()
    const tagSet = new Set<string>()
    snapshot.docs.forEach(doc => {
      const data = doc.data()
      if (data.tags) {
        data.tags.forEach((tag: string) => tagSet.add(tag))
      }
    })
    return Array.from(tagSet).sort()
  } catch (error) {
    console.error('Failed to fetch tags:', error)
    return []
  }
}

export async function getAdjacentItems(
  currentIndex: number,
  filterParams: GetItemsParams
): Promise<{ prevItem?: Item; nextItem?: Item }> {
  try {
    const itemsPerPage = filterParams.pageSize || 18
    const currentPage = filterParams.page || 1
    const indexInPage = currentIndex % itemsPerPage

    const currentPageResult = await getItems({
      ...filterParams,
      page: currentPage,
      pageSize: itemsPerPage,
    })

    let prevItem: Item | undefined
    let nextItem: Item | undefined

    if (indexInPage === 0 && currentPage > 1) {
      const prevPageResult = await getItems({
        ...filterParams,
        page: currentPage - 1,
        pageSize: itemsPerPage,
      })
      if (prevPageResult.items.length > 0) {
        prevItem = prevPageResult.items[prevPageResult.items.length - 1]
      }
    } else if (indexInPage > 0) {
      prevItem = currentPageResult.items[indexInPage - 1]
    }

    if (indexInPage === itemsPerPage - 1) {
      const nextPageResult = await getItems({
        ...filterParams,
        page: currentPage + 1,
        pageSize: itemsPerPage,
      })
      if (nextPageResult.items.length > 0) {
        nextItem = nextPageResult.items[0]
      }
    } else if (indexInPage < currentPageResult.items.length - 1) {
      nextItem = currentPageResult.items[indexInPage + 1]
    }

    return { prevItem, nextItem }
  } catch (error) {
    console.error('Error getting adjacent items:', error)
    return {}
  }
}
