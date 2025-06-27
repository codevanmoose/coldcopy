"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { 
  Plus, Play, Pause, CheckCircle, XCircle, TrendingUp, 
  BarChart3, Users, Mail, MousePointer, Clock, Award,
  AlertCircle, RefreshCw, FlaskConical, Activity, Target,
  FileText
} from "lucide-react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, Cell
} from "recharts"
import { format } from "date-fns"

interface ABTest {
  id: string
  name: string
  status: 'draft' | 'running' | 'completed' | 'paused'
  test_type: string
  test_percentage: number
  confidence_threshold: number
  test_duration_hours: number
  winner_selection_method: string
  winner_variant_id?: string
  created_at: string
  started_at?: string
  completed_at?: string
  variants: ABTestVariant[]
  result?: ABTestResult
}

interface ABTestVariant {
  id: string
  name: string
  is_control: boolean
  traffic_percentage: number
  subject_line?: string
  metrics?: {
    open_rate: number
    click_rate: number
    reply_rate: number
    recipients: number
  }
  is_winner?: boolean
  statistical_significance?: {
    is_significant: boolean
    confidence_level: number
    p_value: number
  }
}

interface ABTestResult {
  winner_variant_id?: string
  lift_percentage?: number
  key_findings: string[]
  recommendations: string[]
  projected_impact: {
    additional_opens_per_1000: number
    additional_replies_per_1000: number
  }
}

const TEST_TYPES = [
  { value: 'subject_line', label: 'Subject Line', icon: Mail },
  { value: 'email_content', label: 'Email Content', icon: FileText },
  { value: 'send_time', label: 'Send Time', icon: Clock },
  { value: 'from_name', label: 'From Name', icon: Users },
  { value: 'cta_button', label: 'CTA Button', icon: MousePointer }
]

const WINNER_METHODS = [
  { value: 'open_rate', label: 'Open Rate' },
  { value: 'click_rate', label: 'Click Rate' },
  { value: 'reply_rate', label: 'Reply Rate' },
  { value: 'engagement_score', label: 'Engagement Score' },
  { value: 'manual', label: 'Manual Selection' }
]

