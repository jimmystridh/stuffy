import { generateText, Output } from 'ai'
import { z } from 'zod'
import type { Item, ItemAiData, ItemAiEmbedding, ItemAiAnalysis, ItemImage } from '@/lib/types'
import { getVertexAccessToken, getVertexLocation, getVertexProject } from './vertex-auth'
import {
  getFlashModelId,
  getMultimodalEmbeddingDimensions,
  getMultimodalEmbeddingModelId,
  getVertexProvider,
} from './vertex-provider'

const imageAnalysisSchema = z.object({
  identifiedName: z.string().describe('A short inventory-friendly name for the item visible in the image.'),
  category: z.string().describe('A concise category such as electronics, kitchenware, furniture, clothing, or tools.'),
  summary: z.string().describe('A short factual summary of the item for inventory search and recall.'),
  attributes: z
    .array(z.string())
    .transform(values => values.map(value => value.trim()).filter(Boolean).slice(0, 16))
    .describe('Visible attributes like color, material, form factor, and notable details.'),
  suggestedTags: z
    .array(z.string())
    .transform(values => values.map(value => value.trim().toLowerCase()).filter(Boolean).slice(0, 16))
    .describe('Useful lowercase tags for this item.'),
  confidence: z.enum(['low', 'medium', 'high']).describe('How confident the model is about the identification based on the image.'),
})

function getActiveImages(item: Item) {
  return (item.images || []).filter(image => !image.deleted)
}

function pickSourceImage(item: Item) {
  const activeImages = getActiveImages(item)
  if (activeImages.length === 0) return null

  return [...activeImages].sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })[0]
}

function buildSearchText(item: Item, analysis: Omit<ItemAiAnalysis, 'model' | 'sourceImageId' | 'analyzedAt'>) {
  return [
    item.name,
    item.notes || '',
    item.tags.join(' '),
    analysis.identifiedName,
    analysis.category,
    analysis.summary,
    analysis.attributes.join(' '),
    analysis.suggestedTags.join(' '),
  ]
    .join(' | ')
    .trim()
}

function buildFallbackSummary(item: Item) {
  const summaryParts = [item.name, item.notes || '', item.tags.join(' ')]
    .map(part => part.trim())
    .filter(Boolean)

  return summaryParts.join(' | ') || `Inventory item ${item.itemId}`
}

function buildMetadataFallbackAnalysis(
  item: Item,
  sourceImageId: string,
  analyzedAt: string
): ItemAiAnalysis {
  const suggestedTags = Array.from(
    new Set(
      item.tags
        .map(tag => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 16)
    )
  )

  return {
    model: 'metadata-fallback',
    identifiedName: item.name.trim() || item.itemId,
    category: 'unknown',
    summary: buildFallbackSummary(item),
    attributes: [],
    suggestedTags,
    confidence: 'low',
    sourceImageId,
    analyzedAt,
  }
}

function getImageGcsUri(image: ItemImage) {
  const bucketName = process.env.GCS_BUCKET_NAME || 'stuffy-uploads'
  return `gs://${bucketName}/images/${image.storedFilename}`
}

function looksLikeSupportedImage(bytes: Uint8Array) {
  if (bytes.length < 4) return false

  return (
    (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
    (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) ||
    (bytes[0] === 0x42 && bytes[1] === 0x4d)
  )
}

async function getUsableImageBytes(image: ItemImage) {
  for (const url of [image.publicUrl, image.thumbnailUrl]) {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) continue

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (looksLikeSupportedImage(bytes)) {
      return bytes
    }
  }

  throw new Error('Failed to load a valid image payload from original or thumbnail')
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!magnitude) return vector
  return vector.map(value => value / magnitude)
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== right.length || left.length === 0) return 0

  let sum = 0
  for (let index = 0; index < left.length; index++) {
    sum += left[index] * right[index]
  }
  return sum
}

