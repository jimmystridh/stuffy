import { Suspense } from 'react'
import { CollageView } from '@/components/location-collage-view'

export default async function LocationCollagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <CollageView locationId={id} />
    </Suspense>
  )
}
