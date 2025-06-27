'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2 } from 'lucide-react'
import { useCurrentWorkspace } from '@/hooks/use-user'
import type { UserRole } from '@/lib/supabase/auth'

interface InviteTeamMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaceId?: string
  onInviteSuccess?: () => void
}

export function InviteTeamMemberDialog({
  open,
  onOpenChange,
  workspaceId,
  onInviteSuccess,
}: InviteTeamMemberDialogProps) {
  const currentWorkspace = useCurrentWorkspace()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('outreach_specialist')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveWorkspaceId = workspaceId || currentWorkspace?.workspace_id

  const handleInvite = async () => {
    if (!effectiveWorkspaceId || !email) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/workspaces/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: effectiveWorkspaceId,
          email,
          role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      // Reset form
      setEmail('')
      setRole('outreach_specialist')
      onOpenChange(false)
      
      if (onInviteSuccess) {
        onInviteSuccess()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your workspace. They'll receive an email with instructions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              placeholder="colleague@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
              disabled={loading}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workspace_admin">
                  <div className="space-y-1">
                    <div className="font-medium">Workspace Admin</div>
                    <div className="text-xs text-muted-foreground">
                      Full workspace access, can manage team and billing
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="campaign_manager">
                  <div className="space-y-1">
                    <div className="font-medium">Campaign Manager</div>
                    <div className="text-xs text-muted-foreground">
                      Can create and manage campaigns, view analytics
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="outreach_specialist">
                  <div className="space-y-1">
                    <div className="font-medium">Outreach Specialist</div>
                    <div className="text-xs text-muted-foreground">
                      Can send emails and manage leads
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInvite}
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              'Send Invitation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}