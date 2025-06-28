'use client'

import { useRouter } from 'next/navigation'
import { WorkflowDashboard } from '@/components/workflow/workflow-dashboard'

export default function WorkflowsPage() {
  const router = useRouter()

  const handleCreateWorkflow = () => {
    router.push('/workflows/new')
  }

  const handleEditWorkflow = (workflowId: string) => {
    router.push(`/workflows/${workflowId}`)
  }

  return (
    <WorkflowDashboard
      onCreateWorkflow={handleCreateWorkflow}
      onEditWorkflow={handleEditWorkflow}
    />
  )
}