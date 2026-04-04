import { QuickAddForm } from '@/components/quick-add-form'

export default function QuickAddPage() {
  return (
    <div className="container mx-auto p-4 max-w-md">
      <h1 className="text-3xl font-bold mb-6">Quick Add Item</h1>
      <QuickAddForm />
    </div>
  )
}
