'use client';

import { DeliverabilityDashboard } from '@/components/email-deliverability/DeliverabilityDashboard';
import { useCurrentWorkspace } from '@/hooks/use-user';

export default function DeliverabilityPage() {
  const workspace = useCurrentWorkspace();
  
  if (!workspace) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Email Deliverability</h3>
        <p className="text-sm text-muted-foreground">
          Monitor and improve your email delivery rates
        </p>
      </div>
      
      <DeliverabilityDashboard workspaceId={workspace.workspace_id} />
    </div>
  );
}