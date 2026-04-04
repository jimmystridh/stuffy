export interface ItemImage {
  id: string
  itemId: string
  filename: string
  storedFilename: string
  thumbnailFilename: string
  publicUrl: string
  thumbnailUrl: string
  mimeType: string
  size: number
  createdAt: string
  deleted: boolean
  deletedAt: string | null
}

export interface ItemAiAnalysis {
  model: string
  identifiedName: string
  category: string
  summary: string
  attributes: string[]
  suggestedTags: string[]
  confidence: 'low' | 'medium' | 'high'
  sourceImageId: string
  analyzedAt: string
}

export interface ItemAiEmbedding {
  model: string
  dimensions: number
  vector: number[]
  normalized: boolean
  sourceImageId: string
  indexedAt: string
}

export interface ItemAiData {
  analysis: ItemAiAnalysis
  imageEmbedding: ItemAiEmbedding
  searchText: string
}

export interface Location {
  id: string
  name: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Item {
  id: string
  itemId: string
  name: string
  notes: string | null
  purchasePrice: string | null
  acquisitionDate: string | null
  locationId: string | null
  tags: string[]
  images: ItemImage[]
  location: Location | null
  createdAt: string
  updatedAt: string
  deleted: boolean
  deletedAt: string | null
  ai: ItemAiData | null
}

export type SearchMode = 'auto' | 'text' | 'ai'

export interface GetItemsParams {
  page?: number
  pageSize?: number
  orderBy?: {
    field: string
    direction: 'asc' | 'desc'
  }
  tags?: string[]
  search?: string
  searchMode?: SearchMode
  location?: string
}

export interface GetItemsResponse {
  items: Item[]
  totalItems: number
  error?: string
}
