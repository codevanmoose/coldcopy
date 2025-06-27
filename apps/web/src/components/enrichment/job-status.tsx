'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Loader2, 
  RefreshCw, 
  Pause, 
  Play,
  Trash2,
  AlertCircle,
  Activity,
  BarChart3,
  Calendar,
  Timer,
  Zap
} from 'lucide-react'
import { toast } from 'sonner'

// ====================================
// Types
// ====================================

interface Job {
  id: string
  type: string
  status: 'pending' | 'queued' | 'in_progress' | 'completed' | 'failed' | 'retrying' | 'dead_letter'
  priority: number
  payload: any
  result?: any
  error?: {
    message: string
    code: string
  }
  retryCount: number
  maxRetries: number
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  tags?: string[]
  processingTime?: number
}

interface JobMetrics {
  totalJobs: number
  pendingJobs: number
  runningJobs: number
  completedJobs: number
  failedJobs: number
  deadLetterJobs: number
  averageProcessingTime: number
  successRate: number
  throughput: number
  errorRate: number
  queueDepth: number
}

interface JobStatusProps {
  workspaceId: string
  onJobUpdate?: (job: Job) => void
}

// ====================================
// Status Badge Component
// ====================================

function JobStatusBadge({ status }: { status: Job['status'] }) {
  const config = {
    pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800', icon: Clock },
    queued: { label: 'Queued', color: 'bg-blue-100 text-blue-800', icon: Clock },
    in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: Loader2 },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: XCircle },
    retrying: { label: 'Retrying', color: 'bg-orange-100 text-orange-800', icon: RefreshCw },
    dead_letter: { label: 'Dead Letter', color: 'bg-gray-100 text-gray-800', icon: AlertCircle }
  }

  const { label, color, icon: Icon } = config[status]

  return (
    <Badge variant="secondary" className={color}>
      <Icon className="w-3 h-3 mr-1" />
      {label}
    </Badge>
  )
}

// ====================================
// Job Type Badge Component
// ====================================

function JobTypeBadge({ type }: { type: string }) {
  const config = {
    single_lead_enrichment: { label: 'Single Lead', color: 'bg-blue-100 text-blue-800' },
    batch_lead_enrichment: { label: 'Batch Leads', color: 'bg-purple-100 text-purple-800' },
    email_validation: { label: 'Email Validation', color: 'bg-green-100 text-green-800' },
    company_data_update: { label: 'Company Data', color: 'bg-orange-100 text-orange-800' },
    social_profile_discovery: { label: 'Social Profiles', color: 'bg-pink-100 text-pink-800' }
  }

  const { label, color } = config[type as keyof typeof config] || { label: type, color: 'bg-gray-100 text-gray-800' }

  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  )
}

// ====================================
// Priority Badge Component
// ====================================

function PriorityBadge({ priority }: { priority: number }) {
  const config = {
    1: { label: 'Critical', color: 'bg-red-100 text-red-800' },
    2: { label: 'High', color: 'bg-orange-100 text-orange-800' },
    3: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    4: { label: 'Low', color: 'bg-green-100 text-green-800' },
    5: { label: 'Lowest', color: 'bg-gray-100 text-gray-800' }
  }

  const { label, color } = config[priority as keyof typeof config] || { label: `P${priority}`, color: 'bg-gray-100 text-gray-800' }

  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  )
}

// ====================================
// Job Actions Component
// ====================================

