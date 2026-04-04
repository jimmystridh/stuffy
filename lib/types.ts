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
}

export interface GetItemsParams {
  page?: number
  pageSize?: number
  orderBy?: {
    field: string
    direction: 'asc' | 'desc'
  }
  tags?: string[]
  search?: string
  location?: string
}

export interface GetItemsResponse {
  items: Item[]
  totalItems: number
  error?: string
}
