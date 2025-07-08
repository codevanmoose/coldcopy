'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import Link from 'next/link'

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subject: z.string().min(1, 'Subject is required'),
  category: z.string().min(1, 'Category is required'),
  description: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
})

type TemplateFormData = z.infer<typeof templateSchema>

export default function NewTemplatePage() {
  const router = useRouter()
  const { workspace } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      category: 'general',
      content: 'Hi {{first_name}},\n\n',
    },
  })

  const onSubmit = async (data: TemplateFormData) => {
    if (!workspace) {
      toast.error('No workspace selected')
      return
    }

    setIsLoading(true)
    try {
      // Create template blocks from content
      const blocks = [
        {
          id: '1',
          type: 'text' as const,
          content: data.content,
          styles: {
            fontSize: '16px',
            color: '#333333',
          },
        },
      ]

      // Extract variables from content and subject
      const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g
      const variables = new Set<string>()
      
      let match
      while ((match = variableRegex.exec(data.content)) !== null) {
        variables.add(match[1])
      }
      while ((match = variableRegex.exec(data.subject)) !== null) {
        variables.add(match[1])
      }

      const templateData = {
        name: data.name,
        description: data.description || '',
        category: data.category,
        subject: data.subject,
        blocks,
        variables: Array.from(variables),
        styles: {
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          maxWidth: '600px',
        },
        previewText: data.content.substring(0, 100),
      }

      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create template')
      }

      toast.success('Template created successfully')
      router.push('/templates')
    } catch (error) {
      console.error('Error creating template:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create template')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/templates">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create Template</h1>
          <p className="text-muted-foreground">
            Create a new email template for your campaigns
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Details</CardTitle>
          <CardDescription>
            Enter the basic information for your email template
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Welcome Email"
                  {...register('name')}
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={watch('category')}
                  onValueChange={(value) => setValue('category', value)}
                  disabled={isLoading}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="welcome">Welcome</SelectItem>
                    <SelectItem value="follow-up">Follow-up</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="newsletter">Newsletter</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  placeholder="e.g., Welcome to {{company}}!"
                  {...register('subject')}
                  disabled={isLoading}
                />
                {errors.subject && (
                  <p className="text-sm text-destructive">{errors.subject.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Use {'{{variable}}'} syntax for dynamic content
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of this template"
                  {...register('description')}
                  disabled={isLoading}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="content">Email Content</Label>
                <Textarea
                  id="content"
                  rows={10}
                  placeholder="Write your email content here..."
                  {...register('content')}
                  disabled={isLoading}
                  className="font-mono text-sm"
                />
                {errors.content && (
                  <p className="text-sm text-destructive">{errors.content.message}</p>
                )}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Available variables:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {['first_name', 'last_name', 'company', 'title', 'email'].map((variable) => (
                      <code key={variable} className="px-1 py-0.5 bg-muted rounded text-xs">
                        {`{{${variable}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/templates')}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create Template
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}