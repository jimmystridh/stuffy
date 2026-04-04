import { Suspense } from 'react'
import { Page } from '@/components/app-page'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <Page />
    </Suspense>
  )
}
