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
import { useWorkspaces } from '@/hooks/use-user'
import { useRouter } from 'next/navigation'
import { CreateWorkspaceDialog } from '@/components/workspace/create-workspace-dialog'

export function WorkspaceSwitcher() {
  const router = useRouter()
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspaces()
  const [open, setOpen] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
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

      <CreateWorkspaceDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => {
          router.refresh()
        }}
      />
    </>
  )
}