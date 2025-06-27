'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { gdprService } from '@/lib/gdpr/gdpr-service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { 
  Shield, 
  Users, 
  FileText, 
  Clock, 
  AlertCircle,
  Download,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Eye,
  Mail,
  Database,
  Lock
} from 'lucide-react'
import { 
  DataSubjectRequest, 
  DataSubjectRequestStatus,
  DataSubjectRequestType,
  GdprMetrics,
  DataRetentionPolicy,
  DeletionStrategy,
  ConsentType
} from '@/lib/gdpr/types'
import { formatDistanceToNow } from 'date-fns'

export default function GdprComplianceDashboard() {
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<GdprMetrics | null>(null)
  const [dataRequests, setDataRequests] = useState<DataSubjectRequest[]>([])
  const [retentionPolicies, setRetentionPolicies] = useState<DataRetentionPolicy[]>([])
  const [selectedRequest, setSelectedRequest] = useState<DataSubjectRequest | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<DataSubjectRequestStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<DataSubjectRequestType | 'all'>('all')
  const [workspaceId, setWorkspaceId] = useState<string>('')

  useEffect(() => {
    checkAdminAccess()
  }, [])

  async function checkAdminAccess() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      // Get user's profile and check admin access
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id, role')
        .eq('id', user.id)
        .single()

      if (!profile || profile.role !== 'admin') {
        toast({
          title: 'Access Denied',
          description: 'You need admin privileges to access this page.',
          variant: 'destructive',
        })
        router.push('/dashboard')
        return
      }

      setWorkspaceId(profile.workspace_id)
      await loadGdprData(profile.workspace_id)
    } catch (error) {
      console.error('Error checking access:', error)
      router.push('/dashboard')
    }
  }

  async function loadGdprData(workspaceId: string) {
    try {
      setLoading(true)

      // Load metrics
      const metricsData = await gdprService.getGdprMetrics(workspaceId)
      setMetrics(metricsData)

      // Load data subject requests
      const requests = await gdprService.getDataSubjectRequests(workspaceId)
      setDataRequests(requests)

      // Load retention policies
      const policies = await gdprService.getDataRetentionPolicies(workspaceId)
      setRetentionPolicies(policies)
    } catch (error) {
      console.error('Error loading GDPR data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load GDPR compliance data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleRequestAction(requestId: string, action: 'approve' | 'reject') {
    try {
      if (action === 'approve') {
        await gdprService.updateDataSubjectRequest({
          requestId,
          status: DataSubjectRequestStatus.IN_PROGRESS,
        })
        toast({
          title: 'Request Approved',
          description: 'The data subject request is being processed.',
        })
      } else {
        const reason = prompt('Please provide a reason for rejection:')
        if (!reason) return

        await gdprService.updateDataSubjectRequest({
          requestId,
          status: DataSubjectRequestStatus.REJECTED,
          rejectionReason: reason,
        })
        toast({
          title: 'Request Rejected',
          description: 'The data subject request has been rejected.',
        })
      }

      await loadGdprData(workspaceId)
    } catch (error) {
      console.error('Error updating request:', error)
      toast({
        title: 'Error',
        description: 'Failed to update request',
        variant: 'destructive',
      })
    }
  }

  async function executeRetentionPolicy(policyId: string) {
    try {
      await gdprService.executeRetentionPolicies(workspaceId)
      toast({
        title: 'Retention Policy Executed',
        description: 'Data retention policy has been executed successfully.',
      })
      await loadGdprData(workspaceId)
    } catch (error) {
      console.error('Error executing retention policy:', error)
      toast({
        title: 'Error',
        description: 'Failed to execute retention policy',
        variant: 'destructive',
      })
    }
  }

  async function generateComplianceReport(type: 'consent' | 'requests' | 'audit' | 'processing' | 'full') {
    try {
      const report = await gdprService.generateComplianceReport({
        workspaceId,
        reportType: type,
      })

      if (report.downloadUrl) {
        window.open(report.downloadUrl, '_blank')
      }

      toast({
        title: 'Report Generated',
        description: `${type} compliance report has been generated.`,
      })
    } catch (error) {
      console.error('Error generating report:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate compliance report',
        variant: 'destructive',
      })
    }
  }

  const getStatusBadge = (status: DataSubjectRequestStatus) => {
    const variants: Record<DataSubjectRequestStatus, { variant: any; icon: any }> = {
      [DataSubjectRequestStatus.PENDING]: { variant: 'secondary', icon: Clock },
      [DataSubjectRequestStatus.VERIFYING]: { variant: 'outline', icon: Shield },
      [DataSubjectRequestStatus.IN_PROGRESS]: { variant: 'default', icon: RefreshCw },
      [DataSubjectRequestStatus.COMPLETED]: { variant: 'success', icon: CheckCircle },
      [DataSubjectRequestStatus.REJECTED]: { variant: 'destructive', icon: XCircle },
      [DataSubjectRequestStatus.EXPIRED]: { variant: 'secondary', icon: AlertCircle },
    }

    const { variant, icon: Icon } = variants[status]
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace('_', ' ')}
      </Badge>
    )
  }

  const getRequestTypeBadge = (type: DataSubjectRequestType) => {
    const labels: Record<DataSubjectRequestType, string> = {
      [DataSubjectRequestType.ACCESS]: 'Access',
      [DataSubjectRequestType.RECTIFICATION]: 'Rectification',
      [DataSubjectRequestType.ERASURE]: 'Deletion',
      [DataSubjectRequestType.PORTABILITY]: 'Portability',
      [DataSubjectRequestType.RESTRICTION]: 'Restriction',
      [DataSubjectRequestType.OBJECTION]: 'Objection',
      [DataSubjectRequestType.AUTOMATED_DECISION]: 'Automated Decision',
    }

    return <Badge variant="outline">{labels[type]}</Badge>
  }

  const filteredRequests = dataRequests.filter(request => {
    const matchesSearch = request.requesterEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    const matchesType = typeFilter === 'all' || request.requestType === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">GDPR Compliance Dashboard</h1>
        <p className="text-muted-foreground">
          Manage data subject requests, monitor compliance, and configure retention policies
        </p>
      </div>

      {/* Metrics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Consents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeConsents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.consentRate || 0}% consent rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.dataSubjectRequests.pendingRequests || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg. {metrics?.dataSubjectRequests.averageCompletionTime || 0} hours
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suppression List</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.suppressionList.totalEntries || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Emails suppressed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Retention</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.dataRetention.recordsDeleted || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Records deleted this month
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="requests">Data Requests</TabsTrigger>
          <TabsTrigger value="retention">Retention Policies</TabsTrigger>
          <TabsTrigger value="consents">Consent Analytics</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Subject Requests</CardTitle>
              <CardDescription>
                Manage and process GDPR data subject requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by email or request ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value={DataSubjectRequestStatus.PENDING}>Pending</SelectItem>
                    <SelectItem value={DataSubjectRequestStatus.IN_PROGRESS}>In Progress</SelectItem>
                    <SelectItem value={DataSubjectRequestStatus.COMPLETED}>Completed</SelectItem>
                    <SelectItem value={DataSubjectRequestStatus.REJECTED}>Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(value: any) => setTypeFilter(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value={DataSubjectRequestType.ACCESS}>Access</SelectItem>
                    <SelectItem value={DataSubjectRequestType.ERASURE}>Deletion</SelectItem>
                    <SelectItem value={DataSubjectRequestType.PORTABILITY}>Portability</SelectItem>
                    <SelectItem value={DataSubjectRequestType.RECTIFICATION}>Rectification</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Requests Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell className="font-mono text-sm">
                        {request.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{getRequestTypeBadge(request.requestType)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.requesterEmail}</p>
                          {request.requesterName && (
                            <p className="text-sm text-muted-foreground">{request.requesterName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(request.deadline), { addSuffix: true })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedRequest(request)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {request.status === DataSubjectRequestStatus.PENDING && (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleRequestAction(request.id, 'approve')}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRequestAction(request.id, 'reject')}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Retention Policies</CardTitle>
              <CardDescription>
                Configure automatic data retention and deletion policies
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {retentionPolicies.map((policy) => (
                  <div
                    key={policy.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div>
                      <h4 className="font-semibold">{policy.dataType}</h4>
                      <p className="text-sm text-muted-foreground">{policy.description}</p>
                      <div className="flex gap-4 mt-2 text-sm">
                        <span>Retention: {policy.retentionDays} days</span>
                        <span>Strategy: {policy.deletionStrategy}</span>
                        {policy.lastExecutionAt && (
                          <span>
                            Last run: {formatDistanceToNow(new Date(policy.lastExecutionAt), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeRetentionPolicy(policy.id)}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Execute Now
                      </Button>
                      <Button size="sm" variant="outline">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Button className="mt-4">
                Add Retention Policy
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consent Analytics</CardTitle>
              <CardDescription>
                Monitor consent rates and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Consent Type Breakdown */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Consent Breakdown</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.values(ConsentType).map((type) => {
                      const total = metrics?.totalConsents || 1
                      const granted = Math.floor(Math.random() * total) // Replace with actual data
                      const percentage = Math.round((granted / total) * 100)

                      return (
                        <div key={type} className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>{type.replace(/_/g, ' ')}</span>
                            <span className="font-medium">{percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Consent Trends */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Recent Consent Activity</h3>
                  <div className="text-center py-8 text-muted-foreground">
                    Consent trend charts would be displayed here
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Reports</CardTitle>
              <CardDescription>
                Generate comprehensive GDPR compliance reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Consent Report</CardTitle>
                    <CardDescription>
                      Detailed breakdown of consent statuses and history
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      onClick={() => generateComplianceReport('consent')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Data Requests Report</CardTitle>
                    <CardDescription>
                      Summary of all data subject requests and responses
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      onClick={() => generateComplianceReport('requests')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Audit Log Report</CardTitle>
                    <CardDescription>
                      Comprehensive audit trail of all GDPR-related activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      onClick={() => generateComplianceReport('audit')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Full Compliance Report</CardTitle>
                    <CardDescription>
                      Complete GDPR compliance overview for audits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      className="w-full"
                      onClick={() => generateComplianceReport('full')}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Request Details Modal */}
      {selectedRequest && (
        <AlertDialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Data Subject Request Details</AlertDialogTitle>
              <AlertDialogDescription>
                Request ID: {selectedRequest.id}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <p className="text-sm">{getRequestTypeBadge(selectedRequest.requestType)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm">{getStatusBadge(selectedRequest.status)}</p>
                </div>
                <div>
                  <Label>Requester</Label>
                  <p className="text-sm">{selectedRequest.requesterEmail}</p>
                </div>
                <div>
                  <Label>Created</Label>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(selectedRequest.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <Label>Deadline</Label>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(selectedRequest.deadline), { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <Label>Verified</Label>
                  <p className="text-sm">{selectedRequest.verifiedAt ? 'Yes' : 'No'}</p>
                </div>
              </div>
              {selectedRequest.requestDetails && (
                <div>
                  <Label>Request Details</Label>
                  <pre className="text-sm bg-gray-50 p-2 rounded">
                    {JSON.stringify(selectedRequest.requestDetails, null, 2)}
                  </pre>
                </div>
              )}
              {selectedRequest.internalNotes && (
                <div>
                  <Label>Internal Notes</Label>
                  <p className="text-sm">{selectedRequest.internalNotes}</p>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}