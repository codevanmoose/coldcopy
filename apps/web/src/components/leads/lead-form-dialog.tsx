'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { api } from '@/lib/api-client'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertCircle } from 'lucide-react'
import { Lead, LeadStatus } from '@coldcopy/database'

const leadFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(['new', 'contacted', 'replied', 'qualified', 'unqualified', 'unsubscribed']),
  phone: z.string().optional(),
  website: z.string().url().optional().or(z.literal('')),
  linkedin_url: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional(),
  tags: z.string().optional(),
})

type LeadFormData = z.infer<typeof leadFormSchema>

interface LeadFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead?: Lead | null
  workspaceId: string
  onSuccess?: () => void
}

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  workspaceId,
  onSuccess,
}: LeadFormDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()
  const isEdit = !!lead

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      company: '',
      title: '',
      status: 'new',
      phone: '',
      website: '',
      linkedin_url: '',
      notes: '',
      tags: '',
    },
  })

  const watchedStatus = watch('status')

  useEffect(() => {
    if (lead) {
      reset({
        email: lead.email,
        first_name: lead.first_name || '',
        last_name: lead.last_name || '',
        company: lead.company || '',
        title: lead.title || '',
        status: lead.status,
        phone: lead.phone || '',
        website: lead.website || '',
        linkedin_url: lead.linkedin_url || '',
        notes: lead.notes || '',
        tags: lead.tags.join(', '),
      })
    } else {
      reset()
    }
  }, [lead, reset])

  const onSubmit = async (data: LeadFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const leadData = {
        workspace_id: workspaceId,
        email: data.email,
        first_name: data.first_name || null,
        last_name: data.last_name || null,
        company: data.company || null,
        title: data.title || null,
        status: data.status,
        phone: data.phone || null,
        website: data.website || null,
        linkedin_url: data.linkedin_url || null,
        notes: data.notes || null,
        tags: data.tags ? data.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
        name: [data.first_name, data.last_name].filter(Boolean).join(' ') || null,
      }

      if (isEdit) {
        const response = await api.leads.update(workspaceId, lead.id, leadData)
        
        if (response.error) throw new Error(response.error)
        toast.success('Lead updated successfully')
      } else {
        const response = await api.leads.create(workspaceId, leadData)
        
        if (response.error) {
          if (response.error.includes('already exists')) {
            throw new Error('A lead with this email already exists')
          }
          throw new Error(response.error)
        }
        toast.success('Lead created successfully')
      }

      onSuccess?.()
      onOpenChange(false)
      reset()
    } catch (error) {
      console.error('Error saving lead:', error)
      setError(error instanceof Error ? error.message : 'Failed to save lead')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update the lead information below.' : 'Add a new lead to your workspace.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  {...register('first_name')}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  {...register('last_name')}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                disabled={isLoading || isEdit}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  {...register('company')}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  {...register('title')}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register('phone')}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={watchedStatus}
                  onValueChange={(value) => setValue('status', value as LeadStatus)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="replied">Replied</SelectItem>
                    <SelectItem value="qualified">Qualified</SelectItem>
                    <SelectItem value="unqualified">Unqualified</SelectItem>
                    <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                {...register('website')}
                placeholder="https://example.com"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="linkedin_url">LinkedIn URL</Label>
              <Input
                id="linkedin_url"
                type="url"
                {...register('linkedin_url')}
                placeholder="https://linkedin.com/in/username"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                {...register('tags')}
                placeholder="tag1, tag2, tag3"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Separate tags with commas
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                rows={3}
                disabled={isLoading}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEdit ? 'Update Lead' : 'Create Lead'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}