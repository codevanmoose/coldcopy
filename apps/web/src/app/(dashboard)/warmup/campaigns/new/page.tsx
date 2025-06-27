"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { 
  Zap, ArrowRight, ArrowLeft, Mail, Calendar, TrendingUp, 
  Shield, AlertCircle, CheckCircle2, Info, Clock, Target,
  BarChart3, Settings, Gauge, ChevronRight, Rocket
} from "lucide-react"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

interface WarmupCampaignForm {
  name: string
  email_address: string
  strategy: string
  target_daily_volume: number
  custom_schedule?: any
}

const STRATEGY_DETAILS = {
  conservative: {
    label: 'Conservative',
    description: 'Slow and steady approach for maximum safety',
    icon: <Shield className="w-5 h-5" />,
    color: 'text-blue-500',
    specs: {
      initial: 5,
      increment: 5,
      max: 500,
      days: 45,
      engagement: '50%'
    }
  },
  moderate: {
    label: 'Moderate',
    description: 'Balanced approach for most use cases',
    icon: <Gauge className="w-5 h-5" />,
    color: 'text-green-500',
    specs: {
      initial: 10,
      increment: 10,
      max: 1000,
      days: 30,
      engagement: '40%'
    }
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Faster ramp-up for experienced senders',
    icon: <Rocket className="w-5 h-5" />,
    color: 'text-orange-500',
    specs: {
      initial: 20,
      increment: 20,
      max: 2000,
      days: 20,
      engagement: '30%'
    }
  }
}

