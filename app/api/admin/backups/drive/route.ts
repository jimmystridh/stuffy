import { NextResponse } from 'next/server'
import { isAuthorizedBackupRequest, runDriveBackup } from '@/lib/backup/drive-backup'

export const runtime = 'nodejs'
export const maxDuration = 1800

export async function POST(request: Request) {
  try {
    if (!isAuthorizedBackupRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runDriveBackup()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Drive backup failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Drive backup failed',
      },
      { status: 500 }
    )
  }
}
