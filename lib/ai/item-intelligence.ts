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

function getImageGcsUri(image: ItemImage) {
  const bucketName = process.env.GCS_BUCKET_NAME || 'stuffy-uploads'
  return `gs://${bucketName}/images/${image.storedFilename}`
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
  const { output } = await generateText({
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
            text: [
              'Analyze this inventory photo for a personal item catalog.',
              'Return concise, factual metadata for identification and search.',
              'Do not invent serial numbers, brands, or hidden details.',
              `Existing item name: ${item.name || 'unknown'}`,
              `Existing notes: ${item.notes || 'none'}`,
              `Existing tags: ${item.tags.join(', ') || 'none'}`,
            ].join('\n'),
          },
          {
            type: 'file',
            data: image.publicUrl,
            mediaType: image.mimeType,
          },
        ],
      },
    ],
  })

  return output
}

async function generateImageEmbedding(image: ItemImage): Promise<ItemAiEmbedding> {
  const dimensions = getMultimodalEmbeddingDimensions()
  const data = await callMultimodalEmbeddingPredict({
    instances: [
      {
        image: {
          gcsUri: getImageGcsUri(image),
        },
      },
    ],
    parameters: {
      dimension: dimensions,
    },
  })

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
}
