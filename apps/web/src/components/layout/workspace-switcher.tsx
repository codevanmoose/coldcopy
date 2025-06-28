'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Building, Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Workspace } from '@coldcopy/database'

export function WorkspaceSwitcher() {
  const router = useRouter()
  const { workspace, setWorkspace, dbUser } = useAuthStore()
  const [open, setOpen] = useState(false)

  const isSuperAdmin = dbUser?.role === 'super_admin'

  const { data: workspaces } = useQuery({
    queryKey: ['user-workspaces', dbUser?.id],
    queryFn: async () => {
      if (!dbUser) return []

      const response = await api.workspaces.list()
      
      if (response.error) throw new Error(response.error)
      
      if (isSuperAdmin) {
        // Super admins can see all workspaces
        return response.data || []
      } else {
        // Regular users see only their workspace
        return (response.data || []).filter(ws => ws.id === dbUser.workspace_id)
      }
    },
    enabled: !!dbUser,
  })

  const switchWorkspace = async (newWorkspace: Workspace) => {
    if (newWorkspace.id === workspace?.id) return

    // Update the user's current workspace
    if (isSuperAdmin) {
      const response = await api.users.update(dbUser.id, { workspace_id: newWorkspace.id })
      
      if (response.error) {
        console.error('Error switching workspace:', response.error)
        return
      }
    }

    setWorkspace(newWorkspace)
    setOpen(false)
    router.refresh()
  }

  if (!workspace) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          <div className="flex items-center gap-2 truncate">
            <Building className="h-4 w-4" />
            <span className="truncate">{workspace.name}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px] p-0">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {isSuperAdmin ? 'All Workspaces' : 'Your Workspace'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspaces?.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => switchWorkspace(ws)}
            className="cursor-pointer"
          >
            <Check
              className={`mr-2 h-4 w-4 ${
                workspace.id === ws.id ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <span className="truncate">{ws.name}</span>
          </DropdownMenuItem>
        ))}
        {isSuperAdmin && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => router.push('/admin/workspaces/new')}
              className="cursor-pointer"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}