'use server'

import { after } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { buildItemAiData, cosineSimilarity, generateSemanticQueryEmbedding } from '@/lib/ai/item-intelligence'
import { saveFile, saveFileFromUrl, deleteFile, type SavedFile } from '@/lib/file-storage'
import { isAllLocationsFilter, isNoLocationFilter } from '@/lib/location-filters'
import type { Item, ItemImage, GetItemsParams, GetItemsResponse, UploadedImageFile } from '@/lib/types'

const itemsCol = () => adminDb.collection('items')
const locationsCol = () => adminDb.collection('locations')

function normalizeItemIdValue(itemId: string | null | undefined) {
  return itemId?.trim().toLowerCase() ?? ''
}

function normalizeNameValue(
  name: string | null | undefined,
  ...fallbackValues: Array<string | null | undefined>
) {
  const trimmedName = name?.trim() ?? ''
  if (trimmedName) {
    return trimmedName
  }

  for (const fallbackValue of fallbackValues) {
    const trimmedFallback = fallbackValue?.trim() ?? ''
    if (trimmedFallback) {
      return trimmedFallback
    }
  }

  return 'Untitled item'
}

export async function checkItemIdExists(itemId: string): Promise<boolean> {
  const normalizedItemId = normalizeItemIdValue(itemId)
  if (!normalizedItemId) {
    return false
  }

  const snapshot = await itemsCol()
    .where('itemId', '==', normalizedItemId)
    .where('deleted', '==', false)
    .limit(1)
    .get()
  return !snapshot.empty
}

export interface CreateItemData {
  itemId?: string | null
  name?: string | null
  notes?: string | null
  purchasePrice?: string | null
  acquisitionDate?: string | null
  locationId?: string | null
  tags?: string[]
  imageFiles?: File[]
  imageUrls?: string[]
  uploadedImages?: UploadedImageFile[]
}

function isUploadedImageFile(value: unknown): value is UploadedImageFile {
  const candidate = value as Record<string, unknown> | null
  return (
    !!candidate &&
    typeof candidate === 'object' &&
    typeof candidate.filename === 'string' &&
    typeof candidate.storedFilename === 'string' &&
    typeof candidate.thumbnailFilename === 'string' &&
    typeof candidate.publicUrl === 'string' &&
    typeof candidate.thumbnailUrl === 'string' &&
    typeof candidate.mimeType === 'string' &&
    typeof candidate.size === 'number'
  )
}

function parseUploadedImages(formData: FormData): UploadedImageFile[] {
  return formData.getAll('uploadedImages').map((value) => {
    if (typeof value !== 'string') {
      throw new Error('Invalid uploaded image payload')
    }

    const parsed = JSON.parse(value) as unknown
    if (!isUploadedImageFile(parsed)) {
      throw new Error('Invalid uploaded image payload')
    }

    return parsed
  })
}

function scheduleItemAiRefresh(
  itemRef: FirebaseFirestore.DocumentReference,
  item: Item,
  errorContext: string
) {
  after(async () => {
    try {
      const ai = await buildItemAiData(item)
      await itemRef.update({ ai })
    } catch (error) {
      console.error(errorContext, error)
    }
  })
}

export async function uploadItemImage(formData: FormData) {
  try {
    const image = formData.get('image')
    if (!(image instanceof File) || image.size === 0) {
      return { error: 'No photo selected' }
    }

    const uploadedImage = await saveFile(image)
    return { uploadedImage }
  } catch (error) {
    console.error('Failed to upload item image:', error)
    return { error: 'Failed to upload photo' }
  }
}

export async function discardUploadedItemImage(storedFilename: string) {
  if (!storedFilename) {
    return { ok: true }
  }

  await deleteFile(storedFilename)
  return { ok: true }
}

export async function createItemFromData(data: CreateItemData) {
  const itemId = normalizeItemIdValue(data.itemId)
  const name = normalizeNameValue(data.name, itemId)
  if (itemId) {
    const exists = await checkItemIdExists(itemId)
    if (exists) {
      return { error: 'Item ID already exists' }
    }
  }

  const savedFiles: SavedFile[] = [...(data.uploadedImages || [])]
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
    itemId,
    name,
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

  if (createdItem.images.length > 0) {
    scheduleItemAiRefresh(itemRef, createdItem, 'Failed to generate AI data for created item:')
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
      itemId: (formData.get('itemId') as string | null) ?? '',
      name: (formData.get('name') as string | null) ?? undefined,
      notes: formData.get('notes') as string | null,
      purchasePrice: formData.get('purchasePrice') as string | null,
      acquisitionDate: formData.get('acquisitionDate') as string | null,
      locationId: formData.get('locationId') as string | null,
      tags,
      imageFiles: (formData.getAll('images') as File[]),
      uploadedImages: parseUploadedImages(formData),
    })
  } catch (error) {
    console.error('Failed to create item:', error)
    return { error: 'Failed to create item' }
  }
}

