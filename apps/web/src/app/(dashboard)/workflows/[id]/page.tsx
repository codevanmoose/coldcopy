'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { VisualWorkflowBuilderWrapper } from '@/components/workflow/visual-workflow-builder'
import { Workflow } from '@/lib/automation/workflow-engine'
import { api } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface WorkflowPageProps {
  params: Promise<{ id: string }>
}

export default function WorkflowPage({ params }: WorkflowPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user?.workspaceId && id) {
      loadWorkflow()
    }
  }, [user?.workspaceId, id])

  const loadWorkflow = async () => {
    if (!user?.workspaceId) return

    setIsLoading(true)
    try {
      const response = await api.workflows.get(user.workspaceId, id)
      if (response.data) {
        setWorkflow(response.data)
      } else {
        toast.error('Workflow not found')
        router.push('/workflows')
      }
    } catch (error) {
      console.error('Error loading workflow:', error)
      toast.error('Failed to load workflow')
      router.push('/workflows')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = () => {
    toast.success('Workflow saved successfully')
    loadWorkflow() // Reload to get updated data
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!workflow) {
    return null
  }

  return (
    <VisualWorkflowBuilderWrapper
      workflow={workflow}
      onSave={handleSave}
    />
  )
}