export default function CampaignABTestingPage() {
  const params = useParams()
  const campaignId = params.id as string
  
  const [tests, setTests] = useState<ABTest[]>([])
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null)
  const [isCreatingTest, setIsCreatingTest] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  
  // New test form state
  const [newTest, setNewTest] = useState({
    name: '',
    test_type: 'subject_line',
    test_percentage: 20,
    confidence_threshold: 95,
    test_duration_hours: 24,
    winner_selection_method: 'open_rate',
    variants: [
      { name: 'Control', is_control: true, traffic_percentage: 50, subject_line: '' },
      { name: 'Variant A', is_control: false, traffic_percentage: 50, subject_line: '' }
    ]
  })

  useEffect(() => {
    loadTests()
  }, [campaignId])

  const loadTests = async () => {
    setIsLoading(true)
    try {
      // Mock data - replace with API call
      const mockTests: ABTest[] = [
        {
          id: '1',
          name: 'Subject Line Test - Q4 Campaign',
          status: 'completed',
          test_type: 'subject_line',
          test_percentage: 20,
          confidence_threshold: 95,
          test_duration_hours: 24,
          winner_selection_method: 'open_rate',
          winner_variant_id: 'v2',
          created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          started_at: new Date(Date.now() - 86400000 * 7).toISOString(),
          completed_at: new Date(Date.now() - 86400000 * 5).toISOString(),
          variants: [
            {
              id: 'v1',
              name: 'Control',
              is_control: true,
              traffic_percentage: 50,
              subject_line: 'Improve your sales process with our solution',
              metrics: {
                open_rate: 22.5,
                click_rate: 3.2,
                reply_rate: 1.8,
                recipients: 500
              },
              statistical_significance: {
                is_significant: true,
                confidence_level: 98.2,
                p_value: 0.018
              }
            },
            {
              id: 'v2',
              name: 'Variant A',
              is_control: false,
              traffic_percentage: 50,
              subject_line: 'Quick question about {{company}}\'s sales goals',
              metrics: {
                open_rate: 31.2,
                click_rate: 5.1,
                reply_rate: 3.2,
                recipients: 500
              },
              is_winner: true,
              statistical_significance: {
                is_significant: true,
                confidence_level: 98.2,
                p_value: 0.018
              }
            }
          ],
          result: {
            winner_variant_id: 'v2',
            lift_percentage: 38.7,
            key_findings: [
              'Personalized subject lines increased open rates by 38.7%',
              'Reply rates nearly doubled with the winning variant',
              'Statistical significance achieved after 500 recipients per variant'
            ],
            recommendations: [
              'Use personalized subject lines for future campaigns',
              'Test question-based subject lines vs. statement-based',
              'Consider testing preview text variations next'
            ],
            projected_impact: {
              additional_opens_per_1000: 87,
              additional_replies_per_1000: 14
            }
          }
        },
        {
          id: '2',
          name: 'Send Time Optimization',
          status: 'running',
          test_type: 'send_time',
          test_percentage: 30,
          confidence_threshold: 95,
          test_duration_hours: 48,
          winner_selection_method: 'engagement_score',
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          started_at: new Date(Date.now() - 86400000 * 1).toISOString(),
          variants: [
            {
              id: 'v3',
              name: 'Morning (9 AM)',
              is_control: true,
              traffic_percentage: 33.3,
              metrics: {
                open_rate: 18.2,
                click_rate: 2.8,
                reply_rate: 1.2,
                recipients: 234
              }
            },
            {
              id: 'v4',
              name: 'Afternoon (2 PM)',
              is_control: false,
              traffic_percentage: 33.3,
              metrics: {
                open_rate: 21.5,
                click_rate: 3.1,
                reply_rate: 1.5,
                recipients: 241
              }
            },
            {
              id: 'v5',
              name: 'Evening (6 PM)',
              is_control: false,
              traffic_percentage: 33.4,
              metrics: {
                open_rate: 19.8,
                click_rate: 2.9,
                reply_rate: 1.3,
                recipients: 238
              }
            }
          ]
        }
      ]
      
      setTests(mockTests)
      if (mockTests.length > 0 && !selectedTest) {
        setSelectedTest(mockTests[0])
      }
    } catch (error) {
      toast.error("Failed to load A/B tests")
    } finally {
      setIsLoading(false)
    }
  }

  const createTest = async () => {
    try {
      // Validate variants
      const totalPercentage = newTest.variants.reduce((sum, v) => sum + v.traffic_percentage, 0)
      if (Math.abs(totalPercentage - 100) > 0.01) {
        toast.error("Variant traffic must total 100%")
        return
      }

      // API call would go here
      toast.success("A/B test created successfully")
      setIsCreatingTest(false)
      loadTests()
    } catch (error) {
      toast.error("Failed to create A/B test")
    }
  }

  const startTest = async (testId: string) => {
    try {
      // API call would go here
      toast.success("A/B test started")
      loadTests()
    } catch (error) {
      toast.error("Failed to start A/B test")
    }
  }

  const addVariant = () => {
    if (newTest.variants.length >= 5) {
      toast.error("Maximum 5 variants allowed")
      return
    }

    const variantName = `Variant ${String.fromCharCode(65 + newTest.variants.length - 1)}`
    const remainingPercentage = 100 - newTest.variants.reduce((sum, v) => sum + v.traffic_percentage, 0)
    
    setNewTest({
      ...newTest,
      variants: [
        ...newTest.variants,
        {
          name: variantName,
          is_control: false,
          traffic_percentage: Math.min(remainingPercentage, 100 / (newTest.variants.length + 1)),
          subject_line: ''
        }
      ]
    })
  }

  const updateVariantTraffic = (index: number, percentage: number) => {
    const updatedVariants = [...newTest.variants]
    updatedVariants[index].traffic_percentage = percentage
    setNewTest({ ...newTest, variants: updatedVariants })
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft':
        return <FlaskConical className="w-4 h-4" />
      case 'running':
        return <Activity className="w-4 h-4" />
      case 'completed':
        return <CheckCircle className="w-4 h-4" />
      case 'paused':
        return <Pause className="w-4 h-4" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: { variant: 'secondary' as const, label: 'Draft' },
      running: { variant: 'default' as const, label: 'Running' },
      completed: { variant: 'outline' as const, label: 'Completed' },
      paused: { variant: 'secondary' as const, label: 'Paused' }
    }
    
    const config = variants[status as keyof typeof variants] || variants.draft
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {config.label}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground">Test and optimize your campaign performance</p>
        </div>
        
        <Dialog open={isCreatingTest} onOpenChange={setIsCreatingTest}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create A/B Test</DialogTitle>
              <DialogDescription>
                Test different variations to find what works best
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Test Name */}
              <div>
                <Label htmlFor="test-name">Test Name</Label>
                <Input
                  id="test-name"
                  value={newTest.name}
                  onChange={(e) => setNewTest({ ...newTest, name: e.target.value })}
                  placeholder="e.g., Subject Line Test - Q4 Campaign"
                />
              </div>

              {/* Test Type */}
              <div>
                <Label>Test Type</Label>
                <RadioGroup
                  value={newTest.test_type}
                  onValueChange={(value) => setNewTest({ ...newTest, test_type: value })}
                >
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {TEST_TYPES.map((type) => {
                      const Icon = type.icon
                      return (
                        <div key={type.value} className="relative">
                          <RadioGroupItem
                            value={type.value}
                            id={type.value}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={type.value}
                            className="flex items-center gap-2 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                          >
                            <Icon className="w-4 h-4" />
                            {type.label}
                          </Label>
                        </div>
                      )
                    })}
                  </div>
                </RadioGroup>
              </div>

              {/* Test Settings */}
              <div className="space-y-4">
                <div>
                  <Label>Test Audience Size</Label>
                  <div className="flex items-center gap-4 mt-2">
                    <Slider
                      value={[newTest.test_percentage]}
                      onValueChange={(value) => setNewTest({ ...newTest, test_percentage: value[0] })}
                      min={10}
                      max={50}
                      step={5}
                      className="flex-1"
                    />
                    <span className="w-12 text-right">{newTest.test_percentage}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Percentage of your audience to include in the test
                  </p>
                </div>

                <div>
                  <Label>Confidence Threshold</Label>
                  <Select
                    value={newTest.confidence_threshold.toString()}
                    onValueChange={(value) => setNewTest({ ...newTest, confidence_threshold: parseFloat(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90% Confidence</SelectItem>
                      <SelectItem value="95">95% Confidence (Recommended)</SelectItem>
                      <SelectItem value="99">99% Confidence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Winner Selection Method</Label>
                  <Select
                    value={newTest.winner_selection_method}
                    onValueChange={(value) => setNewTest({ ...newTest, winner_selection_method: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WINNER_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Variants */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>Variants</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addVariant}
                    disabled={newTest.variants.length >= 5}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Variant
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {newTest.variants.map((variant, index) => (
                    <Card key={index}>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{variant.name}</span>
                              {variant.is_control && (
                                <Badge variant="secondary">Control</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Traffic:</Label>
                              <Input
                                type="number"
                                value={variant.traffic_percentage}
                                onChange={(e) => updateVariantTraffic(index, parseFloat(e.target.value))}
                                className="w-20"
                                min={0}
                                max={100}
                              />
                              <span className="text-sm">%</span>
                            </div>
                          </div>
                          
                          {newTest.test_type === 'subject_line' && (
                            <div>
                              <Label className="text-sm">Subject Line</Label>
                              <Input
                                value={variant.subject_line}
                                onChange={(e) => {
                                  const updated = [...newTest.variants]
                                  updated[index].subject_line = e.target.value
                                  setNewTest({ ...newTest, variants: updated })
                                }}
                                placeholder="Enter subject line..."
                                className="mt-1"
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Button onClick={createTest} className="w-full">
                Create A/B Test
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tests</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                {tests.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No tests created yet</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {tests.map((test) => (
                      <div
                        key={test.id}
                        className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                          selectedTest?.id === test.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => setSelectedTest(test)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-sm">{test.name}</h4>
                          {getStatusBadge(test.status)}
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {TEST_TYPES.find(t => t.value === test.test_type)?.label}
                            </Badge>
                            <span>{test.variants.length} variants</span>
                          </div>
                          {test.started_at && (
                            <div>Started {format(new Date(test.started_at), 'MMM dd, HH:mm')}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Test Details */}
        {selectedTest && (
          <div className="lg:col-span-2 space-y-6">
            {/* Test Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedTest.name}</CardTitle>
                    <CardDescription>
                      Testing {selectedTest.variants.length} variants with {selectedTest.test_percentage}% of audience
                    </CardDescription>
                  </div>
                  {selectedTest.status === 'draft' && (
                    <Button onClick={() => startTest(selectedTest.id)}>
                      <Play className="w-4 h-4 mr-2" />
                      Start Test
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-xs">Status</Label>
                    <div className="mt-1">{getStatusBadge(selectedTest.status)}</div>
                  </div>
                  <div>
                    <Label className="text-xs">Test Type</Label>
                    <p className="font-medium">
                      {TEST_TYPES.find(t => t.value === selectedTest.test_type)?.label}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs">Confidence</Label>
                    <p className="font-medium">{selectedTest.confidence_threshold}%</p>
                  </div>
                  <div>
                    <Label className="text-xs">Winner Method</Label>
                    <p className="font-medium capitalize">
                      {selectedTest.winner_selection_method.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                {selectedTest.result && selectedTest.winner_variant_id && (
                  <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="w-5 h-5 text-green-600" />
                      <h4 className="font-medium">Winner Declared!</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {selectedTest.variants.find(v => v.id === selectedTest.winner_variant_id)?.name} 
                      {' '}achieved a {selectedTest.result.lift_percentage?.toFixed(1)}% lift in performance
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Variant Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Variant Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedTest.variants.map((variant) => (
                    <div key={variant.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{variant.name}</h4>
                          {variant.is_control && <Badge variant="secondary">Control</Badge>}
                          {variant.is_winner && <Badge className="bg-green-500">Winner</Badge>}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {variant.traffic_percentage}% of test traffic
                        </span>
                      </div>

                      {variant.subject_line && (
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-sm">{variant.subject_line}</p>
                        </div>
                      )}

                      {variant.metrics && (
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <Label className="text-xs">Recipients</Label>
                            <p className="font-medium">{variant.metrics.recipients}</p>
                          </div>
                          <div>
                            <Label className="text-xs">Open Rate</Label>
                            <p className="font-medium">{variant.metrics.open_rate.toFixed(1)}%</p>
                          </div>
                          <div>
                            <Label className="text-xs">Click Rate</Label>
                            <p className="font-medium">{variant.metrics.click_rate.toFixed(1)}%</p>
                          </div>
                          <div>
                            <Label className="text-xs">Reply Rate</Label>
                            <p className="font-medium">{variant.metrics.reply_rate.toFixed(1)}%</p>
                          </div>
                        </div>
                      )}

                      {variant.statistical_significance && variant.statistical_significance.is_significant && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-green-600">
                            Statistically significant ({variant.statistical_significance.confidence_level.toFixed(1)}% confidence)
                          </span>
                        </div>
                      )}

                      <Separator />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Test Results & Insights */}
            {selectedTest.result && (
              <Card>
                <CardHeader>
                  <CardTitle>Test Results & Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Key Findings */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Key Findings
                    </h4>
                    <ul className="space-y-2">
                      {selectedTest.result.key_findings.map((finding, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {selectedTest.result.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Projected Impact */}
                  <div>
                    <h4 className="font-medium mb-3">Projected Impact</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold text-green-600">
                            +{selectedTest.result.projected_impact.additional_opens_per_1000}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Additional opens per 1,000 emails
                          </p>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-4">
                          <div className="text-2xl font-bold text-blue-600">
                            +{selectedTest.result.projected_impact.additional_replies_per_1000}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Additional replies per 1,000 emails
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}