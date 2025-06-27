'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

const workspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  domain: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  description: z.string().optional(),
})

type WorkspaceForm = z.infer<typeof workspaceSchema>

export default function WorkspaceSettingsPage() {
  const router = useRouter()
  const { workspace, setWorkspace } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
  } = useForm<WorkspaceForm>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: workspace?.name || '',
      domain: workspace?.domain || '',
      description: workspace?.settings?.description || '',
    },
  })

  useEffect(() => {
    if (workspace) {
      reset({
        name: workspace.name,
        domain: workspace.domain || '',
        description: workspace.settings?.description || '',
      })
    }
  }, [workspace, reset])

  const onSubmit = async (data: WorkspaceForm) => {
    if (!workspace) return

    setIsLoading(true)
    try {
      const { data: updatedWorkspace, error } = await supabase
        .from('workspaces')
        .update({
          name: data.name,
          domain: data.domain || null,
          settings: {
            ...workspace.settings,
            description: data.description,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspace.id)
        .select()
        .single()

      if (error) throw error

      setWorkspace(updatedWorkspace)
      toast.success('Workspace settings updated successfully')
      reset(data)
    } catch (error) {
      console.error('Error updating workspace:', error)
      toast.error('Failed to update workspace settings')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>
            Update your workspace information and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Workspace Name</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Acme Agency"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain">Custom Domain</Label>
              <Input
                id="domain"
                {...register('domain')}
                placeholder="https://app.yourdomain.com"
              />
              {errors.domain && (
                <p className="text-sm text-destructive">{errors.domain.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Configure a custom domain for your workspace (requires DNS setup)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Describe your workspace..."
                rows={3}
              />
            </div>

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={!isDirty || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
              {isDirty && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => reset()}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace ID</CardTitle>
          <CardDescription>
            Your unique workspace identifier for API access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm">
              {workspace?.id}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(workspace?.id || '')
                toast.success('Workspace ID copied to clipboard')
              }}
            >
              Copy
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}