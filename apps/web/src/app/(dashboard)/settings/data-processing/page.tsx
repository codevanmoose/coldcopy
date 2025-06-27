'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/ui/use-toast'
import { 
  Database, 
  Shield, 
  Globe, 
  Users, 
  FileText,
  Plus,
  Edit,
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { LegalBasis, DataProcessingActivity } from '@/lib/gdpr/types'

interface ProcessingActivity extends DataProcessingActivity {
  id: string
}

const DATA_CATEGORIES = [
  'Personal identification data',
  'Contact information',
  'Professional data',
  'Financial data',
  'Technical data',
  'Usage data',
  'Marketing preferences',
  'Communication history',
  'Social media data',
  'Location data',
]

const SECURITY_MEASURES = [
  'Encryption at rest',
  'Encryption in transit',
  'Access controls',
  'Regular backups',
  'Audit logging',
  'Pseudonymization',
  'Data minimization',
  'Regular security assessments',
  'Employee training',
  'Incident response plan',
]

const RECIPIENTS = [
  'Internal teams',
  'Service providers',
  'Email delivery services',
  'Analytics providers',
  'Payment processors',
  'Customer support tools',
  'Marketing platforms',
  'Legal authorities (when required)',
]

export default function DataProcessingRegisterPage() {
  const { toast } = useToast()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [activities, setActivities] = useState<ProcessingActivity[]>([])
  const [showDialog, setShowDialog] = useState(false)
  const [editingActivity, setEditingActivity] = useState<ProcessingActivity | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string>('')
  
  // Form state
  const [formData, setFormData] = useState({
    activityName: '',
    description: '',
    purpose: [] as string[],
    legalBasis: LegalBasis.LEGITIMATE_INTERESTS,
    legalBasisDetails: '',
    dataCategories: [] as string[],
    dataSources: [] as string[],
    recipients: [] as string[],
    thirdCountries: [] as string[],
    retentionPeriod: '',
    securityMeasures: [] as string[],
    riskLevel: 'medium' as 'low' | 'medium' | 'high',
    dpiaRequired: false,
  })

  useEffect(() => {
    loadUserAndActivities()
  }, [])

  async function loadUserAndActivities() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user's workspace
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single()

      if (!profile?.workspace_id) return

      setWorkspaceId(profile.workspace_id)
      await loadActivities(profile.workspace_id)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadActivities(workspaceId: string) {
    try {
      const { data, error } = await supabase
        .from('data_processing_activities')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setActivities(data || [])
    } catch (error) {
      console.error('Error loading activities:', error)
      toast({
        title: 'Error',
        description: 'Failed to load data processing activities',
        variant: 'destructive',
      })
    }
  }

  async function handleSubmit() {
    try {
      if (editingActivity) {
        // Update existing activity
        const { error } = await supabase
          .from('data_processing_activities')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingActivity.id)

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Processing activity updated successfully',
        })
      } else {
        // Create new activity
        const { error } = await supabase
          .from('data_processing_activities')
          .insert({
            workspace_id: workspaceId,
            ...formData,
            is_active: true,
          })

        if (error) throw error

        toast({
          title: 'Success',
          description: 'Processing activity created successfully',
        })
      }

      setShowDialog(false)
      resetForm()
      await loadActivities(workspaceId)
    } catch (error) {
      console.error('Error saving activity:', error)
      toast({
        title: 'Error',
        description: 'Failed to save processing activity',
        variant: 'destructive',
      })
    }
  }

  async function handleDelete(activityId: string) {
    if (!confirm('Are you sure you want to delete this processing activity?')) return

    try {
      const { error } = await supabase
        .from('data_processing_activities')
        .update({ is_active: false })
        .eq('id', activityId)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Processing activity deleted successfully',
      })

      await loadActivities(workspaceId)
    } catch (error) {
      console.error('Error deleting activity:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete processing activity',
        variant: 'destructive',
      })
    }
  }

  function handleEdit(activity: ProcessingActivity) {
    setEditingActivity(activity)
    setFormData({
      activityName: activity.activityName,
      description: activity.description,
      purpose: activity.purpose,
      legalBasis: activity.legalBasis,
      legalBasisDetails: activity.legalBasisDetails || '',
      dataCategories: activity.dataCategories,
      dataSources: activity.dataSources || [],
      recipients: activity.recipients || [],
      thirdCountries: activity.thirdCountries || [],
      retentionPeriod: activity.retentionPeriod,
      securityMeasures: activity.securityMeasures,
      riskLevel: activity.riskLevel || 'medium',
      dpiaRequired: activity.dpiaRequired,
    })
    setShowDialog(true)
  }

  function resetForm() {
    setEditingActivity(null)
    setFormData({
      activityName: '',
      description: '',
      purpose: [],
      legalBasis: LegalBasis.LEGITIMATE_INTERESTS,
      legalBasisDetails: '',
      dataCategories: [],
      dataSources: [],
      recipients: [],
      thirdCountries: [],
      retentionPeriod: '',
      securityMeasures: [],
      riskLevel: 'medium',
      dpiaRequired: false,
    })
  }

  function addPurpose() {
    const purpose = prompt('Enter processing purpose:')
    if (purpose) {
      setFormData(prev => ({
        ...prev,
        purpose: [...prev.purpose, purpose],
      }))
    }
  }

  function removePurpose(index: number) {
    setFormData(prev => ({
      ...prev,
      purpose: prev.purpose.filter((_, i) => i !== index),
    }))
  }

  const getLegalBasisBadge = (basis: LegalBasis) => {
    const colors: Record<LegalBasis, string> = {
      [LegalBasis.CONSENT]: 'bg-green-100 text-green-800',
      [LegalBasis.CONTRACT]: 'bg-blue-100 text-blue-800',
      [LegalBasis.LEGAL_OBLIGATION]: 'bg-red-100 text-red-800',
      [LegalBasis.VITAL_INTERESTS]: 'bg-orange-100 text-orange-800',
      [LegalBasis.PUBLIC_TASK]: 'bg-purple-100 text-purple-800',
      [LegalBasis.LEGITIMATE_INTERESTS]: 'bg-gray-100 text-gray-800',
    }

    return (
      <Badge className={colors[basis]}>
        {basis.replace(/_/g, ' ')}
      </Badge>
    )
  }

  const getRiskBadge = (level: string) => {
    const colors = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    }

    return (
      <Badge className={colors[level as keyof typeof colors]}>
        {level} risk
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Data Processing Register</h1>
          <p className="text-muted-foreground">
            Record of Processing Activities (RoPA) as required by GDPR Article 30
          </p>
        </div>
        <Button onClick={() => {
          resetForm()
          setShowDialog(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Activity
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activities.length}</div>
            <p className="text-xs text-muted-foreground">
              Active processing activities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activities.filter(a => a.riskLevel === 'high').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Activities requiring DPIA
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">International</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activities.filter(a => a.thirdCountries && a.thirdCountries.length > 0).length}
            </div>
            <p className="text-xs text-muted-foreground">
              With international transfers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Activities</CardTitle>
          <CardDescription>
            All data processing activities performed by your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No processing activities recorded yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Activity Name</TableHead>
                  <TableHead>Legal Basis</TableHead>
                  <TableHead>Data Categories</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>DPIA</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{activity.activityName}</p>
                        <p className="text-sm text-muted-foreground">
                          {activity.description.substring(0, 60)}...
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getLegalBasisBadge(activity.legalBasis)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {activity.dataCategories.slice(0, 2).join(', ')}
                        {activity.dataCategories.length > 2 && (
                          <span className="text-muted-foreground">
                            {' '}+{activity.dataCategories.length - 2} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getRiskBadge(activity.riskLevel || 'medium')}</TableCell>
                    <TableCell>
                      {activity.dpiaRequired ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(activity)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(activity.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingActivity ? 'Edit Processing Activity' : 'Add Processing Activity'}
            </DialogTitle>
            <DialogDescription>
              Record details about how personal data is processed
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Activity Name</Label>
                <Input
                  value={formData.activityName}
                  onChange={(e) => setFormData(prev => ({ ...prev, activityName: e.target.value }))}
                  placeholder="e.g., Lead Enrichment"
                />
              </div>
              <div>
                <Label>Legal Basis</Label>
                <Select
                  value={formData.legalBasis}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, legalBasis: value as LegalBasis }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LegalBasis.CONSENT}>Consent</SelectItem>
                    <SelectItem value={LegalBasis.CONTRACT}>Contract</SelectItem>
                    <SelectItem value={LegalBasis.LEGAL_OBLIGATION}>Legal Obligation</SelectItem>
                    <SelectItem value={LegalBasis.VITAL_INTERESTS}>Vital Interests</SelectItem>
                    <SelectItem value={LegalBasis.PUBLIC_TASK}>Public Task</SelectItem>
                    <SelectItem value={LegalBasis.LEGITIMATE_INTERESTS}>Legitimate Interests</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the processing activity..."
                rows={3}
              />
            </div>

            {formData.legalBasis === LegalBasis.LEGITIMATE_INTERESTS && (
              <div>
                <Label>Legitimate Interests Assessment</Label>
                <Textarea
                  value={formData.legalBasisDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, legalBasisDetails: e.target.value }))}
                  placeholder="Describe the legitimate interests and balancing test..."
                  rows={2}
                />
              </div>
            )}

            <div>
              <Label>Processing Purposes</Label>
              <div className="space-y-2">
                {formData.purpose.map((purpose, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={purpose} readOnly />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => removePurpose(index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addPurpose}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Purpose
                </Button>
              </div>
            </div>

            <div>
              <Label>Data Categories</Label>
              <div className="space-y-2">
                {DATA_CATEGORIES.map((category) => (
                  <div key={category} className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.dataCategories.includes(category)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData(prev => ({
                            ...prev,
                            dataCategories: [...prev.dataCategories, category],
                          }))
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            dataCategories: prev.dataCategories.filter(c => c !== category),
                          }))
                        }
                      }}
                    />
                    <label className="text-sm">{category}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Recipients</Label>
              <div className="space-y-2">
                {RECIPIENTS.map((recipient) => (
                  <div key={recipient} className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.recipients.includes(recipient)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData(prev => ({
                            ...prev,
                            recipients: [...prev.recipients, recipient],
                          }))
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            recipients: prev.recipients.filter(r => r !== recipient),
                          }))
                        }
                      }}
                    />
                    <label className="text-sm">{recipient}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Retention Period</Label>
                <Input
                  value={formData.retentionPeriod}
                  onChange={(e) => setFormData(prev => ({ ...prev, retentionPeriod: e.target.value }))}
                  placeholder="e.g., 2 years after last activity"
                />
              </div>
              <div>
                <Label>Risk Level</Label>
                <Select
                  value={formData.riskLevel}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, riskLevel: value as 'low' | 'medium' | 'high' }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Security Measures</Label>
              <div className="space-y-2">
                {SECURITY_MEASURES.map((measure) => (
                  <div key={measure} className="flex items-center space-x-2">
                    <Checkbox
                      checked={formData.securityMeasures.includes(measure)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData(prev => ({
                            ...prev,
                            securityMeasures: [...prev.securityMeasures, measure],
                          }))
                        } else {
                          setFormData(prev => ({
                            ...prev,
                            securityMeasures: prev.securityMeasures.filter(m => m !== measure),
                          }))
                        }
                      }}
                    />
                    <label className="text-sm">{measure}</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                checked={formData.dpiaRequired}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, dpiaRequired: checked as boolean }))}
              />
              <label>Data Protection Impact Assessment (DPIA) Required</label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingActivity ? 'Update' : 'Create'} Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}