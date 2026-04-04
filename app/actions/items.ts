'use server'

import { adminDb } from '@/lib/firebase/admin'
import { buildItemAiData, cosineSimilarity, generateSemanticQueryEmbedding } from '@/lib/ai/item-intelligence'
import { saveFile, saveFileFromUrl, deleteFile, type SavedFile } from '@/lib/file-storage'
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

export interface CreateItemData {
  itemId: string
  name: string
  notes?: string | null
  purchasePrice?: string | null
  acquisitionDate?: string | null
  locationId?: string | null
  tags?: string[]
  imageFiles?: File[]
  imageUrls?: string[]
}

export async function createItemFromData(data: CreateItemData) {
  const exists = await checkItemIdExists(data.itemId)
  if (exists) {
    return { error: 'Item ID already exists' }
  }

  const savedFiles: SavedFile[] = []
  if (data.imageFiles) {
    for (const image of data.imageFiles) {
      if (image.size > 0) {
        const savedFile = await saveFile(image)
        savedFiles.push(savedFile)
      }
    }
  }
  if (data.imageUrls) {
    for (const url of data.imageUrls) {
      const savedFile = await saveFileFromUrl(url)
      savedFiles.push(savedFile)
    }
  }

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

  let location = null
  if (data.locationId) {
    const locDoc = await locationsCol().doc(data.locationId).get()
    if (locDoc.exists) {
      location = { id: locDoc.id, ...locDoc.data() } as unknown as import('@/lib/types').Location
    }
  }

  const itemData: Omit<Item, 'id'> = {
    itemId: data.itemId.toLowerCase(),
    name: data.name,
    notes: data.notes || null,
    purchasePrice: data.purchasePrice || null,
    acquisitionDate: data.acquisitionDate || null,
    locationId: data.locationId || null,
    tags: data.tags ?? [],
    images: imageRecords,
    location,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    deletedAt: null,
    ai: null,
  }

  await itemRef.set(itemData)
  const createdItem = { id: itemRef.id, ...itemData } as Item

  try {
    const ai = await buildItemAiData(createdItem)
    if (ai) {
      await itemRef.update({ ai })
      createdItem.ai = ai
    }
  } catch (error) {
    console.error('Failed to generate AI data for created item:', error)
  }

  return { item: createdItem }
}

export async function createItem(formData: FormData) {
  try {
    const tags: string[] = []
    let i = 0
    while (formData.has(`tags[${i}]`)) {
      tags.push(formData.get(`tags[${i}]`) as string)
      i++
    }

    return await createItemFromData({
      itemId: formData.get('itemId') as string,
      name: formData.get('name') as string,
      notes: formData.get('notes') as string | null,
      purchasePrice: formData.get('purchasePrice') as string | null,
      acquisitionDate: formData.get('acquisitionDate') as string | null,
      locationId: formData.get('locationId') as string | null,
      tags,
      imageFiles: (formData.getAll('images') as File[]),
    })
  } catch (error) {
    console.error('Failed to create item:', error)
    return { error: 'Failed to create item' }
  }
}

export interface UpdateItemData {
  itemId?: string
  name?: string
  notes?: string | null
  purchasePrice?: string | null
  acquisitionDate?: string | null
  locationId?: string | null
  tags?: string[]
  imageFiles?: File[]
  imageUrls?: string[]
}

