'use client'

import { IntentDashboard } from '@/components/sales-intelligence/IntentDashboard'
import { useWorkspace } from '@/hooks/use-workspace'

export default function IntelligencePage() {
  const { workspace } = useWorkspace()

  if (!workspace) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sales Intelligence</h1>
        <p className="text-muted-foreground">
          Track buying signals and intent data across your leads
        </p>
      </div>
      <IntentDashboard workspaceId={workspace.id} />
    </div>
  )
}