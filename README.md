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

## Google Drive Backups

The app includes a daily backup job that exports:

- all top-level Firestore collections as JSON
- all objects under `images/` in the configured GCS bucket

Each run creates a `tar.gz` snapshot in a dedicated Google Drive folder and prunes older snapshots with this default retention policy:

- 7 daily snapshots
- 8 weekly snapshots
- 12 monthly snapshots
- 3 yearly snapshots

If two completed snapshots contain exactly the same exported data and images, the backup job keeps only the newest one.

### Required setup

1. Enable the Google Drive API in the same Google Cloud project used for your OAuth client.
2. Create an OAuth client that can mint a refresh token for the scope `https://www.googleapis.com/auth/drive.file`.
3. Put these values in `.env.local` for local runs and in GitHub Actions secrets for production deploys:

```bash
GOOGLE_DRIVE_CLIENT_ID=
GOOGLE_DRIVE_CLIENT_SECRET=
GOOGLE_DRIVE_REFRESH_TOKEN=
BACKUP_CRON_SECRET=
```

Optional values:

```bash
GOOGLE_DRIVE_BACKUP_ROOT_FOLDER_ID=
GOOGLE_DRIVE_BACKUP_FOLDER_NAME=Stuffy Backups
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=8
BACKUP_RETENTION_MONTHLY=12
BACKUP_RETENTION_YEARLY=3
BACKUP_RETENTION_TIMEZONE=Europe/Stockholm
```

If `GOOGLE_DRIVE_BACKUP_ROOT_FOLDER_ID` is omitted, the backup job creates and reuses a `Stuffy Backups` folder in Drive automatically.

### Running manually

Run the same backup flow locally with:

```bash
npm run backup:drive
```

The deployed app exposes `POST /api/admin/backups/drive` for the scheduler. Authenticate with either:

- `X-Backup-Secret: <BACKUP_CRON_SECRET>`
- `Authorization: Bearer <BACKUP_CRON_SECRET>`

### Production schedule

The deploy workflow now updates a Cloud Scheduler job after each deploy. By default it runs every day at `02:17` in `Europe/Stockholm` and calls the protected backup route on Cloud Run. The scheduler job itself is created in `europe-west1`, because Cloud Scheduler is not available in `europe-north1`.
