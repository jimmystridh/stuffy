import { Suspense } from 'react'
import { Page } from '@/components/app-item-id-view-page'

export default async function ItemViewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <Page params={resolvedParams} />
    </Suspense>
  )
}
