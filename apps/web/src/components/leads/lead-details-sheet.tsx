'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { 
  Mail, 
  User, 
  Building, 
  Briefcase, 
  Calendar,
  Tag,
  X,
  Loader2,
  Activity,
  Database
} from 'lucide-react'
import { Lead, LeadStatus } from '@coldcopy/database'
import { format } from 'date-fns'
import { LeadEngagementHistory } from './lead-engagement-history'
import { LeadEnrichmentContent } from './lead-enrichment'

const leadSchema = z.object({
  email: z.string().email('Invalid email address'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  status: z.enum(['new', 'contacted', 'replied', 'qualified', 'unqualified', 'unsubscribed']),
  notes: z.string().optional(),
})

type LeadForm = z.infer<typeof leadSchema>

interface LeadDetailsSheetProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

export function LeadDetailsSheet({
  lead,
  open,
  onOpenChange,
  onUpdate,
}: LeadDetailsSheetProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [tags, setTags] = useState<string[]>(lead?.tags || [])
  const [newTag, setNewTag] = useState('')
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    setValue,
    watch,
  } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      email: lead?.email || '',
      first_name: lead?.first_name || '',
      last_name: lead?.last_name || '',
      company: lead?.company || '',
      title: lead?.title || '',
      status: lead?.status || 'new',
      notes: lead?.custom_fields?.notes || '',
    },
  })

  const status = watch('status')

  const onSubmit = async (data: LeadForm) => {
    if (!lead) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('leads')
        .update({
          email: data.email,
          first_name: data.first_name || null,
          last_name: data.last_name || null,
          company: data.company || null,
          title: data.title || null,
          status: data.status,
          tags,
          custom_fields: {
            ...lead.custom_fields,
            notes: data.notes || null,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)

      if (error) throw error

      toast.success('Lead updated successfully')
      onUpdate?.()
      onOpenChange(false)
    } catch (error) {
      console.error('Error updating lead:', error)
      toast.error('Failed to update lead')
    } finally {
      setIsLoading(false)
    }
  }

  const addTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag])
      setNewTag('')
    }
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag))
  }

  if (!lead) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Lead Details</SheetTitle>
          <SheetDescription>
            View and edit lead information
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="details" className="flex-1 mt-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="enrichment">
              <Database className="mr-2 h-4 w-4" />
              Enrich
            </TabsTrigger>
            <TabsTrigger value="engagement">
              <Activity className="mr-2 h-4 w-4" />
              Engagement
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="details" className="space-y-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-10"
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="first_name"
                    className="pl-10"
                    {...register('first_name')}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  {...register('last_name')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="company"
                  className="pl-10"
                  {...register('company')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="title"
                  className="pl-10"
                  {...register('title')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => setValue('status', value as LeadStatus)}
              >
                <SelectTrigger>
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

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                placeholder="Add notes about this lead..."
                {...register('notes')}
              />
            </div>

            <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Added {format(new Date(lead.created_at), 'PPP')}</span>
              </div>
              {lead.updated_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Updated {format(new Date(lead.updated_at), 'PPP')}</span>
                </div>
              )}
            </div>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
            </form>
          </TabsContent>
          
          <TabsContent value="enrichment" className="space-y-6">
            <LeadEnrichmentContent 
              lead={lead}
              onUpdate={onUpdate}
            />
          </TabsContent>
          
          <TabsContent value="engagement" className="space-y-6">
            <LeadEngagementHistory 
              leadId={lead.id} 
              leadEmail={lead.email}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}