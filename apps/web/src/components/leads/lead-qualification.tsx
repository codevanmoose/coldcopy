'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { 
  Target, 
  ChevronRight, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  User,
  Building,
  DollarSign,
  Calendar,
  TrendingUp,
  Briefcase,
  Phone,
  Mail,
  Globe,
  FileText,
  ArrowRight,
  Clock,
  Zap
} from 'lucide-react'

interface QualificationCriteria {
  id: string
  name: string
  description: string
  required: boolean
  met: boolean | null
  value?: string
  icon: any
}

interface Lead {
  id: string
  name: string
  email: string
  company: string
  title: string
  score: number
  qualificationStatus: 'unqualified' | 'qualifying' | 'qualified' | 'disqualified'
  qualificationProgress: number
}

export function LeadQualification() {
  const [selectedLead, setSelectedLead] = useState<Lead>({
    id: '1',
    name: 'John Smith',
    email: 'john.smith@acme.com',
    company: 'Acme Corp',
    title: 'VP of Sales',
    score: 85,
    qualificationStatus: 'qualifying',
    qualificationProgress: 60
  })

  const [showQualifyDialog, setShowQualifyDialog] = useState(false)
  const [qualificationCriteria, setQualificationCriteria] = useState<QualificationCriteria[]>([
    {
      id: 'budget',
      name: 'Budget',
      description: 'Has defined budget for solution',
      required: true,
      met: true,
      value: '$50,000 - $100,000',
      icon: DollarSign
    },
    {
      id: 'authority',
      name: 'Authority',
      description: 'Decision maker or influencer',
      required: true,
      met: true,
      value: 'VP level, reports to C-suite',
      icon: User
    },
    {
      id: 'need',
      name: 'Need',
      description: 'Clear business need identified',
      required: true,
      met: null,
      icon: Target
    },
    {
      id: 'timeline',
      name: 'Timeline',
      description: 'Implementation timeline defined',
      required: true,
      met: null,
      icon: Calendar
    },
    {
      id: 'company_size',
      name: 'Company Size',
      description: 'Meets target company criteria',
      required: false,
      met: true,
      value: '500-1000 employees',
      icon: Building
    },
    {
      id: 'growth',
      name: 'Growth Potential',
      description: 'Opportunity for expansion',
      required: false,
      met: true,
      value: 'Multiple departments interested',
      icon: TrendingUp
    }
  ])

  const [disqualificationReason, setDisqualificationReason] = useState('')
  const [notes, setNotes] = useState('')

  const calculateProgress = () => {
    const total = qualificationCriteria.length
    const completed = qualificationCriteria.filter(c => c.met !== null).length
    return Math.round((completed / total) * 100)
  }

  const canQualify = () => {
    return qualificationCriteria
      .filter(c => c.required)
      .every(c => c.met === true)
  }

  const handleQualify = () => {
    setSelectedLead({
      ...selectedLead,
      qualificationStatus: 'qualified',
      qualificationProgress: 100
    })
    setShowQualifyDialog(false)
  }

  const handleDisqualify = () => {
    setSelectedLead({
      ...selectedLead,
      qualificationStatus: 'disqualified',
      qualificationProgress: calculateProgress()
    })
  }

  const updateCriteria = (id: string, met: boolean) => {
    setQualificationCriteria(prev =>
      prev.map(c => c.id === id ? { ...c, met } : c)
    )
  }

  return (
    <div className="space-y-6">
      {/* Lead Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{selectedLead.name}</CardTitle>
              <CardDescription>
                {selectedLead.title} at {selectedLead.company}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                variant={
                  selectedLead.qualificationStatus === 'qualified' ? 'default' :
                  selectedLead.qualificationStatus === 'disqualified' ? 'destructive' :
                  'secondary'
                }
                className="text-sm px-3 py-1"
              >
                {selectedLead.qualificationStatus.charAt(0).toUpperCase() + 
                 selectedLead.qualificationStatus.slice(1)}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">
                Score: {selectedLead.score}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Qualification Progress</span>
                <span className="text-sm text-muted-foreground">
                  {calculateProgress()}% Complete
                </span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedLead.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">+1 (555) 123-4567</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">www.acme.com</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Qualification Process */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* BANT Criteria */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Qualification Criteria (BANT)</CardTitle>
              <CardDescription>
                Evaluate the lead against your qualification framework
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {qualificationCriteria.map((criteria) => {
                  const Icon = criteria.icon
                  return (
                    <div 
                      key={criteria.id}
                      className={`p-4 border rounded-lg ${
                        criteria.met === null ? 'border-dashed' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg ${
                          criteria.met === true ? 'bg-green-100' :
                          criteria.met === false ? 'bg-red-100' :
                          'bg-gray-100'
                        }`}>
                          <Icon className={`h-5 w-5 ${
                            criteria.met === true ? 'text-green-600' :
                            criteria.met === false ? 'text-red-600' :
                            'text-gray-600'
                          }`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium flex items-center gap-2">
                                {criteria.name}
                                {criteria.required && (
                                  <Badge variant="outline" className="text-xs">
                                    Required
                                  </Badge>
                                )}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                {criteria.description}
                              </p>
                              {criteria.value && criteria.met && (
                                <p className="text-sm font-medium mt-1 text-primary">
                                  {criteria.value}
                                </p>
                              )}
                            </div>
                            
                            <RadioGroup
                              value={criteria.met === null ? '' : criteria.met.toString()}
                              onValueChange={(value) => updateCriteria(criteria.id, value === 'true')}
                            >
                              <div className="flex items-center gap-4">
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="true" id={`${criteria.id}-yes`} />
                                  <Label htmlFor={`${criteria.id}-yes`} className="cursor-pointer">
                                    Yes
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="false" id={`${criteria.id}-no`} />
                                  <Label htmlFor={`${criteria.id}-no`} className="cursor-pointer">
                                    No
                                  </Label>
                                </div>
                              </div>
                            </RadioGroup>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Notes Section */}
          <Card>
            <CardHeader>
              <CardTitle>Qualification Notes</CardTitle>
              <CardDescription>
                Add any additional context or observations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Enter notes about the qualification process..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Actions & Next Steps */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Qualification Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full" 
                size="lg"
                disabled={!canQualify()}
                onClick={() => setShowQualifyDialog(true)}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Qualify Lead
              </Button>
              
              <Button 
                className="w-full" 
                size="lg"
                variant="destructive"
                onClick={handleDisqualify}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Disqualify Lead
              </Button>
              
              <Button 
                className="w-full" 
                size="lg"
                variant="outline"
              >
                <Clock className="h-4 w-4 mr-2" />
                Schedule Follow-up
              </Button>
              
              {!canQualify() && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Complete all required criteria to qualify this lead.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next Best Action</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Alert>
                  <Zap className="h-4 w-4" />
                  <AlertTitle>Recommended Action</AlertTitle>
                  <AlertDescription>
                    Schedule a discovery call to identify specific business needs and confirm timeline.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Suggested Topics:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      Current pain points and challenges
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      Success criteria and KPIs
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      Decision-making process
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      Implementation timeline
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Qualification History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Budget Confirmed</p>
                    <p className="text-xs text-muted-foreground">2 days ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-primary mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Authority Verified</p>
                    <p className="text-xs text-muted-foreground">3 days ago</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-2 w-2 rounded-full bg-muted mt-1.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Initial Contact</p>
                    <p className="text-xs text-muted-foreground">1 week ago</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Qualify Dialog */}
      <Dialog open={showQualifyDialog} onOpenChange={setShowQualifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Qualify Lead</DialogTitle>
            <DialogDescription>
              This lead will be marked as qualified and converted to an opportunity.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>All requirements met!</AlertTitle>
              <AlertDescription>
                This lead has passed all required qualification criteria and is ready to be converted.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <h4 className="text-sm font-medium">What happens next:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Lead status changes to "Qualified"
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Create new opportunity record
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Assign to sales team
                </li>
                <li className="flex items-center gap-2">
                  <ArrowRight className="h-3 w-3" />
                  Start sales process workflow
                </li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQualifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleQualify}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Qualify & Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}