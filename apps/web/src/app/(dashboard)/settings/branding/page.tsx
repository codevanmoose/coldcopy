'use client'

import { useState, useEffect } from 'react'
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
import { Loader2, Upload, Palette } from 'lucide-react'

const brandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color'),
  logo: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  favicon: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  customCss: z.string().optional(),
})

type BrandingForm = z.infer<typeof brandingSchema>

export default function BrandingSettingsPage() {
  const { workspace, setWorkspace } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    watch,
  } = useForm<BrandingForm>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      primaryColor: workspace?.branding?.primaryColor || '#6366F1',
      logo: workspace?.branding?.logo || '',
      favicon: workspace?.branding?.favicon || '',
      customCss: workspace?.branding?.customCss || '',
    },
  })

  const primaryColor = watch('primaryColor')

  useEffect(() => {
    if (workspace) {
      reset({
        primaryColor: workspace.branding?.primaryColor || '#6366F1',
        logo: workspace.branding?.logo || '',
        favicon: workspace.branding?.favicon || '',
        customCss: workspace.branding?.customCss || '',
      })
    }
  }, [workspace, reset])

  const onSubmit = async (data: BrandingForm) => {
    if (!workspace) return

    setIsLoading(true)
    try {
      const { data: updatedWorkspace, error } = await supabase
        .from('workspaces')
        .update({
          branding: {
            primaryColor: data.primaryColor,
            logo: data.logo || null,
            favicon: data.favicon || null,
            customCss: data.customCss || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspace.id)
        .select()
        .single()

      if (error) throw error

      setWorkspace(updatedWorkspace)
      toast.success('Branding settings updated successfully')
      reset(data)
    } catch (error) {
      console.error('Error updating branding:', error)
      toast.error('Failed to update branding settings')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Brand Identity</CardTitle>
          <CardDescription>
            Customize how your workspace appears to your team
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-4">
                <Input
                  id="primaryColor"
                  type="text"
                  {...register('primaryColor')}
                  placeholder="#6366F1"
                  className="flex-1"
                />
                <div 
                  className="h-10 w-20 rounded-md border"
                  style={{ backgroundColor: primaryColor }}
                />
              </div>
              {errors.primaryColor && (
                <p className="text-sm text-destructive">{errors.primaryColor.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                type="url"
                {...register('logo')}
                placeholder="https://example.com/logo.png"
              />
              {errors.logo && (
                <p className="text-sm text-destructive">{errors.logo.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Recommended size: 200x50px
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="favicon">Favicon URL</Label>
              <Input
                id="favicon"
                type="url"
                {...register('favicon')}
                placeholder="https://example.com/favicon.ico"
              />
              {errors.favicon && (
                <p className="text-sm text-destructive">{errors.favicon.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Recommended size: 32x32px
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customCss">Custom CSS</Label>
              <Textarea
                id="customCss"
                {...register('customCss')}
                placeholder="/* Add custom styles here */"
                rows={6}
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Advanced: Add custom CSS to further customize the appearance
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Button type="submit" disabled={!isDirty || isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Branding'
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
          <CardTitle>Email Branding</CardTitle>
          <CardDescription>
            Customize how your emails appear to recipients
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-2">Email Footer</p>
            <p className="text-sm text-muted-foreground">
              All outbound emails will include your workspace branding in the footer
            </p>
          </div>
          <div className="rounded-lg border p-4 bg-muted/50">
            <p className="text-sm font-medium mb-2">Tracking Pixel</p>
            <p className="text-sm text-muted-foreground">
              Email open tracking will use your custom domain when configured
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}