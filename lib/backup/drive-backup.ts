import { createHash, timingSafeEqual } from 'crypto'
import { createReadStream } from 'fs'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { Readable } from 'stream'
import { OAuth2Client } from 'google-auth-library'
import { create as createTar } from 'tar'
import { adminDb } from '@/lib/firebase/admin'
import { bucket } from '@/lib/firebase/storage'

const DRIVE_API_BASE_URL = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE_URL = 'https://www.googleapis.com/upload/drive/v3'
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const DEFAULT_BACKUP_FOLDER_NAME = 'Stuffy Backups'
const DEFAULT_RETENTION_TIMEZONE = 'Europe/Stockholm'
const STORAGE_PREFIX = 'images/'
const MANIFEST_VERSION = 2

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

interface RetentionPolicy {
  daily: number
  weekly: number
  monthly: number
  yearly: number
  timeZone: string
}

interface DriveFileRecord {
  id: string
  name: string
  createdTime?: string
  appProperties?: Record<string, string>
}

interface ExportedCollectionSummary {
  path: string
  documentCount: number
  filename: string
}

interface ExportedStorageObjectSummary {
  name: string
  size: number
}

export interface DriveBackupResult {
  startedAt: string
  finishedAt: string
  archiveName: string
  archiveSizeBytes: number
  archiveSha256: string
  contentSha256: string
  rootFolderId: string
  snapshotFolderId: string
  archiveFileId: string
  manifestFileId: string
  firestoreCollections: ExportedCollectionSummary[]
  firestoreDocumentCount: number
  storageObjectCount: number
  storageBytes: number
  deletedDuplicateSnapshotFolderIds: string[]
  deletedSnapshotFolderIds: string[]
}

function readRequiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`${name} is not configured`)
  }
  return value
}

function readPositiveIntEnv(name: string, fallback: number) {
  const raw = process.env[name]
  if (!raw) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }

  return parsed
}

function getRetentionPolicy(): RetentionPolicy {
  return {
    daily: readPositiveIntEnv('BACKUP_RETENTION_DAILY', 7),
    weekly: readPositiveIntEnv('BACKUP_RETENTION_WEEKLY', 8),
    monthly: readPositiveIntEnv('BACKUP_RETENTION_MONTHLY', 12),
    yearly: readPositiveIntEnv('BACKUP_RETENTION_YEARLY', 3),
    timeZone: process.env.BACKUP_RETENTION_TIMEZONE?.trim() || DEFAULT_RETENTION_TIMEZONE,
  }
}

function getDriveFolderName() {
  return process.env.GOOGLE_DRIVE_BACKUP_FOLDER_NAME?.trim() || DEFAULT_BACKUP_FOLDER_NAME
}

function buildTimestampSlug(isoTimestamp: string) {
  return isoTimestamp.replace(/:/g, '-').replace(/\.\d{3}Z$/, 'Z')
}

function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function serializeJsonValue(value: unknown): JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Buffer.isBuffer(value)) {
    return {
      encoding: 'base64',
      value: value.toString('base64'),
    }
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeJsonValue(entry))
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown> & {
      toDate?: () => Date
      path?: string
    }

    if (typeof record.toDate === 'function') {
      const converted = record.toDate()
      if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
        return converted.toISOString()
      }
    }

    if (typeof record.path === 'string' && Object.keys(record).length <= 3) {
      return {
        path: record.path,
      }
    }

    return Object.fromEntries(
      Object.entries(record)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, serializeJsonValue(entryValue)])
    )
  }

  return String(value)
}

function getZonedDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const partMap = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  )

  return {
    year: Number.parseInt(partMap.year, 10),
    month: Number.parseInt(partMap.month, 10),
    day: Number.parseInt(partMap.day, 10),
  }
}

