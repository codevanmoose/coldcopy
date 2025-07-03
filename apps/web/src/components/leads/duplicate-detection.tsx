'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Users, 
  AlertTriangle, 
  Merge, 
  Search,
  CheckCircle,
  XCircle,
  Mail,
  Building,
  Phone,
  Globe,
  Calendar,
  Shield,
  Trash2,
  Eye
} from 'lucide-react'

interface DuplicateLead {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  phone?: string
  createdAt: Date
  lastActivity: Date
  source: string
  score: number
  tags: string[]
  enrichmentData?: any
}

interface DuplicateGroup {
  id: string
  leads: DuplicateLead[]
  matchType: 'exact' | 'similar' | 'potential'
  matchFields: string[]
  confidence: number
}

export function DuplicateDetection() {
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([
    {
      id: '1',
      leads: [
        {
          id: 'lead1',
          email: 'john.smith@acme.com',
          firstName: 'John',
          lastName: 'Smith',
          company: 'Acme Corp',
          phone: '+1-555-0123',
          createdAt: new Date('2024-01-15'),
          lastActivity: new Date('2024-12-20'),
          source: 'Website Form',
          score: 85,
          tags: ['qualified', 'enterprise']
        },
        {
          id: 'lead2',
          email: 'j.smith@acme.com',
          firstName: 'J',
          lastName: 'Smith',
          company: 'Acme Corporation',
          phone: '+1-555-0123',
          createdAt: new Date('2024-03-10'),
          lastActivity: new Date('2024-11-15'),
          source: 'LinkedIn',
          score: 72,
          tags: ['contacted']
        }
      ],
      matchType: 'similar',
      matchFields: ['phone', 'lastName', 'company'],
      confidence: 89
    },
    {
      id: '2',
      leads: [
        {
          id: 'lead3',
          email: 'sarah.jones@techco.io',
          firstName: 'Sarah',
          lastName: 'Jones',
          company: 'TechCo',
          createdAt: new Date('2024-02-20'),
          lastActivity: new Date('2024-12-28'),
          source: 'Import',
          score: 65,
          tags: ['new']
        },
        {
          id: 'lead4',
          email: 'sarah.jones@techco.io',
          firstName: 'Sarah',
          lastName: 'Jones-Wilson',
          company: 'TechCo Inc',
          createdAt: new Date('2024-04-05'),
          lastActivity: new Date('2024-10-10'),
          source: 'API',
          score: 58,
          tags: ['new']
        }
      ],
      matchType: 'exact',
      matchFields: ['email'],
      confidence: 100
    }
  ])

  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null)
  const [selectedMaster, setSelectedMaster] = useState<string>('')
  const [selectedFields, setSelectedFields] = useState<Record<string, string>>({})

  const handleScan = async () => {
    setIsScanning(true)
    setScanProgress(0)
    
    // Simulate scanning progress
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsScanning(false)
          return 100
        }
        return prev + 10
      })
    }, 500)
  }

  const handleMerge = (groupId: string) => {
    const group = duplicateGroups.find(g => g.id === groupId)
    if (group) {
      setSelectedGroup(group)
      setSelectedMaster(group.leads[0].id)
    }
  }

  const getMatchTypeBadge = (type: DuplicateGroup['matchType']) => {
    const variants = {
      exact: { color: 'destructive', label: 'Exact Match' },
      similar: { color: 'secondary', label: 'Similar' },
      potential: { color: 'outline', label: 'Potential' }
    }
    
    const variant = variants[type]
    return (
      <Badge variant={variant.color as any}>
        {variant.label}
      </Badge>
    )
  }

  const getConfidenceBadge = (confidence: number) => {
    let color = 'bg-green-100 text-green-800'
    if (confidence < 70) color = 'bg-yellow-100 text-yellow-800'
    if (confidence < 50) color = 'bg-red-100 text-red-800'
    
    return (
      <Badge variant="secondary" className={color}>
        {confidence}% match
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Duplicate Detection</h2>
          <p className="text-muted-foreground">
            Find and merge duplicate leads to maintain data quality
          </p>
        </div>
        
        <Button 
          onClick={handleScan} 
          disabled={isScanning}
          size="lg"
        >
          {isScanning ? (
            <>
              <Search className="h-4 w-4 mr-2 animate-pulse" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="h-4 w-4 mr-2" />
              Scan for Duplicates
            </>
          )}
        </Button>
      </div>

      {/* Scanning Progress */}
      {isScanning && (
        <Card>
          <CardHeader>
            <CardTitle>Scanning for Duplicates</CardTitle>
            <CardDescription>
              Analyzing your lead database for potential duplicates...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress value={scanProgress} className="mb-2" />
            <p className="text-sm text-muted-foreground">
              {scanProgress}% complete - Checking {Math.floor(scanProgress * 50)} of 5,000 leads
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Duplicate Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{duplicateGroups.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Found in last scan
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Exact Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {duplicateGroups.filter(g => g.matchType === 'exact').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Same email address
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Similar Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {duplicateGroups.filter(g => g.matchType === 'similar').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Matching attributes
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Data Quality Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground mt-1">
              After deduplication
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Groups */}
      <Card>
        <CardHeader>
          <CardTitle>Duplicate Groups</CardTitle>
          <CardDescription>
            Review and merge duplicate leads to improve data quality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {duplicateGroups.map((group) => (
              <div key={group.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{group.leads.length} duplicate leads</span>
                    {getMatchTypeBadge(group.matchType)}
                    {getConfidenceBadge(group.confidence)}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setSelectedGroup(group)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Review
                    </Button>
                    <Button 
                      size="sm"
                      onClick={() => handleMerge(group.id)}
                    >
                      <Merge className="h-4 w-4 mr-1" />
                      Merge
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Matching on:</span>
                    {group.matchFields.map((field, index) => (
                      <Badge key={index} variant="secondary">
                        {field}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.leads.map((lead) => (
                      <div key={lead.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {lead.firstName} {lead.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {lead.email} • {lead.company}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {lead.source}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {duplicateGroups.length === 0 && !isScanning && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium">No duplicates found!</p>
              <p className="text-sm text-muted-foreground">
                Your lead database is clean and optimized
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Merge Dialog */}
      {selectedGroup && (
        <Card>
          <CardHeader>
            <CardTitle>Merge Duplicate Leads</CardTitle>
            <CardDescription>
              Select the master record and choose which fields to keep
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="master" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="master">Select Master</TabsTrigger>
                <TabsTrigger value="fields">Choose Fields</TabsTrigger>
                <TabsTrigger value="review">Review & Merge</TabsTrigger>
              </TabsList>
              
              <TabsContent value="master" className="space-y-4">
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    The master record will be kept, and other records will be merged into it.
                  </AlertDescription>
                </Alert>
                
                <RadioGroup value={selectedMaster} onValueChange={setSelectedMaster}>
                  {selectedGroup.leads.map((lead) => (
                    <div key={lead.id} className="flex items-start space-x-3 p-4 border rounded-lg">
                      <RadioGroupItem value={lead.id} id={lead.id} />
                      <Label htmlFor={lead.id} className="flex-1 cursor-pointer">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">
                              {lead.firstName} {lead.lastName}
                            </p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Score: {lead.score}</Badge>
                              <Badge variant="outline">
                                {lead.source}
                              </Badge>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </div>
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {lead.company}
                            </div>
                            {lead.phone && (
                              <div className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {lead.phone}
                              </div>
                            )}
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Created {lead.createdAt.toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </TabsContent>
              
              <TabsContent value="fields" className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Select which values to keep when merging. The master record's values are selected by default.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-4">
                  {/* Field selection would go here */}
                  <p className="text-sm text-muted-foreground">
                    Field selection interface would be implemented here...
                  </p>
                </div>
              </TabsContent>
              
              <TabsContent value="review" className="space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Review the merge summary before proceeding. This action cannot be undone.
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-2">Merge Summary</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Merging {selectedGroup.leads.length} leads into 1 record</li>
                      <li>• Master record: {selectedGroup.leads.find(l => l.id === selectedMaster)?.email}</li>
                      <li>• All activities and history will be preserved</li>
                      <li>• Tags and scores will be combined</li>
                    </ul>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectedGroup(null)}>
                      Cancel
                    </Button>
                    <Button>
                      <Merge className="h-4 w-4 mr-2" />
                      Merge Leads
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}