async function callMultimodalEmbeddingPredict(body: Record<string, unknown>) {
  const project = getVertexProject()
  const location = getVertexLocation()
  const accessToken = await getVertexAccessToken()
  const model = getMultimodalEmbeddingModelId()
  const response = await fetch(
    `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:predict`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Vertex multimodal embedding request failed: ${response.status} ${errorText}`)
  }

  return response.json() as Promise<{
    predictions?: Array<{
      imageEmbedding?: number[]
      textEmbedding?: number[]
    }>
  }>
}

async function generateImageAnalysis(item: Item, image: ItemImage) {
  const promptText = [
    'Analyze this inventory photo for a personal item catalog.',
    'Return concise, factual metadata for identification and search.',
    'Do not invent serial numbers, brands, or hidden details.',
    `Existing item name: ${item.name || 'unknown'}`,
    `Existing notes: ${item.notes || 'none'}`,
    `Existing tags: ${item.tags.join(', ') || 'none'}`,
  ].join('\n')

  const runAnalysis = async (data: string | Uint8Array) =>
    generateText({
      model: getVertexProvider()(getFlashModelId()),
      output: Output.object({
        name: 'inventory_image_analysis',
        description: 'Structured inventory identification metadata for a single item image.',
        schema: imageAnalysisSchema,
      }),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: promptText,
            },
            {
              type: 'file',
              data,
              mediaType: image.mimeType,
            },
          ],
        },
      ],
    })

  try {
    const { output } = await runAnalysis(image.publicUrl)
    return output
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (!message.includes('Provided image is not valid.')) {
      throw error
    }

    const { output } = await runAnalysis(await getUsableImageBytes(image))
    return output
  }
}

async function generateImageEmbedding(image: ItemImage): Promise<ItemAiEmbedding> {
  const dimensions = getMultimodalEmbeddingDimensions()
  const requestBody = {
    parameters: {
      dimension: dimensions,
    },
  }

  let data: Awaited<ReturnType<typeof callMultimodalEmbeddingPredict>>

  try {
    data = await callMultimodalEmbeddingPredict({
      ...requestBody,
      instances: [
        {
          image: {
            gcsUri: getImageGcsUri(image),
          },
        },
      ],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''

    // Some older uploads have bad object metadata or broken originals,
    // even though the generated thumbnail is still a valid image.
    if (!message.includes('Unsupported image content with type: UNKNOWN')) {
      throw error
    }

    const imageBytes = Buffer.from(await getUsableImageBytes(image)).toString('base64')

    data = await callMultimodalEmbeddingPredict({
      ...requestBody,
      instances: [
        {
          image: {
            bytesBase64Encoded: imageBytes,
          },
        },
      ],
    })
  }

  const vector = data.predictions?.[0]?.imageEmbedding
  if (!vector || vector.length === 0) {
    throw new Error('Vertex did not return an image embedding')
  }

  return {
    model: getMultimodalEmbeddingModelId(),
    dimensions,
    vector: normalizeVector(vector),
    normalized: true,
    sourceImageId: image.id,
    indexedAt: new Date().toISOString(),
  }
}

async function generateTextEmbedding(text: string, sourceImageId: string): Promise<ItemAiEmbedding> {
  const trimmedText = text.trim()
  if (!trimmedText) {
    throw new Error('Fallback embedding text cannot be empty')
  }

  const dimensions = getMultimodalEmbeddingDimensions()
  const data = await callMultimodalEmbeddingPredict({
    instances: [
      {
        text: trimmedText,
      },
    ],
    parameters: {
      dimension: dimensions,
    },
  })

  const vector = data.predictions?.[0]?.textEmbedding
  if (!vector || vector.length === 0) {
    throw new Error('Vertex did not return a text embedding for fallback indexing')
  }

  return {
    model: getMultimodalEmbeddingModelId(),
    dimensions,
    vector: normalizeVector(vector),
    normalized: true,
    sourceImageId,
    indexedAt: new Date().toISOString(),
  }
}

function shouldUseMetadataFallback(error: unknown) {
  if (!(error instanceof Error)) return false

  return (
    error.message.includes('Provided image is not valid.') ||
    error.message.includes('Unsupported image content with type: UNKNOWN')
  )
}

export async function generateSemanticQueryEmbedding(query: string) {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    throw new Error('Semantic query cannot be empty')
  }

  const dimensions = getMultimodalEmbeddingDimensions()
  const data = await callMultimodalEmbeddingPredict({
    instances: [
      {
        text: trimmedQuery,
      },
    ],
    parameters: {
      dimension: dimensions,
    },
  })

  const vector = data.predictions?.[0]?.textEmbedding
  if (!vector || vector.length === 0) {
    throw new Error('Vertex did not return a text embedding')
  }

  return normalizeVector(vector)
}

export async function buildItemAiData(item: Item): Promise<ItemAiData | null> {
  const sourceImage = pickSourceImage(item)
  if (!sourceImage) return null

  try {
    const [analysisResult, imageEmbedding] = await Promise.all([
      generateImageAnalysis(item, sourceImage),
      generateImageEmbedding(sourceImage),
    ])

    const analysis: ItemAiAnalysis = {
      model: getFlashModelId(),
      identifiedName: analysisResult.identifiedName,
      category: analysisResult.category,
      summary: analysisResult.summary,
      attributes: analysisResult.attributes,
      suggestedTags: analysisResult.suggestedTags.map(tag => tag.toLowerCase()),
      confidence: analysisResult.confidence,
      sourceImageId: sourceImage.id,
      analyzedAt: new Date().toISOString(),
    }

    return {
      analysis,
      imageEmbedding,
      searchText: buildSearchText(item, analysisResult),
    }
  } catch (error) {
    if (!shouldUseMetadataFallback(error)) {
      throw error
    }

    const analyzedAt = new Date().toISOString()
    const analysis = buildMetadataFallbackAnalysis(item, sourceImage.id, analyzedAt)
    const searchText = buildSearchText(item, analysis)
    const imageEmbedding = await generateTextEmbedding(searchText, sourceImage.id)

    return {
      analysis,
      imageEmbedding,
      searchText,
    }
  }
}