function getDayBucketKey(date: Date, timeZone: string) {
  const { year, month, day } = getZonedDateParts(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getMonthBucketKey(date: Date, timeZone: string) {
  const { year, month } = getZonedDateParts(date, timeZone)
  return `${year}-${String(month).padStart(2, '0')}`
}

function getYearBucketKey(date: Date, timeZone: string) {
  return String(getZonedDateParts(date, timeZone).year)
}

function getIsoWeekBucketKey(date: Date, timeZone: string) {
  const { year, month, day } = getZonedDateParts(date, timeZone)
  const normalized = new Date(Date.UTC(year, month - 1, day))
  const dayOfWeek = normalized.getUTCDay() || 7
  normalized.setUTCDate(normalized.getUTCDate() + 4 - dayOfWeek)
  const weekYear = normalized.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const weekNumber = Math.ceil((((normalized.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${weekYear}-W${String(weekNumber).padStart(2, '0')}`
}

async function hashFileSha256(filePath: string) {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)

  for await (const chunk of stream) {
    hash.update(chunk)
  }

  return hash.digest('hex')
}

async function listRelativeFilesRecursively(rootDir: string, currentDir = rootDir): Promise<string[]> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  const sortedEntries = [...entries].sort((left, right) => left.name.localeCompare(right.name))
  const results: string[] = []

  for (const entry of sortedEntries) {
    const entryPath = path.join(currentDir, entry.name)

    if (entry.isDirectory()) {
      results.push(...(await listRelativeFilesRecursively(rootDir, entryPath)))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    results.push(path.relative(rootDir, entryPath))
  }

  return results
}

async function hashDirectoryContentsSha256(rootDir: string) {
  const hash = createHash('sha256')
  const files = await listRelativeFilesRecursively(rootDir)

  for (const relativeFilePath of files) {
    const normalizedRelativePath = relativeFilePath.split(path.sep).join('/')
    const absoluteFilePath = path.join(rootDir, relativeFilePath)
    const stats = await fs.stat(absoluteFilePath)

    hash.update(`path:${normalizedRelativePath}\n`)
    hash.update(`size:${stats.size}\n`)

    const stream = createReadStream(absoluteFilePath)
    for await (const chunk of stream) {
      hash.update(chunk)
    }

    hash.update('\n')
  }

  return hash.digest('hex')
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T, index: number) => Promise<void>
) {
  if (values.length === 0) return

  let currentIndex = 0
  const workerCount = Math.min(concurrency, values.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = currentIndex
        currentIndex += 1

        if (index >= values.length) {
          return
        }

        await worker(values[index], index)
      }
    })
  )
}

function createDriveAuthClient() {
  const client = new OAuth2Client(
    readRequiredEnv('GOOGLE_DRIVE_CLIENT_ID'),
    readRequiredEnv('GOOGLE_DRIVE_CLIENT_SECRET')
  )

  client.setCredentials({
    refresh_token: readRequiredEnv('GOOGLE_DRIVE_REFRESH_TOKEN'),
    scope: DRIVE_SCOPE,
  })

  return client
}

async function driveRequest<T>(
  authClient: OAuth2Client,
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const authHeaders = await authClient.getRequestHeaders()
  const requestHeaders = new Headers(init.headers)

  new Headers(authHeaders as HeadersInit).forEach((value, key) => {
    requestHeaders.set(key, value)
  })

  const response = await fetch(input, {
    ...init,
    headers: requestHeaders,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Drive request failed (${response.status}): ${text}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function driveRequestRaw(authClient: OAuth2Client, input: string, init: RequestInit = {}) {
  const authHeaders = await authClient.getRequestHeaders()
  const requestHeaders = new Headers(init.headers)

  new Headers(authHeaders as HeadersInit).forEach((value, key) => {
    requestHeaders.set(key, value)
  })

  const response = await fetch(input, {
    ...init,
    headers: requestHeaders,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Google Drive request failed (${response.status}): ${text}`)
  }

  return response
}

async function listDriveFiles(
  authClient: OAuth2Client,
  query: string,
  fields = 'files(id,name,createdTime,appProperties),nextPageToken'
) {
  const files: DriveFileRecord[] = []
  let pageToken: string | undefined

  do {
    const url = new URL(`${DRIVE_API_BASE_URL}/files`)
    url.searchParams.set('q', query)
    url.searchParams.set('fields', fields)
    url.searchParams.set('pageSize', '1000')
    url.searchParams.set('supportsAllDrives', 'true')
    url.searchParams.set('includeItemsFromAllDrives', 'true')
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken)
    }

    const response = await driveRequest<{
      files: DriveFileRecord[]
      nextPageToken?: string
    }>(authClient, url.toString())

    files.push(...(response.files || []))
    pageToken = response.nextPageToken
  } while (pageToken)

  return files
}

async function createDriveFolder(
  authClient: OAuth2Client,
  name: string,
  parentId?: string,
  appProperties?: Record<string, string>
) {
  return driveRequest<DriveFileRecord>(authClient, `${DRIVE_API_BASE_URL}/files?supportsAllDrives=true`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      parents: parentId ? [parentId] : undefined,
      mimeType: DRIVE_FOLDER_MIME_TYPE,
      appProperties,
    }),
  })
}

