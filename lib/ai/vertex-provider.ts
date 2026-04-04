import { createVertex } from '@ai-sdk/google-vertex'
import {
  getGoogleAuthOptions,
  getVertexAccessToken,
  getVertexLocation,
  getVertexProject,
} from './vertex-auth'

let provider: ReturnType<typeof createVertex> | undefined

export function getVertexProvider() {
  if (!provider) {
    provider = createVertex({
      project: getVertexProject(),
      location: getVertexLocation(),
      googleAuthOptions: getGoogleAuthOptions(),
      headers: async () => ({
        Authorization: `Bearer ${await getVertexAccessToken()}`,
      }),
    })
  }

  return provider
}

export function getFlashModelId() {
  return process.env.GOOGLE_VERTEX_FLASH_MODEL || 'gemini-2.5-flash'
}

export function getMultimodalEmbeddingModelId() {
  return process.env.GOOGLE_VERTEX_MULTIMODAL_EMBEDDING_MODEL || 'multimodalembedding@001'
}

export function getMultimodalEmbeddingDimensions() {
  const raw = process.env.GOOGLE_VERTEX_MULTIMODAL_EMBEDDING_DIMENSIONS || '512'
  const dimensions = Number.parseInt(raw, 10)
  return Number.isFinite(dimensions) ? dimensions : 512
}
