# Stuffy - Personal Inventory Tracker

Next.js 16 app using Firebase (Firestore + Auth) and Google Cloud Storage.

## Stack
- **Framework**: Next.js 16 (App Router, Server Actions)
- **Database**: Firestore
- **Storage**: Google Cloud Storage (bucket: stuffy-uploads)
- **Auth**: Firebase Auth (Google provider, email allowlist)
- **UI**: shadcn/ui, Tailwind CSS v3, Radix UI, lucide-react
- **Deploy**: Cloud Run via GitHub Actions

## Key directories
- `app/actions/` — Server actions (items.ts, locations.ts)
- `lib/firebase/` — Firebase client, admin, storage, auth context
- `lib/file-storage.ts` — Image upload/processing with Sharp + GCS
- `components/` — UI components, page components
- `scripts/migrate.ts` — Data migration from PostgreSQL backup

## Running locally
```sh
npm run dev
```

## Migration
```sh
npx tsx scripts/migrate.ts
```

## Deploy
Push to `main` triggers GitHub Actions → Cloud Run deploy.