export default function NewWarmupCampaignPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [domainCheck, setDomainCheck] = useState<any>(null)
  const [isCheckingDomain, setIsCheckingDomain] = useState(false)
  
  const [form, setForm] = useState<WarmupCampaignForm>({
    name: '',
    email_address: '',
    strategy: 'moderate',
    target_daily_volume: 1000
  })

  const totalSteps = 3

  const handleEmailChange = (email: string) => {
    setForm({ ...form, email_address: email })
    
    // Auto-fill campaign name if empty
    if (!form.name && email) {
      const domain = email.split('@')[1]
      setForm(prev => ({ ...prev, name: `Warm-up for ${domain || email}` }))
    }
    
    // Clear domain check when email changes
    setDomainCheck(null)
  }

  const checkDomain = async () => {
    if (!form.email_address || !form.email_address.includes('@')) {
      return
    }
    
    setIsCheckingDomain(true)
    try {
      // API call would go here
      // const response = await fetch(`/api/warmup/check-domain?email=${form.email_address}`)
      // const data = await response.json()
      
      // Mock response
      const domain = form.email_address.split('@')[1]
      setDomainCheck({
        domain,
        spf: true,
        dkim: Math.random() > 0.3,
        dmarc: Math.random() > 0.4,
        mx: true,
        reputation: Math.floor(Math.random() * 30) + 70,
        blacklisted: false
      })
    } catch (error) {
      toast.error("Failed to check domain")
    } finally {
      setIsCheckingDomain(false)
    }
  }

  const generatePreview = () => {
    const strategy = STRATEGY_DETAILS[form.strategy as keyof typeof STRATEGY_DETAILS]
    const days = []
    let current = strategy.specs.initial
    
    for (let day = 1; day <= strategy.specs.days; day++) {
      days.push({
        day,
        volume: Math.min(current, form.target_daily_volume, strategy.specs.max),
        target: form.target_daily_volume
      })
      
      if (current < form.target_daily_volume && current < strategy.specs.max) {
        current = Math.min(
          current + strategy.specs.increment,
          form.target_daily_volume,
          strategy.specs.max
        )
      }
    }
    
    return days
  }

  const createCampaign = async () => {
    setIsLoading(true)
    try {
      // API call would go here
      // const response = await fetch('/api/warmup/campaigns', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(form)
      // })
      
      toast.success("Warm-up campaign created successfully!")
      router.push('/warmup')
    } catch (error) {
      toast.error("Failed to create campaign")
    } finally {
      setIsLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return form.name && form.email_address && form.email_address.includes('@')
      case 2:
        return form.strategy
      case 3:
        return form.target_daily_volume >= 100
      default:
        return false
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2 mb-2">
          <Zap className="w-8 h-8" />
          Create Warm-up Campaign
        </h1>
        <p className="text-muted-foreground">
          Build sender reputation gradually for your email address
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center ${s < totalSteps ? 'flex-1' : ''}`}
            >
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center font-medium
                ${step >= s 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground'}
              `}>
                {s}
              </div>
              {s < totalSteps && (
                <div className={`
                  flex-1 h-1 mx-2 
                  ${step > s ? 'bg-primary' : 'bg-muted'}
                `} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm">
          <span className={step >= 1 ? 'text-foreground' : 'text-muted-foreground'}>
            Email Setup
          </span>
          <span className={step >= 2 ? 'text-foreground' : 'text-muted-foreground'}>
            Strategy
          </span>
          <span className={step >= 3 ? 'text-foreground' : 'text-muted-foreground'}>
            Volume & Review
          </span>
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>
            {step === 1 && "Email Setup"}
            {step === 2 && "Warm-up Strategy"}
            {step === 3 && "Volume & Review"}
          </CardTitle>
          <CardDescription>
            {step === 1 && "Configure the email address you want to warm up"}
            {step === 2 && "Choose your warm-up approach based on your needs"}
            {step === 3 && "Set your target volume and review the warm-up plan"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="campaign-name">Campaign Name</Label>
                <Input
                  id="campaign-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Main Domain Warm-up"
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A friendly name to identify this warm-up campaign
                </p>
              </div>

              <div>
                <Label htmlFor="email-address">Email Address</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="email-address"
                    type="email"
                    value={form.email_address}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder="sales@yourdomain.com"
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={checkDomain}
                    disabled={!form.email_address || isCheckingDomain}
                  >
                    {isCheckingDomain ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <Shield className="w-4 h-4" />
                    )}
                    Check Domain
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  The email address that will send warm-up emails
                </p>
              </div>

              {domainCheck && (
                <Card className="bg-muted/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Domain Health Check - {domainCheck.domain}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        {domainCheck.spf ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-sm">SPF Record</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {domainCheck.dkim ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="text-sm">DKIM Signature</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {domainCheck.dmarc ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-orange-500" />
                        )}
                        <span className="text-sm">DMARC Policy</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm">MX Records</span>
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Domain Reputation</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${
                          domainCheck.reputation >= 80 ? 'text-green-600' :
                          domainCheck.reputation >= 60 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {domainCheck.reputation}/100
                        </span>
                        <Badge variant={domainCheck.reputation >= 80 ? "default" : "secondary"}>
                          {domainCheck.reputation >= 80 ? 'Good' :
                           domainCheck.reputation >= 60 ? 'Fair' : 'Poor'}
                        </Badge>
                      </div>
                    </div>
                    
                    {(!domainCheck.spf || !domainCheck.dkim || !domainCheck.dmarc) && (
                      <>
                        <Separator />
                        <div className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg">
                          <Info className="w-4 h-4 text-orange-600 mt-0.5" />
                          <div className="text-sm">
                            <p className="font-medium text-orange-900">
                              DNS Configuration Recommended
                            </p>
                            <p className="text-orange-700 mt-1">
                              Missing authentication records may impact deliverability. 
                              Configure SPF, DKIM, and DMARC before starting warm-up.
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <RadioGroup
                value={form.strategy}
                onValueChange={(value) => setForm({ ...form, strategy: value })}
              >
                <div className="grid gap-4">
                  {Object.entries(STRATEGY_DETAILS).map(([key, strategy]) => (
                    <label
                      key={key}
                      htmlFor={key}
                      className={`
                        relative flex cursor-pointer rounded-lg border p-4
                        ${form.strategy === key 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'}
                      `}
                    >
                      <RadioGroupItem
                        value={key}
                        id={key}
                        className="sr-only"
                      />
                      
                      <div className="flex flex-1 items-start gap-4">
                        <div className={`mt-0.5 ${strategy.color}`}>
                          {strategy.icon}
                        </div>
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{strategy.label}</span>
                            {form.strategy === key && (
                              <Badge variant="default" className="text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground">
                            {strategy.description}
                          </p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Start</p>
                              <p className="text-sm font-medium">{strategy.specs.initial}/day</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Increase</p>
                              <p className="text-sm font-medium">+{strategy.specs.increment}/day</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Max</p>
                              <p className="text-sm font-medium">{strategy.specs.max}/day</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Duration</p>
                              <p className="text-sm font-medium">{strategy.specs.days} days</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Engagement</p>
                              <p className="text-sm font-medium">{strategy.specs.engagement}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>

              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    Strategy Recommendation
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <p>
                    <strong>Conservative:</strong> Best for new domains or recovering from reputation issues
                  </p>
                  <p>
                    <strong>Moderate:</strong> Ideal for most use cases with established domains
                  </p>
                  <p>
                    <strong>Aggressive:</strong> Only for experienced senders with excellent reputation
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="target-volume">Target Daily Volume</Label>
                <div className="flex items-center gap-4 mt-2">
                  <Input
                    id="target-volume"
                    type="number"
                    value={form.target_daily_volume}
                    onChange={(e) => setForm({ ...form, target_daily_volume: parseInt(e.target.value) || 0 })}
                    min={100}
                    max={10000}
                    step={100}
                    className="w-32"
                  />
                  <span className="text-muted-foreground">emails per day</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  The volume you want to reach after warm-up completion
                </p>
              </div>

              <Separator />

              {/* Campaign Summary */}
              <div className="space-y-4">
                <h3 className="font-medium">Campaign Summary</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Campaign Name</p>
                    <p className="font-medium">{form.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Email Address</p>
                    <p className="font-medium">{form.email_address}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Strategy</p>
                    <p className="font-medium">
                      {STRATEGY_DETAILS[form.strategy as keyof typeof STRATEGY_DETAILS].label}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Target Volume</p>
                    <p className="font-medium">{form.target_daily_volume} emails/day</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Volume Preview Chart */}
              <div>
                <h3 className="font-medium mb-4">Warm-up Schedule Preview</h3>
                <Card className="p-4">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={generatePreview()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="day" 
                        label={{ value: 'Day', position: 'insideBottom', offset: -5 }}
                      />
                      <YAxis 
                        label={{ value: 'Emails/Day', angle: -90, position: 'insideLeft' }}
                      />
                      <Tooltip />
                      <Line 
                        type="stepAfter" 
                        dataKey="volume" 
                        stroke="#6366F1" 
                        strokeWidth={2}
                        name="Daily Volume"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="target" 
                        stroke="#EF4444" 
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        name="Target"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
                
                <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Calendar className="w-4 h-4" />
                      <span>Duration</span>
                    </div>
                    <p className="font-medium">
                      {STRATEGY_DETAILS[form.strategy as keyof typeof STRATEGY_DETAILS].specs.days} days
                    </p>
                  </Card>
                  
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <TrendingUp className="w-4 h-4" />
                      <span>Max Daily</span>
                    </div>
                    <p className="font-medium">
                      {Math.min(
                        form.target_daily_volume,
                        STRATEGY_DETAILS[form.strategy as keyof typeof STRATEGY_DETAILS].specs.max
                      )} emails
                    </p>
                  </Card>
                  
                  <Card className="p-3">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Target className="w-4 h-4" />
                      <span>Total Emails</span>
                    </div>
                    <p className="font-medium">
                      ~{generatePreview().reduce((sum, day) => sum + day.volume, 0).toLocaleString()}
                    </p>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous
        </Button>
        
        {step < totalSteps ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={createCampaign}
            disabled={!canProceed() || isLoading}
          >
            {isLoading ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                Create Campaign
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}