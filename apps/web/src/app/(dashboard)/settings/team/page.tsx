'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Plus, Mail, Shield, Trash2, Loader2 } from 'lucide-react'
import { InviteTeamMemberDialog } from '@/components/settings/invite-team-member-dialog'
import { User, UserRole } from '@coldcopy/database'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from 'lucide-react'

const roleLabels: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  workspace_admin: 'Admin',
  campaign_manager: 'Campaign Manager',
  outreach_specialist: 'Outreach Specialist',
}

const roleColors: Record<UserRole, string> = {
  super_admin: 'destructive',
  workspace_admin: 'default',
  campaign_manager: 'secondary',
  outreach_specialist: 'outline',
}

export default function TeamSettingsPage() {
  const { workspace, dbUser } = useAuthStore()
  const [inviteOpen, setInviteOpen] = useState(false)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const { data: teamMembers, isLoading } = useQuery({
    queryKey: ['team-members', workspace?.id],
    queryFn: async () => {
      if (!workspace) return []
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as User[]
    },
    enabled: !!workspace,
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      const { error } = await supabase
        .from('users')
        .update({ role })
        .eq('id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      toast.success('Team member role updated')
    },
    onError: () => {
      toast.error('Failed to update role')
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      toast.success('Team member removed')
    },
    onError: () => {
      toast.error('Failed to remove team member')
    },
  })

  const canManageTeam = dbUser?.role === 'workspace_admin' || dbUser?.role === 'super_admin'

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Manage your workspace team and their permissions
              </CardDescription>
            </div>
            {canManageTeam && (
              <Button onClick={() => setInviteOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  {canManageTeam && <TableHead className="w-[50px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-medium">
                      {member.full_name || 'Unnamed User'}
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={roleColors[member.role] as any}>
                        {roleLabels[member.role]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(member.created_at).toLocaleDateString()}
                    </TableCell>
                    {canManageTeam && (
                      <TableCell>
                        {member.id !== dbUser?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => updateRoleMutation.mutate({
                                  userId: member.id,
                                  role: 'workspace_admin'
                                })}
                                disabled={member.role === 'workspace_admin'}
                              >
                                <Shield className="mr-2 h-4 w-4" />
                                Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateRoleMutation.mutate({
                                  userId: member.id,
                                  role: 'campaign_manager'
                                })}
                                disabled={member.role === 'campaign_manager'}
                              >
                                Set as Campaign Manager
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateRoleMutation.mutate({
                                  userId: member.id,
                                  role: 'outreach_specialist'
                                })}
                                disabled={member.role === 'outreach_specialist'}
                              >
                                Set as Outreach Specialist
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => removeMemberMutation.mutate(member.id)}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Remove from team
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>
            Understanding team member capabilities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default">Admin</Badge>
                <span className="text-sm font-medium">Full workspace access</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Can manage team, settings, billing, and all campaigns
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">Campaign Manager</Badge>
                <span className="text-sm font-medium">Campaign management</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Can create and manage campaigns, view analytics
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline">Outreach Specialist</Badge>
                <span className="text-sm font-medium">Execute campaigns</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Can send emails and manage assigned leads
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <InviteTeamMemberDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        workspaceId={workspace?.id || ''}
      />
    </div>
  )
}