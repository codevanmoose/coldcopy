'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { 
  Sparkles, 
  CreditCard, 
  AlertCircle, 
  CheckCircle2, 
  XCircle,
  RefreshCw,
  Clock,
  Database,
  Mail,
  Phone,
  Building,
  Globe,
  User,
  Briefcase,
  Link,
  History,
  TrendingUp,
  Zap,
  Info,
  Loader2,
  ChevronRight,
  Edit2,
  Save,
  X
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { Lead } from '@coldcopy/database'
import { PurchaseTokensDialog } from '@/components/billing/purchase-tokens-dialog'

// Types
interface EnrichmentOption {
  id: string
  label: string
  icon: React.ReactNode
  description: string
  creditsRequired: number
  enabled: boolean
}

interface EnrichmentProvider {
  id: string
  name: string
  type: string
  creditsPerRequest: number
  isActive: boolean
  accuracy: number
  speed: 'fast' | 'medium' | 'slow'
}

interface EnrichmentResult {
  field: string
  oldValue: any
  newValue: any
  confidence: number
  source: string
  verified: boolean
}

interface EnrichmentHistory {
  id: string
  createdAt: string
  provider: string
  status: 'success' | 'partial' | 'failed'
  fieldsEnriched: number
  creditsUsed: number
  results: EnrichmentResult[]
}

interface CreditBalance {
  available: number
  used: number
  allocated: number
}

interface LeadEnrichmentProps {
  lead?: Lead
  leads?: Lead[]
  onUpdate?: () => void
  trigger?: React.ReactNode
}

