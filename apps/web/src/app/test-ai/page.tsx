'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import { useWorkspace } from '@/hooks/use-workspace'
import { Loader2 } from 'lucide-react'

export default function TestAIPage() {
  const { workspace } = useWorkspace()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    leadName: 'John Smith',
    leadEmail: 'john.smith@techcorp.com',
    leadCompany: 'TechCorp Inc.',
    leadJobTitle: 'VP of Sales',
    campaignGoal: 'Schedule a demo of our sales automation platform',
    tone: 'professional' as const,
    length: 'medium' as const,
    includeCall: true,
    companyDescription: 'Leading technology company specializing in enterprise software solutions',
    leadWebsite: 'https://techcorp.com',
  })

  const handleTestAI = async () => {
    if (!workspace?.id) {
      toast({
        title: 'Error',
        description: 'Please select a workspace first',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/ai/generate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspace.id,
          user_id: workspace.user_id,
          provider: 'anthropic',
          model: 'claude-3-5-sonnet-20241022',
          context: formData,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate email')
      }

      const data = await response.json()
      setResult(data)
      
      toast({
        title: 'Success!',
        description: 'AI email generated successfully',
      })
    } catch (error) {
      console.error('AI test error:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to generate email',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container max-w-4xl py-8">
      <Card>
        <CardHeader>
          <CardTitle>Test AI Email Generation</CardTitle>
          <CardDescription>
            Test the AI email generation feature with OpenAI and Anthropic
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leadName">Lead Name</Label>
              <Input
                id="leadName"
                value={formData.leadName}
                onChange={(e) => setFormData({ ...formData, leadName: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="leadEmail">Lead Email</Label>
              <Input
                id="leadEmail"
                type="email"
                value={formData.leadEmail}
                onChange={(e) => setFormData({ ...formData, leadEmail: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="leadCompany">Company</Label>
              <Input
                id="leadCompany"
                value={formData.leadCompany}
                onChange={(e) => setFormData({ ...formData, leadCompany: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="leadJobTitle">Job Title</Label>
              <Input
                id="leadJobTitle"
                value={formData.leadJobTitle}
                onChange={(e) => setFormData({ ...formData, leadJobTitle: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="campaignGoal">Campaign Goal</Label>
            <Textarea
              id="campaignGoal"
              value={formData.campaignGoal}
              onChange={(e) => setFormData({ ...formData, campaignGoal: e.target.value })}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyDescription">Company Description</Label>
            <Textarea
              id="companyDescription"
              value={formData.companyDescription}
              onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <Select
                value={formData.tone}
                onValueChange={(value: any) => setFormData({ ...formData, tone: value })}
              >
                <SelectTrigger id="tone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="friendly">Friendly</SelectItem>
                  <SelectItem value="direct">Direct</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="length">Length</Label>
              <Select
                value={formData.length}
                onValueChange={(value: any) => setFormData({ ...formData, length: value })}
              >
                <SelectTrigger id="length">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Long</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="includeCall">Include CTA</Label>
              <Select
                value={formData.includeCall ? 'yes' : 'no'}
                onValueChange={(value) => setFormData({ ...formData, includeCall: value === 'yes' })}
              >
                <SelectTrigger id="includeCall">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleTestAI} 
            disabled={loading || !workspace?.id}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              'Generate AI Email'
            )}
          </Button>

          {result && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Generated Email:</h3>
              
              <div className="space-y-2">
                <Label>Subject Line:</Label>
                <div className="p-3 bg-gray-50 rounded-md">
                  {result.subject}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email Body:</Label>
                <div className="p-3 bg-gray-50 rounded-md whitespace-pre-wrap">
                  {result.body}
                </div>
              </div>

              {result.analysis && (
                <div className="space-y-2">
                  <Label>Analysis Scores:</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Tone Score: {result.analysis.tone_score?.toFixed(1)}/10</div>
                    <div>Personalization: {result.analysis.personalization_score?.toFixed(1)}/10</div>
                    <div>Engagement: {result.analysis.engagement_score?.toFixed(1)}/10</div>
                    <div>Deliverability: {result.analysis.deliverability_score?.toFixed(1)}/10</div>
                  </div>
                </div>
              )}

              {result.usage && (
                <div className="space-y-2">
                  <Label>Token Usage:</Label>
                  <div className="text-sm text-gray-600">
                    Input: {result.usage.inputTokens} | 
                    Output: {result.usage.outputTokens} | 
                    Total: {result.usage.totalTokens}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}