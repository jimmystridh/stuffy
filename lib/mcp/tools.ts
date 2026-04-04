import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  getItems,
  getItemById,
  getItemByItemId,
  getAllTags,
  deleteItem,
  deleteItemImage,
  refreshItemAi,
  createItemFromData,
  updateItemFromData,
} from '@/app/actions/items'
import {
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
} from '@/app/actions/locations'
import {
  startStocktaking,
  getStocktakingSession,
  getStocktakingItems,
  markItem,
  completeStocktaking,
} from '@/app/actions/stocktaking'

function okResult(data: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data) }],
    structuredContent: data,
  }
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    structuredContent: { ok: false, error: message },
    isError: true,
  }
}

export function registerMcpTools(server: McpServer) {
  // --- Read tools ---

  server.registerTool(
    'search_items',
    {
      description: 'Search and list inventory items with filtering, pagination, and text/semantic search',
      inputSchema: {
        page: z.number().int().positive().optional().describe('Page number (default 1)'),
        pageSize: z.number().int().positive().max(100).optional().describe('Items per page (default 18, max 100)'),
        search: z.string().optional().describe('Search query for text or semantic search'),
        searchMode: z.enum(['auto', 'text', 'ai']).optional().describe('Search mode: auto (combined), text (keyword), ai (semantic)'),
        tags: z.array(z.string()).optional().describe('Filter by tags'),
        location: z.string().optional().describe('Filter by location name'),
        orderByField: z.string().optional().describe('Sort field (default: name)'),
        orderByDirection: z.enum(['asc', 'desc']).optional().describe('Sort direction (default: asc)'),
      },
    },
    async ({ page, pageSize, search, searchMode, tags, location, orderByField, orderByDirection }) => {
      const result = await getItems({
        page: page ?? 1,
        pageSize: pageSize ?? 18,
        search: search ?? '',
        searchMode: searchMode ?? 'auto',
        tags: tags ?? [],
        location: location ?? '',
        orderBy: {
          field: orderByField ?? 'name',
          direction: orderByDirection ?? 'asc',
        },
      })
      if (result.error) return errorResult(result.error)
      return okResult({
        items: result.items.map(stripEmbeddings),
        totalItems: result.totalItems,
        page: page ?? 1,
        pageSize: pageSize ?? 18,
      })
    }
  )

  server.registerTool(
    'get_item',
    {
      description: 'Get a single inventory item by its Firestore document ID or user-facing item ID',
      inputSchema: {
        id: z.string().optional().describe('Firestore document ID'),
        itemId: z.string().optional().describe('User-facing item ID (e.g. "laptop-01")'),
      },
    },
    async ({ id, itemId }) => {
      if (!id && !itemId) return errorResult('Either id or itemId is required')
      const result = id ? await getItemById(id) : await getItemByItemId(itemId!)
      if (result.error) return errorResult(result.error)
      return okResult({ item: stripEmbeddings(result.item!) })
    }
  )

  server.registerTool(
    'list_locations',
    {
      description: 'List all storage locations',
      inputSchema: {},
    },
    async () => {
      const result = await getLocations()
      if (result.error) return errorResult(result.error)
      return okResult({ locations: result.locations })
    }
  )

  server.registerTool(
    'list_tags',
    {
      description: 'List all unique tags across all items',
      inputSchema: {},
    },
    async () => {
      const tags = await getAllTags()
      return okResult({ tags })
    }
  )

  // --- Write tools ---

  server.registerTool(
    'create_item',
    {
      description: 'Create a new inventory item. Images can be attached via URLs (the server fetches and stores them).',
      inputSchema: {
        itemId: z.string().min(1).describe('Unique item identifier (e.g. "laptop-01")'),
        name: z.string().min(1).describe('Item name'),
        notes: z.string().optional().describe('Optional notes'),
        purchasePrice: z.string().optional().describe('Purchase price as string'),
        acquisitionDate: z.string().optional().describe('Acquisition date (ISO format)'),
        locationId: z.string().optional().describe('Location Firestore document ID'),
        tags: z.array(z.string()).optional().describe('Tags for the item'),
        imageUrls: z.array(z.string().url()).optional().describe('Image URLs to fetch and attach to the item'),
      },
    },
    async ({ itemId, name, notes, purchasePrice, acquisitionDate, locationId, tags, imageUrls }) => {
      const result = await createItemFromData({
        itemId,
        name,
        notes: notes ?? null,
        purchasePrice: purchasePrice ?? null,
        acquisitionDate: acquisitionDate ?? null,
        locationId: locationId ?? null,
        tags: tags ?? [],
        imageUrls: imageUrls ?? [],
      })
      if (result.error) return errorResult(result.error)
      return okResult({ item: stripEmbeddings(result.item!) })
    }
  )

  server.registerTool(
    'update_item',
    {
      description: 'Update an existing inventory item. Only provided fields are changed. Images can be added via URLs.',
      inputSchema: {
        id: z.string().min(1).describe('Firestore document ID of the item'),
        itemId: z.string().optional().describe('New item identifier'),
        name: z.string().optional().describe('New item name'),
        notes: z.string().nullable().optional().describe('New notes (null to clear)'),
        purchasePrice: z.string().nullable().optional().describe('New purchase price (null to clear)'),
        acquisitionDate: z.string().nullable().optional().describe('New acquisition date (null to clear)'),
        locationId: z.string().nullable().optional().describe('New location ID (null to clear)'),
        tags: z.array(z.string()).optional().describe('New tags (replaces all existing tags)'),
        imageUrls: z.array(z.string().url()).optional().describe('Image URLs to fetch and add to the item'),
      },
    },
    async ({ id, ...data }) => {
      const result = await updateItemFromData(id, data)
      if (result.error) return errorResult(result.error)
      return okResult({ item: stripEmbeddings(result.item!) })
    }
  )

  server.registerTool(
    'delete_item',
    {
      description: 'Soft-delete an inventory item',
      inputSchema: {
        id: z.string().min(1).describe('Firestore document ID of the item'),
      },
    },
    async ({ id }) => {
      const result = await deleteItem(id)
      if (result.error) return errorResult(result.error)
      return okResult({ ok: true })
    }
  )

  server.registerTool(
    'delete_item_image',
    {
      description: 'Soft-delete a specific image from an item',
      inputSchema: {
        itemId: z.string().min(1).describe('Firestore document ID of the item'),
        imageId: z.string().min(1).describe('Image ID to delete'),
      },
    },
    async ({ itemId, imageId }) => {
      const result = await deleteItemImage(itemId, imageId)
      if (result.error) return errorResult(result.error)
      return okResult({ ok: true })
    }
  )

  server.registerTool(
    'refresh_item_ai',
    {
      description: 'Regenerate AI analysis and embeddings for an item',
      inputSchema: {
        id: z.string().min(1).describe('Firestore document ID of the item'),
      },
    },
    async ({ id }) => {
      const result = await refreshItemAi(id)
      if (result.error) return errorResult(result.error)
      return okResult({ item: stripEmbeddings(result.item!) })
    }
  )

  server.registerTool(
    'create_location',
    {
      description: 'Create a new storage location',
      inputSchema: {
        name: z.string().min(1).describe('Location name'),
        notes: z.string().optional().describe('Optional notes about the location'),
      },
    },
    async ({ name, notes }) => {
      const result = await createLocation({ name, notes })
      if (result.error) return errorResult(result.error)
      return okResult({ location: result.location })
    }
  )

  server.registerTool(
    'update_location',
    {
      description: 'Update an existing storage location',
      inputSchema: {
        id: z.string().min(1).describe('Firestore document ID of the location'),
        name: z.string().min(1).describe('New location name'),
        notes: z.string().optional().describe('New notes'),
      },
    },
    async ({ id, name, notes }) => {
      const result = await updateLocation(id, { name, notes })
      if (result.error) return errorResult(result.error)
      return okResult({ location: result.location })
    }
  )

  server.registerTool(
    'delete_location',
    {
      description: 'Delete a storage location',
      inputSchema: {
        id: z.string().min(1).describe('Firestore document ID of the location'),
      },
    },
    async ({ id }) => {
      const result = await deleteLocation(id)
      if (result.error) return errorResult(result.error)
      return okResult({ ok: true })
    }
  )

  // --- Stocktaking tools ---

  server.registerTool(
    'start_stocktaking',
    {
      description: 'Start a stocktaking (inventory check) session for a location',
      inputSchema: {
        locationId: z.string().min(1).describe('Firestore document ID of the location'),
      },
    },
    async ({ locationId }) => {
      const result = await startStocktaking(locationId)
      if (result.error) return errorResult(result.error)
      return okResult({ session: result.session })
    }
  )

  server.registerTool(
    'get_stocktaking_session',
    {
      description: 'Get the current state of a stocktaking session',
      inputSchema: {
        sessionId: z.string().min(1).describe('Session ID'),
      },
    },
    async ({ sessionId }) => {
      const result = await getStocktakingSession(sessionId)
      if (result.error) return errorResult(result.error)
      return okResult({ session: result.session })
    }
  )

  server.registerTool(
    'get_stocktaking_items',
    {
      description: 'Get all items at a location for stocktaking',
      inputSchema: {
        locationId: z.string().min(1).describe('Firestore document ID of the location'),
      },
    },
    async ({ locationId }) => {
      const items = await getStocktakingItems(locationId)
      return okResult({ items: items.map(stripEmbeddings) })
    }
  )

  server.registerTool(
    'mark_stocktaking_item',
    {
      description: 'Mark an item as found or missing during stocktaking. Missing items have their location cleared.',
      inputSchema: {
        sessionId: z.string().min(1).describe('Stocktaking session ID'),
        itemId: z.string().min(1).describe('Firestore document ID of the item'),
        status: z.enum(['found', 'missing']).describe('Whether the item was found or is missing'),
      },
    },
    async ({ sessionId, itemId, status }) => {
      const result = await markItem(sessionId, itemId, status)
      if (result.error) return errorResult(result.error)
      return okResult({ ok: true })
    }
  )

  server.registerTool(
    'complete_stocktaking',
    {
      description: 'Complete a stocktaking session',
      inputSchema: {
        sessionId: z.string().min(1).describe('Stocktaking session ID'),
      },
    },
    async ({ sessionId }) => {
      const result = await completeStocktaking(sessionId)
      if (result.error) return errorResult(result.error)
      return okResult({ ok: true })
    }
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripEmbeddings(item: any) {
  if (!item) return item
  const ai = item.ai
  if (!ai) return item
  return {
    ...item,
    ai: {
      ...ai,
      imageEmbedding: ai.imageEmbedding
        ? { ...ai.imageEmbedding, vector: '[omitted]' }
        : null,
    },
  }
}
