import { Suspense } from 'react'
import { Page } from '@/components/app-item-id-page'

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <Page params={resolvedParams} />
    </Suspense>
  )
}