async function updateDriveFile(
  authClient: OAuth2Client,
  fileId: string,
  body: Record<string, unknown>
) {
  return driveRequest<DriveFileRecord>(
    authClient,
    `${DRIVE_API_BASE_URL}/files/${fileId}?supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
}

async function deleteDriveFile(authClient: OAuth2Client, fileId: string) {
  await driveRequest<void>(authClient, `${DRIVE_API_BASE_URL}/files/${fileId}?supportsAllDrives=true`, {
    method: 'DELETE',
  })
}

async function uploadDriveFile(
  authClient: OAuth2Client,
  filePath: string,
  name: string,
  parentId: string,
  mimeType: string,
  appProperties?: Record<string, string>
) {
  const stats = await fs.stat(filePath)
  const sessionResponse = await driveRequestRaw(
    authClient,
    `${DRIVE_UPLOAD_BASE_URL}/files?uploadType=resumable&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType,
        'X-Upload-Content-Length': String(stats.size),
      },
      body: JSON.stringify({
        name,
        parents: [parentId],
        mimeType,
        appProperties,
      }),
    }
  )

  const uploadUrl = sessionResponse.headers.get('location')
  if (!uploadUrl) {
    throw new Error('Google Drive resumable upload did not return a location header')
  }

  const stream = Readable.toWeb(createReadStream(filePath)) as unknown as BodyInit

  return driveRequest<DriveFileRecord>(authClient, uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(stats.size),
      'Content-Type': mimeType,
    },
    body: stream,
    duplex: 'half' as never,
  } as RequestInit)
}

async function ensureDriveRootFolder(authClient: OAuth2Client) {
  const configuredRootId = process.env.GOOGLE_DRIVE_BACKUP_ROOT_FOLDER_ID?.trim()
  if (configuredRootId) {
    return configuredRootId
  }

  const folderName = getDriveFolderName()
  const existingFolders = await listDriveFiles(
    authClient,
    `mimeType='${DRIVE_FOLDER_MIME_TYPE}' and trashed=false and name='${escapeDriveQueryValue(folderName)}'`
  )

  const managedFolder = existingFolders.find(
    (file) => file.appProperties?.stuffyBackupKind === 'root'
  )
  if (managedFolder) {
    return managedFolder.id
  }

  if (existingFolders[0]) {
    return existingFolders[0].id
  }

  const createdFolder = await createDriveFolder(authClient, folderName, undefined, {
    stuffyBackupKind: 'root',
  })
  return createdFolder.id
}