export async function updateItemFromData(id: string, data: UpdateItemData) {
  const savedFiles: SavedFile[] = []
  if (data.imageFiles) {
    for (const image of data.imageFiles) {
      if (image.size > 0) {
        const savedFile = await saveFile(image)
        savedFiles.push(savedFile)
      }
    }
  }
  if (data.imageUrls) {
    for (const url of data.imageUrls) {
      const savedFile = await saveFileFromUrl(url)
      savedFiles.push(savedFile)
    }
  }

  const now = new Date().toISOString()
  const itemRef = itemsCol().doc(id)
  const existingDoc = await itemRef.get()
  if (!existingDoc.exists) {
    return { error: 'Item not found' }
  }

  const existingData = existingDoc.data() as Omit<Item, 'id'>
  const existingImages = (existingData.images || []).filter(img => !img.deleted)
  const shouldRefreshAi = savedFiles.length > 0 || !existingData.ai

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
  const locationId = data.locationId !== undefined ? data.locationId : existingData.locationId
  if (locationId) {
    const locDoc = await locationsCol().doc(locationId).get()
    if (locDoc.exists) {
      location = { id: locDoc.id, ...locDoc.data() } as unknown as import('@/lib/types').Location
    }
  }

  const updateData: Partial<Item> = {
    ...(data.itemId !== undefined && { itemId: data.itemId.toLowerCase() }),
    ...(data.name !== undefined && { name: data.name }),
    ...(data.notes !== undefined && { notes: data.notes || null }),
    ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice || null }),
    ...(data.acquisitionDate !== undefined && { acquisitionDate: data.acquisitionDate || null }),
    ...(data.locationId !== undefined && { locationId: data.locationId || null }),
    ...(data.tags !== undefined && { tags: data.tags }),
    images: [...existingImages, ...newImageRecords],
    location,
    updatedAt: now,
  }

  await itemRef.update(updateData)
  const updatedDoc = await itemRef.get()
  const updatedItem = { id: updatedDoc.id, ...updatedDoc.data() } as Item

  if (shouldRefreshAi) {
    try {
      const ai = await buildItemAiData(updatedItem)
      await itemRef.update({ ai })
      updatedItem.ai = ai
    } catch (error) {
      console.error('Failed to refresh AI data for updated item:', error)
    }
  }

  return { item: updatedItem }
}

export async function updateItem(id: string, formData: FormData) {
  try {
    const tags: string[] = []
    let i = 0
    while (formData.has(`tags[${i}]`)) {
      tags.push(formData.get(`tags[${i}]`) as string)
      i++
    }

    return await updateItemFromData(id, {
      itemId: formData.get('itemId') as string,
      name: formData.get('name') as string,
      notes: formData.get('notes') as string | null,
      purchasePrice: formData.get('purchasePrice') as string | null,
      acquisitionDate: formData.get('acquisitionDate') as string | null,
      locationId: formData.get('locationId') as string | null,
      tags,
      imageFiles: (formData.getAll('images') as File[]),
    })
  } catch (error) {
    console.error('Failed to update item:', error)
    return { error: 'Failed to update item' }
  }
}

function textFilter(items: Item[], search: string): Item[] {
  const searchLower = search.toLowerCase()
  return items.filter(item =>
    [
      item.name,
      item.itemId,
      item.notes || '',
      item.tags.join(' '),
      item.ai?.searchText || '',
    ].some(value => value.toLowerCase().includes(searchLower))
  )
}

function isMetadataFallbackItem(item: Item) {
  return item.ai?.analysis?.model === 'metadata-fallback'
}

async function semanticRank(items: Item[], query: string): Promise<Item[]> {
  const queryEmbedding = await generateSemanticQueryEmbedding(query)
  return items
    .map(item => {
      const vector = item.ai?.imageEmbedding?.vector
      if (!vector?.length) return null
      return {
        item,
        score: cosineSimilarity(queryEmbedding, vector),
        isMetadataFallback: isMetadataFallbackItem(item),
      }
    })
    .filter(
      (entry): entry is { item: Item; score: number; isMetadataFallback: boolean } => entry !== null
    )
    .sort((left, right) => {
      // Fallback entries are text-derived embeddings for corrupt images.
      // Keep them searchable, but rank real image-backed matches ahead of them.
      if (left.isMetadataFallback !== right.isMetadataFallback) {
        return left.isMetadataFallback ? 1 : -1
      }
      return right.score - left.score
    })
    .map(entry => entry.item)
}