export interface UpdateItemData {
  itemId?: string | null
  name?: string | null
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
  const normalizedItemId = data.itemId !== undefined
    ? normalizeItemIdValue(data.itemId)
    : undefined

  if (normalizedItemId && normalizedItemId !== existingData.itemId) {
    const existingItemWithId = await checkItemIdExists(normalizedItemId)
    if (existingItemWithId) {
      return { error: 'Item ID already exists' }
    }
  }

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
    ...(normalizedItemId !== undefined && { itemId: normalizedItemId }),
    ...(data.name !== undefined && {
      name: normalizeNameValue(data.name, existingData.name, normalizedItemId, existingData.itemId),
    }),
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
      itemId: formData.get('itemId') as string | null,
      name: formData.get('name') as string | null,
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

function getTextMatchScore(item: Item, searchLower: string) {
  const itemId = item.itemId.toLowerCase()
  const name = item.name.toLowerCase()
  const notes = (item.notes || '').toLowerCase()
  const tags = item.tags.map(tag => tag.toLowerCase())
  const aiSearchText = (item.ai?.searchText || '').toLowerCase()

  if (itemId === searchLower) return 900
  if (itemId.startsWith(searchLower)) return 800
  if (itemId.includes(searchLower)) return 700
  if (name === searchLower) return 600
  if (name.startsWith(searchLower)) return 500
  if (tags.some(tag => tag === searchLower)) return 450
  if (name.includes(searchLower)) return 400
  if (notes.includes(searchLower)) return 300
  if (tags.some(tag => tag.includes(searchLower))) return 250
  if (aiSearchText.includes(searchLower)) return 200

  return -1
}

function textFilter(items: Item[], search: string): Item[] {
  const searchLower = search.trim().toLowerCase()

  return items
    .map(item => ({
      item,
      score: getTextMatchScore(item, searchLower),
    }))
    .filter((entry): entry is { item: Item; score: number } => entry.score >= 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score
      }

      const itemIdComparison = left.item.itemId.localeCompare(right.item.itemId)
      if (itemIdComparison !== 0) {
        return itemIdComparison
      }

      return left.item.name.localeCompare(right.item.name)
    })
    .map(entry => entry.item)
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

  if (isNoLocationFilter(location)) {
    query = query.where('locationId', '==', null)
  } else if (!isAllLocationsFilter(location)) {
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
      // Auto mode: start with exact/strong text matches so item IDs and names
      // are easy to find, then append semantic-only matches as a fallback.
      const textMatches = textFilter(items, search)
      try {
        const semanticMatches = await semanticRank(items, search)
        const textIds = new Set(textMatches.map(item => item.id))
        const semanticOnlyMatches = semanticMatches.filter(item => !textIds.has(item.id))
        items = [...textMatches, ...semanticOnlyMatches]
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

export async function getRemovedItems() {
  try {
    const snapshot = await itemsCol()
      .where('deleted', '==', true)
      .get()

    const items = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as Item)
      .map(item => ({
        ...item,
        images: (item.images || []).filter(img => !img.deleted),
      }))
      .sort((left, right) => {
        const leftDeletedAt = left.deletedAt || ''
        const rightDeletedAt = right.deletedAt || ''
        return rightDeletedAt.localeCompare(leftDeletedAt)
      })

    return { items }
  } catch (error) {
    console.error('Failed to fetch removed items:', error)
    return { items: [], error: 'Failed to fetch removed items' }
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
    const normalizedItemId = normalizeItemIdValue(itemId)
    if (!normalizedItemId) {
      return { error: 'Item ID is required' }
    }

    const snapshot = await itemsCol()
      .where('itemId', '==', normalizedItemId)
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

async function setItemRemovedState(id: string, removed: boolean) {
  const now = new Date().toISOString()
  const itemRef = itemsCol().doc(id)
  const doc = await itemRef.get()
  if (!doc.exists) {
    return { error: 'Item not found' }
  }

  await itemRef.update({
    deleted: removed,
    deletedAt: removed ? now : null,
    updatedAt: now,
  })

  const updatedDoc = await itemRef.get()
  const item = { id: updatedDoc.id, ...updatedDoc.data() } as Item
  item.images = (item.images || []).filter(img => !img.deleted)
  return { item }
}

export async function removeItem(id: string) {
  try {
    const result = await setItemRemovedState(id, true)
    if (result.error) {
      return result
    }
    return { success: true }
  } catch (error) {
    console.error('Failed to remove item:', error)
    return { error: 'Failed to remove item' }
  }
}

export async function restoreItem(id: string) {
  try {
    const result = await setItemRemovedState(id, false)
    if (result.error) {
      return result
    }
    return { success: true, item: result.item }
  } catch (error) {
    console.error('Failed to restore item:', error)
    return { error: 'Failed to restore item' }
  }
}

export async function deleteItem(id: string) {
  return removeItem(id)
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