async function exportFirestoreCollections(destinationDir: string) {
  const collections = (await adminDb.listCollections()).sort((left, right) =>
    left.path.localeCompare(right.path)
  )
  const summaries: ExportedCollectionSummary[] = []
  let totalDocuments = 0

  for (const collection of collections) {
    const snapshot = await collection.get()
    const serializedDocuments = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        data: serializeJsonValue(doc.data()),
      }))
      .sort((left, right) => left.id.localeCompare(right.id))

    const filename = `${collection.id}.json`
    await writeJsonFile(path.join(destinationDir, filename), {
      path: collection.path,
      documentCount: snapshot.size,
      documents: serializedDocuments,
    })

    totalDocuments += snapshot.size
    summaries.push({
      path: collection.path,
      documentCount: snapshot.size,
      filename,
    })
  }

  return {
    summaries,
    totalDocuments,
  }
}

async function exportStorageObjects(destinationDir: string) {
  const [files] = await bucket.getFiles({ prefix: STORAGE_PREFIX })
  const filteredFiles = files
    .filter((file) => !file.name.endsWith('/'))
    .sort((left, right) => left.name.localeCompare(right.name))

  const objects: ExportedStorageObjectSummary[] = []
  let totalBytes = 0

  await mapWithConcurrency(filteredFiles, 4, async (file) => {
    const destinationPath = path.join(destinationDir, file.name)
    await fs.mkdir(path.dirname(destinationPath), { recursive: true })
    await file.download({ destination: destinationPath })
    const stats = await fs.stat(destinationPath)
    totalBytes += stats.size
    objects.push({
      name: file.name,
      size: stats.size,
    })
  })

  objects.sort((left, right) => left.name.localeCompare(right.name))
  await writeJsonFile(path.join(destinationDir, 'storage-manifest.json'), {
    prefix: STORAGE_PREFIX,
    objectCount: objects.length,
    objects,
  })

  return {
    objects,
    totalBytes,
  }
}

interface SnapshotFolderSummary {
  id: string
  createdAt: string
  contentSha256?: string
}

async function listCompletedSnapshots(authClient: OAuth2Client, rootFolderId: string) {
  const snapshotFolders = await listDriveFiles(
    authClient,
    `'${escapeDriveQueryValue(rootFolderId)}' in parents and mimeType='${DRIVE_FOLDER_MIME_TYPE}' and trashed=false`
  )

  return snapshotFolders
    .filter((file) => file.appProperties?.stuffyBackupKind === 'snapshot')
    .filter((file) => file.appProperties?.status === 'complete')
    .map((file) => ({
      id: file.id,
      createdAt: file.appProperties?.createdAt || file.createdTime || new Date(0).toISOString(),
      contentSha256: file.appProperties?.contentSha256,
    }))
}

function buildKeepSet(snapshots: SnapshotFolderSummary[], retention: RetentionPolicy) {
  const keepIds = new Set<string>()
  const sortedSnapshots = [...snapshots].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  )

  const categories: Array<{
    limit: number
    getKey: (date: Date, timeZone: string) => string
  }> = [
    { limit: retention.daily, getKey: getDayBucketKey },
    { limit: retention.weekly, getKey: getIsoWeekBucketKey },
    { limit: retention.monthly, getKey: getMonthBucketKey },
    { limit: retention.yearly, getKey: getYearBucketKey },
  ]

  for (const category of categories) {
    if (category.limit === 0) {
      continue
    }

    const seenKeys = new Set<string>()

    for (const snapshot of sortedSnapshots) {
      const key = category.getKey(new Date(snapshot.createdAt), retention.timeZone)
      if (seenKeys.has(key)) {
        continue
      }

      seenKeys.add(key)
      keepIds.add(snapshot.id)

      if (seenKeys.size >= category.limit) {
        break
      }
    }
  }

  return keepIds
}

async function pruneOldSnapshots(
  authClient: OAuth2Client,
  rootFolderId: string,
  retention: RetentionPolicy
) {
  const completedSnapshots = await listCompletedSnapshots(authClient, rootFolderId)

  const keepIds = buildKeepSet(completedSnapshots, retention)
  const snapshotIdsToDelete = completedSnapshots
    .filter((snapshot) => !keepIds.has(snapshot.id))
    .map((snapshot) => snapshot.id)

  for (const snapshotId of snapshotIdsToDelete) {
    await deleteDriveFile(authClient, snapshotId)
  }

  return snapshotIdsToDelete
}

