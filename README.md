# Stuffy

Personal inventory tracker built with Next.js, Firebase, Google Cloud Storage, and Vertex AI.

## Getting Started

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Vertex AI Setup

This project uses:

- `gemini-2.5-flash` through the Vercel AI SDK to identify items from images
- `multimodalembedding@001` to create normalized image embeddings for semantic search

Set these environment variables:

```bash
GOOGLE_VERTEX_PROJECT=your-gcp-project
GOOGLE_VERTEX_LOCATION=us-central1
GOOGLE_VERTEX_FLASH_MODEL=gemini-2.5-flash
GOOGLE_VERTEX_MULTIMODAL_EMBEDDING_MODEL=multimodalembedding@001
GOOGLE_VERTEX_MULTIMODAL_EMBEDDING_DIMENSIONS=512
```

Authentication defaults to the existing `FIREBASE_ADMIN_*` service account variables already used by the app. If you prefer, you can also authenticate with standard Google Application Default Credentials.

You also need:

- Vertex AI API enabled in your Google Cloud project
- Access to the configured GCS bucket in `GCS_BUCKET_NAME`

## AI Features

- Item pages can analyze saved images with Gemini Flash and store AI identification metadata.
- Inventory search includes an explicit AI search box that ranks items from stored image embeddings.
- New and updated items automatically attempt AI indexing when saved.

To backfill AI metadata for existing items, run:

```bash
npm run ai:backfill
```
