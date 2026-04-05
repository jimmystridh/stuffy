import 'dotenv/config'

import { runDriveBackup } from '@/lib/backup/drive-backup'

async function main() {
  const result = await runDriveBackup()
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
