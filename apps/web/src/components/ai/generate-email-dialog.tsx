'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Sparkles, Loader2, Copy, RotateCw, AlertCircle, Zap } from 'lucide-react'
import type { EmailTone, EmailStyle } from '@/lib/ai/types'

const generateSchema = z.object({
  // Lead info is passed as props
  productName: z.string().min(1, 'Product name is required'),
  productDescription: z.string().optional(),
  benefits: z.string().optional(),
  useCase: z.string().optional(),
  tone: z.enum(['professional', 'friendly', 'casual', 'formal', 'enthusiastic']),
  style: z.enum(['direct', 'storytelling', 'problem-solution', 'benefit-focused', 'question-based']),
  customInstructions: z.string().optional(),
  includeUnsubscribe: z.boolean(),
})

type GenerateForm = z.infer<typeof generateSchema>

interface GenerateEmailDialogProps {
  leadInfo: {
    name?: string
    email: string
    title?: string
    company?: string
    industry?: string
  }
  onGenerated?: (subject: string, body: string) => void
  trigger?: React.ReactNode
}

export function GenerateEmailDialog({ leadInfo, onGenerated, trigger }: GenerateEmailDialogProps) {
  const [open, setOpen] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedEmail, setGeneratedEmail] = useState<{
    subject: string
    body: string
    usage?: { totalTokens: number }
  } | null>(null)
  const [remainingTokens, setRemainingTokens] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<GenerateForm>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      tone: 'professional',
      style: 'direct',
      includeUnsubscribe: true,
    },
  })

  const tone = watch('tone')
  const style = watch('style')

  const onSubmit = async (data: GenerateForm) => {
    setIsGenerating(true)
    setGeneratedEmail(null)

    try {
      // Parse benefits into array
      const benefits = data.benefits
        ? data.benefits.split('\n').map(b => b.trim()).filter(Boolean)
        : undefined

      const response = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          leadInfo,
          productInfo: {
            name: data.productName,
            description: data.productDescription,
            benefits,
            useCase: data.useCase,
          },
          tone: data.tone,
          style: data.style,
          customInstructions: data.customInstructions,
          includeUnsubscribe: data.includeUnsubscribe,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate email')
      }

      setGeneratedEmail({
        subject: result.subject,
        body: result.body,
        usage: result.usage,
      })
      setRemainingTokens(result.remainingTokens)

      toast.success('Email generated successfully!')
    } catch (error) {
      console.error('Generation error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to generate email')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const regenerate = () => {
    handleSubmit(onSubmit)()
  }

  const useEmail = () => {
    if (generatedEmail && onGenerated) {
      onGenerated(generatedEmail.subject, generatedEmail.body)
      setOpen(false)
      setTimeout(() => {
        reset()
        setGeneratedEmail(null)
      }, 200)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" />
            Generate with AI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Email Generator</DialogTitle>
          <DialogDescription>
            Generate a personalized cold email for {leadInfo.name || leadInfo.email}
            {leadInfo.title && leadInfo.company && ` (${leadInfo.title} at ${leadInfo.company})`}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="generate" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate</TabsTrigger>
            <TabsTrigger value="preview" disabled={!generatedEmail}>
              Preview {generatedEmail && <Badge className="ml-2" variant="secondary">Ready</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="productName">Product/Service Name</Label>
                  <Input
                    id="productName"
                    placeholder="ColdCopy Pro"
                    {...register('productName')}
                    disabled={isGenerating}
                  />
                  {errors.productName && (
                    <p className="text-sm text-destructive">{errors.productName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="useCase">Use Case</Label>
                  <Input
                    id="useCase"
                    placeholder="Scaling outbound sales"
                    {...register('useCase')}
                    disabled={isGenerating}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="productDescription">Product Description</Label>
                <Textarea
                  id="productDescription"
                  placeholder="AI-powered cold email automation that helps sales teams..."
                  rows={3}
                  {...register('productDescription')}
                  disabled={isGenerating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benefits">Key Benefits (one per line)</Label>
                <Textarea
                  id="benefits"
                  placeholder="Save 10 hours per week&#10;3x higher response rates&#10;Automated follow-ups"
                  rows={3}
                  {...register('benefits')}
                  disabled={isGenerating}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tone">Tone</Label>
                  <Select
                    value={tone}
                    onValueChange={(value) => setValue('tone', value as EmailTone, { shouldDirty: true })}
                    disabled={isGenerating}
                  >
                    <SelectTrigger id="tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="style">Writing Style</Label>
                  <Select
                    value={style}
                    onValueChange={(value) => setValue('style', value as EmailStyle, { shouldDirty: true })}
                    disabled={isGenerating}
                  >
                    <SelectTrigger id="style">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="storytelling">Storytelling</SelectItem>
                      <SelectItem value="problem-solution">Problem-Solution</SelectItem>
                      <SelectItem value="benefit-focused">Benefit-Focused</SelectItem>
                      <SelectItem value="question-based">Question-Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customInstructions">Custom Instructions (Optional)</Label>
                <Textarea
                  id="customInstructions"
                  placeholder="Mention their recent funding round, focus on ROI, keep it under 100 words..."
                  rows={2}
                  {...register('customInstructions')}
                  disabled={isGenerating}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="includeUnsubscribe"
                    checked={watch('includeUnsubscribe')}
                    onCheckedChange={(checked) => setValue('includeUnsubscribe', checked)}
                    disabled={isGenerating}
                  />
                  <Label htmlFor="includeUnsubscribe" className="cursor-pointer">
                    Include unsubscribe text
                  </Label>
                </div>

                {remainingTokens !== null && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Zap className="h-4 w-4" />
                    {remainingTokens.toLocaleString()} tokens remaining
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Email
                  </>
                )}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {generatedEmail && (
              <>
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Subject Line</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(generatedEmail.subject)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="p-3 rounded-lg bg-muted">
                          {generatedEmail.subject}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Email Body</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(generatedEmail.body)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="p-3 rounded-lg bg-muted whitespace-pre-wrap">
                          {generatedEmail.body}
                        </div>
                      </div>

                      {generatedEmail.usage && (
                        <Alert>
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            This generation used {generatedEmail.usage.totalTokens} tokens
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div className="flex gap-2">
                  <Button onClick={regenerate} variant="outline" className="flex-1">
                    <RotateCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </Button>
                  <Button onClick={useEmail} className="flex-1">
                    Use This Email
                  </Button>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}