async function getFilteredItems({
  orderBy = { field: 'name', direction: 'asc' },
  tags = [],
  search = '',
  searchMode = 'auto',
  location = '',
}: GetItemsParams = {}): Promise<Item[]> {
  let query = itemsCol().where('deleted', '==', false) as FirebaseFirestore.Query

  if (location && location !== 'All') {
    query = query.where('location.name', '==', location)
  }

  if (tags.length > 0) {
    query = query.where('tags', 'array-contains-any', tags)
  }

  const snapshot = await query.get()
  let items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Item)

  if (search) {
    if (searchMode === 'text') {
      items = textFilter(items, search)
    } else if (searchMode === 'ai') {
      try {
        items = await semanticRank(items, search)
      } catch (error) {
        console.error('Semantic search failed, falling back to text:', error)
        items = textFilter(items, search)
      }
    } else {
      // Auto mode: run text filter first, then try semantic ranking on the
      // full set. Merge by showing semantic matches first, then text-only
      // matches that weren't in the semantic results.
      const textMatches = textFilter(items, search)
      try {
        const semanticMatches = await semanticRank(items, search)
        const semanticIds = new Set(semanticMatches.map(i => i.id))
        const textOnlyMatches = textMatches.filter(i => !semanticIds.has(i.id))
        items = [...semanticMatches, ...textOnlyMatches]
      } catch {
        // Semantic failed, just use text results
        items = textMatches
      }
    }
  }

  // Only apply sort order when there's no search (search results are ranked by relevance)
  if (!search) {
    const field = orderBy.field as keyof Item
    items.sort((a, b) => {
      const aVal = (a[field] || '') as string
      const bVal = (b[field] || '') as string
      const cmp = aVal.localeCompare(bVal)
      return orderBy.direction === 'asc' ? cmp : -cmp
    })
  }

  return items.map(item => ({
    ...item,
    images: (item.images || []).filter(img => !img.deleted),
  }))
}

export async function getItems({
  page = 1,
  pageSize = 18,
  orderBy = { field: 'name', direction: 'asc' },
  tags = [],
  search = '',
  searchMode = 'auto',
  location = '',
}: GetItemsParams = {}): Promise<GetItemsResponse> {
  try {
    const items = await getFilteredItems({
      orderBy,
      tags,
      search,
      searchMode,
      location,
    })

    const normalizedPage = Math.max(1, page)
    const normalizedPageSize = Math.max(1, pageSize)
    const totalItems = items.length
    const start = (normalizedPage - 1) * normalizedPageSize
    const paginatedItems = items.slice(start, start + normalizedPageSize)

    return { items: paginatedItems, totalItems }
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

    const nextItem = {
      id: itemId,
      ...data,
      images: updatedImages,
    } as Item

    let ai = data.ai ?? null
    if (
      !ai ||
      ai.analysis.sourceImageId === imageId ||
      ai.imageEmbedding.sourceImageId === imageId
    ) {
      ai = await buildItemAiData(nextItem)
    }

    await itemRef.update({ images: updatedImages, updatedAt: now, ai })
    return { success: true }
  } catch (error) {
    console.error('Failed to delete image:', error)
    return { error: 'Failed to delete image' }
  }
}

export async function refreshItemAi(id: string) {
  try {
    const itemRef = itemsCol().doc(id)
    const doc = await itemRef.get()
    if (!doc.exists) {
      return { error: 'Item not found' }
    }

    const item = { id: doc.id, ...doc.data() } as Item
    if (item.deleted) {
      return { error: 'Item not found' }
    }

    const ai = await buildItemAiData(item)
    const updatedAt = new Date().toISOString()
    await itemRef.update({ ai, updatedAt })

    const updatedDoc = await itemRef.get()
    return { item: { id: updatedDoc.id, ...updatedDoc.data() } as Item }
  } catch (error) {
    console.error('Failed to refresh item AI data:', error)
    return { error: 'Failed to refresh item AI data' }
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
    if (currentIndex < 0) {
      return {}
    }

    const items = await getFilteredItems(filterParams)

    return {
      prevItem: currentIndex > 0 ? items[currentIndex - 1] : undefined,
      nextItem: currentIndex < items.length - 1 ? items[currentIndex + 1] : undefined,
    }
  } catch (error) {
    console.error('Error getting adjacent items:', error)
    return {}
  }
}