function JobActions({ job, onUpdate }: { job: Job; onUpdate: () => void }) {
  const [isLoading, setIsLoading] = useState(false)

  const canCancel = ['pending', 'queued', 'retrying'].includes(job.status)
  const canRetry = ['failed', 'dead_letter'].includes(job.status)

  const handleCancel = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/enrichment/jobs/${job.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to cancel job')
      }

      toast.success('Job cancelled successfully')
      onUpdate()
    } catch (error) {
      toast.error('Failed to cancel job')
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/enrichment/jobs/${job.id}/retry`, {
        method: 'POST'
      })

      if (!response.ok) {
        throw new Error('Failed to retry job')
      }

      toast.success('Job queued for retry')
      onUpdate()
    } catch (error) {
      toast.error('Failed to retry job')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex gap-2">
      {canCancel && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isLoading}
        >
          <Trash2 className="w-4 h-4 mr-1" />
          Cancel
        </Button>
      )}
      {canRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetry}
          disabled={isLoading}
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Retry
        </Button>
      )}
    </div>
  )
}

// ====================================
// Job Details Component
// ====================================

function JobDetails({ job }: { job: Job }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-medium mb-2">Job Information</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">ID:</span> {job.id}
            </div>
            <div>
              <span className="text-gray-500">Type:</span> <JobTypeBadge type={job.type} />
            </div>
            <div>
              <span className="text-gray-500">Priority:</span> <PriorityBadge priority={job.priority} />
            </div>
            <div>
              <span className="text-gray-500">Status:</span> <JobStatusBadge status={job.status} />
            </div>
            <div>
              <span className="text-gray-500">Retries:</span> {job.retryCount} / {job.maxRetries}
            </div>
          </div>
        </div>

        <div>
          <h4 className="font-medium mb-2">Timing</h4>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Created:</span> {formatDate(job.createdAt)}
            </div>
            <div>
              <span className="text-gray-500">Updated:</span> {formatDate(job.updatedAt)}
            </div>
            {job.startedAt && (
              <div>
                <span className="text-gray-500">Started:</span> {formatDate(job.startedAt)}
              </div>
            )}
            {job.completedAt && (
              <div>
                <span className="text-gray-500">Completed:</span> {formatDate(job.completedAt)}
              </div>
            )}
            {job.processingTime && (
              <div>
                <span className="text-gray-500">Duration:</span> {formatDuration(job.processingTime)}
              </div>
            )}
          </div>
        </div>
      </div>

      {job.tags && job.tags.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Tags</h4>
          <div className="flex flex-wrap gap-1">
            {job.tags.map((tag, index) => (
              <Badge key={index} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="font-medium mb-2">Payload</h4>
        <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
          {JSON.stringify(job.payload, null, 2)}
        </pre>
      </div>

      {job.result && (
        <div>
          <h4 className="font-medium mb-2">Result</h4>
          <pre className="bg-gray-50 p-3 rounded text-xs overflow-x-auto">
            {JSON.stringify(job.result, null, 2)}
          </pre>
        </div>
      )}

      {job.error && (
        <div>
          <h4 className="font-medium mb-2">Error</h4>
          <div className="bg-red-50 p-3 rounded text-sm">
            <div className="font-medium text-red-800">{job.error.code}</div>
            <div className="text-red-700">{job.error.message}</div>
          </div>
        </div>
      )}
    </div>
  )
}

// ====================================
// Metrics Dashboard Component
// ====================================

function MetricsDashboard({ metrics }: { metrics: JobMetrics }) {
  const successRate = Math.round(metrics.successRate * 100)
  const errorRate = Math.round(metrics.errorRate * 100)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalJobs}</div>
          <p className="text-xs text-muted-foreground">
            +{metrics.pendingJobs} pending
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{successRate}%</div>
          <Progress value={successRate} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Queue Depth</CardTitle>
          <Timer className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.queueDepth}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.runningJobs} running
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Throughput</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.throughput}</div>
          <p className="text-xs text-muted-foreground">
            jobs/hour
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ====================================
// Main Job Status Component
// ====================================

export default function JobStatus({ workspaceId, onJobUpdate }: JobStatusProps) {
  const [jobs, setJobs] = useState<Job[]>([])
  const [metrics, setMetrics] = useState<JobMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const supabase = createClient()

  // Fetch jobs
  const fetchJobs = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (typeFilter !== 'all') params.append('type', typeFilter)
      params.append('limit', '100')

      const response = await fetch(`/api/enrichment/jobs?${params}`)
      if (!response.ok) throw new Error('Failed to fetch jobs')

      const data = await response.json()
      setJobs(data.jobs)
    } catch (error) {
      toast.error('Failed to fetch jobs')
    }
  }

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/enrichment/jobs/metrics')
      if (!response.ok) throw new Error('Failed to fetch metrics')

      const data = await response.json()
      setMetrics(data.metrics)
    } catch (error) {
      toast.error('Failed to fetch metrics')
    }
  }

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchJobs(), fetchMetrics()])
      setIsLoading(false)
    }
    loadData()
  }, [statusFilter, typeFilter])

  // Set up real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('enrichment_updates')
      .on('broadcast', { event: 'job_update' }, (payload) => {
        if (payload.payload.workspaceId === workspaceId) {
          fetchJobs()
          fetchMetrics()
          
          if (onJobUpdate) {
            onJobUpdate(payload.payload.data)
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, onJobUpdate])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchJobs()
      fetchMetrics()
    }, 30000)

    return () => clearInterval(interval)
  }, [statusFilter, typeFilter])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Metrics Dashboard */}
      {metrics && <MetricsDashboard metrics={metrics} />}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="queued">Queued</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="retrying">Retrying</option>
          <option value="dead_letter">Dead Letter</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 border rounded-md"
        >
          <option value="all">All Types</option>
          <option value="single_lead_enrichment">Single Lead</option>
          <option value="batch_lead_enrichment">Batch Leads</option>
          <option value="email_validation">Email Validation</option>
          <option value="company_data_update">Company Data</option>
          <option value="social_profile_discovery">Social Profiles</option>
        </select>

        <Button
          variant="outline"
          onClick={() => {
            fetchJobs()
            fetchMetrics()
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Enrichment Jobs</CardTitle>
          <CardDescription>
            Monitor and manage your enrichment jobs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No jobs found
              </div>
            ) : (
              jobs.map((job) => (
                <div
                  key={job.id}
                  className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <JobStatusBadge status={job.status} />
                      <JobTypeBadge type={job.type} />
                      <PriorityBadge priority={job.priority} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </span>
                      <JobActions job={job} onUpdate={fetchJobs} />
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    ID: {job.id}
                  </div>
                  {job.error && (
                    <div className="mt-2 text-sm text-red-600">
                      Error: {job.error.message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Job Details</h2>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedJob(null)}
                >
                  ×
                </Button>
              </div>
              <JobDetails job={selectedJob} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}