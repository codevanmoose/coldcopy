'use client'

import { useRouter } from 'next/navigation'
import { VisualWorkflowBuilderWrapper } from '@/components/workflow/visual-workflow-builder'

export default function NewWorkflowPage() {
  const router = useRouter()

  const handleSave = () => {
    router.push('/workflows')
  }

  return (
    <VisualWorkflowBuilderWrapper
      onSave={handleSave}
    />
  )
}