'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, PlusCircle, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useWorkspaces } from '@/hooks/use-user'
import { useRouter } from 'next/navigation'

export function WorkspaceSwitcher() {
  const router = useRouter()
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspaces()
  const [open, setOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleWorkspaceSwitch = async (workspaceId: string) => {
    if (workspaceId === currentWorkspace?.workspace_id) {
      setOpen(false)
      return
    }

    setLoading(true)
    await switchWorkspace(workspaceId)
    setLoading(false)
    setOpen(false)
    router.refresh()
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newWorkspaceName,
          slug: newWorkspaceName.toLowerCase().replace(/\s+/g, '-'),
        }),
      })

      if (response.ok) {
        const { workspace } = await response.json()
        setShowCreateDialog(false)
        setNewWorkspaceName('')
        await switchWorkspace(workspace.id)
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to create workspace:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select a workspace"
            className="w-[250px] justify-between"
            disabled={loading}
          >
            <Building2 className="mr-2 h-4 w-4" />
            {currentWorkspace?.workspace_name || 'Select workspace'}
            <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search workspace..." />
              <CommandEmpty>No workspace found.</CommandEmpty>
              <CommandGroup heading="Workspaces">
                {workspaces.map((workspace) => (
                  <CommandItem
                    key={workspace.workspace_id}
                    onSelect={() => handleWorkspaceSwitch(workspace.workspace_id)}
                    className="text-sm"
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    {workspace.workspace_name}
                    <Check
                      className={cn(
                        'ml-auto h-4 w-4',
                        currentWorkspace?.workspace_id === workspace.workspace_id
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setShowCreateDialog(true)
                  }}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create workspace
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workspace</DialogTitle>
            <DialogDescription>
              Add a new workspace to manage separate projects or teams.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                placeholder="My Company"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={loading || !newWorkspaceName.trim()}
            >
              Create workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}