// Confidence score indicator component
function ConfidenceIndicator({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getLabel = () => {
    if (score >= 0.8) return 'High'
    if (score >= 0.6) return 'Medium'
    return 'Low'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${getColor()}`}>
            <TrendingUp className="h-3 w-3" />
            <span className="text-xs font-medium">{(score * 100).toFixed(0)}%</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getLabel()} confidence ({(score * 100).toFixed(0)}%)</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Result comparison component
function ResultComparison({ result, onEdit, onSave, onCancel }: {
  result: EnrichmentResult
  onEdit: (field: string) => void
  onSave: (field: string, value: any) => void
  onCancel: (field: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(result.newValue)

  const handleEdit = () => {
    setIsEditing(true)
    onEdit(result.field)
  }

  const handleSave = () => {
    onSave(result.field, editValue)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(result.newValue)
    setIsEditing(false)
    onCancel(result.field)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium capitalize">
            {result.field.replace(/_/g, ' ')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <ConfidenceIndicator score={result.confidence} />
            {result.verified && (
              <Badge variant="secondary" className="text-xs">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Previous</Label>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
            {result.oldValue || <span className="text-muted-foreground">Not set</span>}
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">New</Label>
          {isEditing ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                autoFocus
              />
              <Button size="sm" onClick={handleSave}>
                <Save className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
              <span className="text-sm font-medium">{result.newValue}</span>
              <Button size="sm" variant="ghost" onClick={handleEdit}>
                <Edit2 className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">Source: {result.source}</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Enrichment content component (can be used standalone or within modals)
export function LeadEnrichmentContent({ lead, leads, onUpdate }: {
  lead?: Lead
  leads?: Lead[]
  onUpdate?: () => void
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(['email', 'company'])
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [priority, setPriority] = useState<number>(5)
  const [enrichmentResults, setEnrichmentResults] = useState<EnrichmentResult[]>([])
  const [isEnriching, setIsEnriching] = useState(false)
  const [editingFields, setEditingFields] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()
  const supabase = createClient()

  const isBulk = !lead && leads && leads.length > 0
  const targetLeads = lead ? [lead] : (leads || [])

  // Enrichment options
  const enrichmentOptions: EnrichmentOption[] = [
    {
      id: 'email',
      label: 'Email Address',
      icon: <Mail className="h-4 w-4" />,
      description: 'Find and verify email addresses',
      creditsRequired: 1,
      enabled: true
    },
    {
      id: 'phone',
      label: 'Phone Number',
      icon: <Phone className="h-4 w-4" />,
      description: 'Find direct dial and mobile numbers',
      creditsRequired: 2,
      enabled: true
    },
    {
      id: 'company',
      label: 'Company Data',
      icon: <Building className="h-4 w-4" />,
      description: 'Industry, size, revenue, and more',
      creditsRequired: 1,
      enabled: true
    },
    {
      id: 'social',
      label: 'Social Profiles',
      icon: <Globe className="h-4 w-4" />,
      description: 'LinkedIn, Twitter, and other profiles',
      creditsRequired: 1,
      enabled: true
    },
    {
      id: 'title',
      label: 'Job Title',
      icon: <Briefcase className="h-4 w-4" />,
      description: 'Current position and seniority',
      creditsRequired: 1,
      enabled: true
    },
    {
      id: 'technographics',
      label: 'Technologies',
      icon: <Database className="h-4 w-4" />,
      description: 'Tech stack and tools used',
      creditsRequired: 2,
      enabled: true
    }
  ]

  // Fetch available providers
  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['enrichment-providers'],
    queryFn: async () => {
      const response = await fetch('/api/enrichment/providers')
      if (!response.ok) throw new Error('Failed to fetch providers')
      return response.json()
    }
  })

  // Fetch credit balance
  const { data: creditBalance, isLoading: creditsLoading, refetch: refetchCredits } = useQuery({
    queryKey: ['enrichment-credits'],
    queryFn: async () => {
      const response = await fetch('/api/enrichment/credits')
      if (!response.ok) throw new Error('Failed to fetch credits')
      return response.json() as Promise<CreditBalance>
    }
  })

  // Fetch enrichment history
  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['enrichment-history', lead?.id],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (lead?.id) params.append('leadId', lead.id)
      
      const response = await fetch(`/api/enrichment/history?${params}`)
      if (!response.ok) throw new Error('Failed to fetch history')
      return response.json() as Promise<EnrichmentHistory[]>
    },
    enabled: !!lead
  })

  // Calculate total credits required
  const calculateCreditsRequired = () => {
    const optionCredits = selectedOptions.reduce((sum, optionId) => {
      const option = enrichmentOptions.find(o => o.id === optionId)
      return sum + (option?.creditsRequired || 0)
    }, 0)
    return optionCredits * targetLeads.length
  }

  const totalCreditsRequired = calculateCreditsRequired()
  const hasEnoughCredits = (creditBalance?.available || 0) >= totalCreditsRequired

  // Enrich mutation
  const enrichMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        leadIds: targetLeads.map(l => l.id),
        options: selectedOptions,
        providerId: selectedProvider,
        priority
      }

      const response = await fetch('/api/enrichment/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Enrichment failed')
      }

      return response.json()
    },
    onSuccess: (data) => {
      setEnrichmentResults(data.results || [])
      refetchCredits()
      queryClient.invalidateQueries({ queryKey: ['enrichment-history'] })
      
      if (data.results && data.results.length > 0) {
        toast.success(`Enriched ${data.results.length} fields successfully`)
      }
      
      setIsEnriching(false)
      onUpdate?.()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Enrichment failed')
      setIsEnriching(false)
    }
  })

  const handleEnrich = () => {
    if (!hasEnoughCredits) {
      toast.error('Insufficient credits')
      return
    }

    if (!selectedProvider) {
      toast.error('Please select a provider')
      return
    }

    setIsEnriching(true)
    enrichMutation.mutate()
  }

  const handleToggleOption = (optionId: string) => {
    setSelectedOptions(prev =>
      prev.includes(optionId)
        ? prev.filter(id => id !== optionId)
        : [...prev, optionId]
    )
  }

  const handleEditField = (field: string) => {
    setEditingFields(prev => new Set(prev).add(field))
  }

  const handleSaveField = async (field: string, value: any) => {
    if (!lead) return

    try {
      const updates: any = {}
      
      // Map field to lead property
      if (field === 'email') updates.email = value
      else if (field === 'phone') updates.phone = value
      else if (field === 'company') updates.company = value
      else if (field === 'title') updates.title = value
      else if (field === 'first_name') updates.first_name = value
      else if (field === 'last_name') updates.last_name = value
      else {
        // Store in custom_fields
        updates.custom_fields = {
          ...lead.custom_fields,
          [field]: value
        }
      }

      const { error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', lead.id)

      if (error) throw error

      // Update local result
      setEnrichmentResults(prev =>
        prev.map(r => r.field === field ? { ...r, newValue: value } : r)
      )

      toast.success('Field updated')
      onUpdate?.()
    } catch (error) {
      console.error('Error updating field:', error)
      toast.error('Failed to update field')
    }

    setEditingFields(prev => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  const handleCancelEdit = (field: string) => {
    setEditingFields(prev => {
      const next = new Set(prev)
      next.delete(field)
      return next
    })
  }

  const handleReEnrich = (historyItem: EnrichmentHistory) => {
    // Pre-select options based on history
    const fields = historyItem.results.map(r => r.field)
    const options = enrichmentOptions
      .filter(opt => fields.some(f => f.includes(opt.id)))
      .map(opt => opt.id)
    
    setSelectedOptions(options)
    setSelectedProvider(historyItem.provider)
  }

  return (
    <div className="space-y-6">
      {/* Credit Balance */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Credit Balance</CardTitle>
            <PurchaseTokensDialog
              trigger={
                <Button variant="outline" size="sm">
                  <Zap className="mr-2 h-3 w-3" />
                  Get More
                </Button>
              }
              onSuccess={refetchCredits}
            />
          </div>
        </CardHeader>
        <CardContent>
          {creditsLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Available</span>
                <span className="text-2xl font-bold">{creditBalance?.available || 0}</span>
              </div>
              <Progress value={(creditBalance?.available || 0) / (creditBalance?.allocated || 1) * 100} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Used: {creditBalance?.used || 0}
                </span>
                <span className="text-muted-foreground">
                  Total: {creditBalance?.allocated || 0}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="options" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="options">Options</TabsTrigger>
          <TabsTrigger value="results" disabled={enrichmentResults.length === 0}>
            Results {enrichmentResults.length > 0 && `(${enrichmentResults.length})`}
          </TabsTrigger>
          <TabsTrigger value="history" disabled={isBulk}>
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="options" className="space-y-6">
          {/* Enrichment Options */}
          <div className="space-y-3">
            <Label>What to Enrich</Label>
            <div className="grid gap-3">
              {enrichmentOptions.map((option) => (
                <Card
                  key={option.id}
                  className={`cursor-pointer transition-colors ${
                    selectedOptions.includes(option.id) ? 'border-primary' : ''
                  }`}
                  onClick={() => handleToggleOption(option.id)}
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <Checkbox
                      checked={selectedOptions.includes(option.id)}
                      onCheckedChange={() => handleToggleOption(option.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {option.icon}
                        <span className="font-medium">{option.label}</span>
                        <Badge variant="secondary" className="ml-auto">
                          {option.creditsRequired} credit{option.creditsRequired > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Provider Selection */}
          {providers.length > 0 && (
            <div className="space-y-3">
              <Label>Provider</Label>
              <RadioGroup value={selectedProvider} onValueChange={setSelectedProvider}>
                <div className="grid gap-3">
                  {providers.map((provider: EnrichmentProvider) => (
                    <Card
                      key={provider.id}
                      className={`cursor-pointer transition-colors ${
                        selectedProvider === provider.id ? 'border-primary' : ''
                      }`}
                      onClick={() => setSelectedProvider(provider.id)}
                    >
                      <CardContent className="flex items-center gap-3 p-4">
                        <RadioGroupItem value={provider.id} />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{provider.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={provider.speed === 'fast' ? 'default' : 'secondary'}>
                                {provider.speed}
                              </Badge>
                              <Badge variant="outline">
                                {provider.accuracy}% accuracy
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </RadioGroup>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Priority</Label>
              <span className="text-sm text-muted-foreground">
                {priority === 10 ? 'Highest' : priority >= 7 ? 'High' : priority >= 4 ? 'Normal' : 'Low'}
              </span>
            </div>
            <Slider
              value={[priority]}
              onValueChange={([value]) => setPriority(value)}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
          </div>

          {/* Cost Summary */}
          <Alert className={hasEnoughCredits ? '' : 'border-destructive'}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p>
                  This enrichment will use <strong>{totalCreditsRequired} credits</strong>
                  {isBulk && ` (${targetLeads.length} leads × ${totalCreditsRequired / targetLeads.length} credits)`}
                </p>
                {!hasEnoughCredits && (
                  <p className="text-destructive">
                    You need {totalCreditsRequired - (creditBalance?.available || 0)} more credits
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>

          {/* Enrich Button */}
          <Button
            onClick={handleEnrich}
            disabled={
              !hasEnoughCredits ||
              selectedOptions.length === 0 ||
              !selectedProvider ||
              isEnriching
            }
            className="w-full"
          >
            {isEnriching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enriching...
              </>
            ) : enrichmentResults.length > 0 ? (
              'Apply Changes'
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Enrich for {totalCreditsRequired} Credit{totalCreditsRequired > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {enrichmentResults.length > 0 ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {enrichmentResults.map((result, index) => (
                  <ResultComparison
                    key={index}
                    result={result}
                    onEdit={handleEditField}
                    onSave={handleSaveField}
                    onCancel={handleCancelEdit}
                  />
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No enrichment results yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Configure options and run enrichment to see results
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : history.length > 0 ? (
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {history.map((item) => (
                  <Card key={item.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <Badge variant={
                          item.status === 'success' ? 'default' :
                          item.status === 'partial' ? 'secondary' : 'destructive'
                        }>
                          {item.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Provider</span>
                        <span className="font-medium">{item.provider}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Fields Enriched</span>
                        <span className="font-medium">{item.fieldsEnriched}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Credits Used</span>
                        <span className="font-medium">{item.creditsUsed}</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleReEnrich(item)}
                      >
                        <RefreshCw className="mr-2 h-3 w-3" />
                        Re-enrich with same options
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No enrichment history</p>
              <p className="text-sm text-muted-foreground mt-1">
                Previous enrichment attempts will appear here
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export function LeadEnrichment({ lead, leads, onUpdate, trigger }: LeadEnrichmentProps) {
  const [open, setOpen] = useState(false)
  const isBulk = !lead && leads && leads.length > 0
  const targetLeads = lead ? [lead] : (leads || [])

  if (isBulk) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline">
              <Sparkles className="mr-2 h-4 w-4" />
              Enrich {targetLeads.length} Lead{targetLeads.length > 1 ? 's' : ''}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Lead Enrichment</DialogTitle>
            <DialogDescription>
              Enrich {targetLeads.length} selected lead{targetLeads.length > 1 ? 's' : ''} with additional data
            </DialogDescription>
          </DialogHeader>
          <LeadEnrichmentContent lead={lead} leads={leads} onUpdate={() => { setOpen(false); onUpdate?.() }} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" />
            Enrich Lead
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Enrich Lead Data</SheetTitle>
          <SheetDescription>
            Find missing information and verify existing data
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <LeadEnrichmentContent lead={lead} leads={leads} onUpdate={onUpdate} />
        </div>
      </SheetContent>
    </Sheet>
  )
}