async function deleteOlderDuplicateSnapshots(
  authClient: OAuth2Client,
  rootFolderId: string,
  contentSha256: string,
  snapshotToKeepId: string
) {
  const completedSnapshots = await listCompletedSnapshots(authClient, rootFolderId)
  const duplicateSnapshotIds = completedSnapshots
    .filter((snapshot) => snapshot.contentSha256 === contentSha256)
    .filter((snapshot) => snapshot.id !== snapshotToKeepId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((snapshot) => snapshot.id)

  for (const snapshotId of duplicateSnapshotIds) {
    await deleteDriveFile(authClient, snapshotId)
  }

  return duplicateSnapshotIds
}

function buildManifest(args: {
  startedAt: string
  finishedAt?: string
  archiveName: string
  archiveSizeBytes?: number
  archiveSha256?: string
  contentSha256?: string
  retention: RetentionPolicy
  firestoreCollections: ExportedCollectionSummary[]
  firestoreDocumentCount: number
  storageObjects: ExportedStorageObjectSummary[]
  storageBytes: number
  rootFolderId?: string
  snapshotFolderId?: string
  archiveFileId?: string
  manifestFileId?: string
}) {
  return {
    version: MANIFEST_VERSION,
    startedAt: args.startedAt,
    finishedAt: args.finishedAt || null,
    archive: {
      name: args.archiveName,
      sizeBytes: args.archiveSizeBytes || null,
      sha256: args.archiveSha256 || null,
    },
    content: {
      sha256: args.contentSha256 || null,
    },
    retention: args.retention,
    firestore: {
      collectionCount: args.firestoreCollections.length,
      documentCount: args.firestoreDocumentCount,
      collections: args.firestoreCollections,
    },
    storage: {
      prefix: STORAGE_PREFIX,
      objectCount: args.storageObjects.length,
      totalBytes: args.storageBytes,
      objects: args.storageObjects,
    },
    drive: {
      rootFolderId: args.rootFolderId || null,
      snapshotFolderId: args.snapshotFolderId || null,
      archiveFileId: args.archiveFileId || null,
      manifestFileId: args.manifestFileId || null,
    },
  }
}

export function isAuthorizedBackupRequest(request: Request) {
  const configuredSecret = process.env.BACKUP_CRON_SECRET?.trim()
  if (!configuredSecret) {
    throw new Error('BACKUP_CRON_SECRET is not configured')
  }

  const bearerHeader = request.headers.get('authorization')
  const headerSecret = request.headers.get('x-backup-secret')
  const providedSecret = headerSecret || (
    bearerHeader?.startsWith('Bearer ')
      ? bearerHeader.slice('Bearer '.length).trim()
      : null
  )

  if (!providedSecret) {
    return false
  }

  const expectedBuffer = Buffer.from(configuredSecret)
  const providedBuffer = Buffer.from(providedSecret)

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

export async function runDriveBackup(): Promise<DriveBackupResult> {
  const startedAt = new Date().toISOString()
  const retention = getRetentionPolicy()
  const authClient = createDriveAuthClient()
  const archiveName = `stuffy-backup-${buildTimestampSlug(startedAt)}.tar.gz`
  const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'stuffy-drive-backup-'))
  const payloadDir = path.join(workingDir, 'payload')
  const firestoreDir = path.join(payloadDir, 'firestore')
  const storageDir = path.join(payloadDir, 'storage')
  const archivePath = path.join(workingDir, archiveName)
  const manifestPath = path.join(workingDir, 'manifest.json')

  let snapshotFolderId: string | undefined

  try {
    await fs.mkdir(firestoreDir, { recursive: true })
    await fs.mkdir(storageDir, { recursive: true })

    const firestoreExport = await exportFirestoreCollections(firestoreDir)
    const storageExport = await exportStorageObjects(storageDir)
    const contentSha256 = await hashDirectoryContentsSha256(payloadDir)

    await writeJsonFile(
      path.join(payloadDir, 'manifest.json'),
      buildManifest({
        startedAt,
        archiveName,
        contentSha256,
        retention,
        firestoreCollections: firestoreExport.summaries,
        firestoreDocumentCount: firestoreExport.totalDocuments,
        storageObjects: storageExport.objects,
        storageBytes: storageExport.totalBytes,
      })
    )

    await createTar(
      {
        cwd: payloadDir,
        file: archivePath,
        gzip: true,
        portable: true,
      },
      ['.']
    )

    const archiveStats = await fs.stat(archivePath)
    const archiveSha256 = await hashFileSha256(archivePath)
    const rootFolderId = await ensureDriveRootFolder(authClient)
    const snapshotFolder = await createDriveFolder(
      authClient,
      `snapshot-${buildTimestampSlug(startedAt)}`,
      rootFolderId,
      {
        stuffyBackupKind: 'snapshot',
        createdAt: startedAt,
        status: 'uploading',
      }
    )

    snapshotFolderId = snapshotFolder.id

    const archiveFile = await uploadDriveFile(
      authClient,
      archivePath,
      archiveName,
      snapshotFolder.id,
      'application/gzip',
      {
        stuffyBackupKind: 'archive',
        createdAt: startedAt,
        contentSha256,
      }
    )

    const finishedAt = new Date().toISOString()
    const baseManifest = buildManifest({
      startedAt,
      finishedAt,
      archiveName,
      archiveSizeBytes: archiveStats.size,
      archiveSha256,
      contentSha256,
      retention,
      firestoreCollections: firestoreExport.summaries,
      firestoreDocumentCount: firestoreExport.totalDocuments,
      storageObjects: storageExport.objects,
      storageBytes: storageExport.totalBytes,
      rootFolderId,
      snapshotFolderId: snapshotFolder.id,
      archiveFileId: archiveFile.id,
    })

    await writeJsonFile(manifestPath, baseManifest)

    const manifestFile = await uploadDriveFile(
      authClient,
      manifestPath,
      'manifest.json',
      snapshotFolder.id,
      'application/json',
      {
        stuffyBackupKind: 'manifest',
        createdAt: startedAt,
        contentSha256,
      }
    )

    await updateDriveFile(authClient, snapshotFolder.id, {
      appProperties: {
        stuffyBackupKind: 'snapshot',
        createdAt: startedAt,
        status: 'complete',
        contentSha256,
        archiveFileId: archiveFile.id,
        manifestFileId: manifestFile.id,
      },
    })

    const deletedDuplicateSnapshotFolderIds = await deleteOlderDuplicateSnapshots(
      authClient,
      rootFolderId,
      contentSha256,
      snapshotFolder.id
    )
    const deletedSnapshotFolderIds = await pruneOldSnapshots(authClient, rootFolderId, retention)

    return {
      startedAt,
      finishedAt,
      archiveName,
      archiveSizeBytes: archiveStats.size,
      archiveSha256,
      contentSha256,
      rootFolderId,
      snapshotFolderId: snapshotFolder.id,
      archiveFileId: archiveFile.id,
      manifestFileId: manifestFile.id,
      firestoreCollections: firestoreExport.summaries,
      firestoreDocumentCount: firestoreExport.totalDocuments,
      storageObjectCount: storageExport.objects.length,
      storageBytes: storageExport.totalBytes,
      deletedDuplicateSnapshotFolderIds,
      deletedSnapshotFolderIds: [
        ...new Set([...deletedDuplicateSnapshotFolderIds, ...deletedSnapshotFolderIds]),
      ],
    }
  } catch (error) {
    if (snapshotFolderId) {
      try {
        await deleteDriveFile(authClient, snapshotFolderId)
      } catch (cleanupError) {
        console.error('Failed to clean up incomplete backup snapshot folder:', cleanupError)
      }
    }

    throw error
  } finally {
    await fs.rm(workingDir, { recursive: true, force: true })
  }
}
