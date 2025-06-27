'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, AlertCircle, CheckCircle, Clock, Play, Eye, Webhook } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

interface SyncJob {
  id: string
  object_type: string
  direction: string
  status: 'syncing' | 'completed' | 'failed'
  records_processed: number
  records_success: number
  records_failed: number
  error_message?: string
  created_at: string
  completed_at?: string
}

interface SyncError {
  id: string
  object_type: string
  coldcopy_id: string
  pipedrive_id?: string
  error_message: string
  retry_count: number
  next_retry_at?: string
  created_at: string
}

interface SyncConfig {
  object_type: string
  direction: string
  is_enabled: boolean
  last_sync_at?: string
  auto_sync_enabled: boolean
  sync_frequency?: number
}

interface WebhookStatus {
  is_active: boolean
  last_received_at?: string
  total_received: number
  failed_count: number
}

interface SyncStats {
  persons: { total: number; synced: number; failed: number }
  deals: { total: number; synced: number; failed: number }
  activities: { total: number; synced: number; failed: number }
}

export default function PipedriveSyncPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([])
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([])
  const [syncConfigs, setSyncConfigs] = useState<SyncConfig[]>([])
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null)
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null)
  const [selectedJob, setSelectedJob] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<string | null>(null)

  useEffect(() => {
    if (user?.workspace_id) {
      loadSyncData()
    }
  }, [user?.workspace_id])

  const loadSyncData = async () => {
    if (!user?.workspace_id) return

    setLoading(true)
    const supabase = createClient()

    try {
      // Load sync jobs
      const { data: jobs } = await supabase
        .from('pipedrive_sync_jobs')
        .select('*')
        .eq('workspace_id', user.workspace_id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (jobs) setSyncJobs(jobs)

      // Load sync errors
      const { data: errors } = await supabase
        .from('pipedrive_sync_errors')
        .select('*')
        .eq('workspace_id', user.workspace_id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (errors) setSyncErrors(errors)

      // Load sync configs
      const { data: configs } = await supabase
        .from('pipedrive_sync_configs')
        .select('*')
        .eq('workspace_id', user.workspace_id)

      if (configs) setSyncConfigs(configs)

      // Load webhook status
      const { data: webhook } = await supabase
        .from('pipedrive_webhook_status')
        .select('*')
        .eq('workspace_id', user.workspace_id)
        .single()

      if (webhook) setWebhookStatus(webhook)

      // Load sync statistics
      await loadSyncStats()

    } catch (error) {
      console.error('Failed to load sync data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load sync data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadSyncStats = async () => {
    if (!user?.workspace_id) return

    try {
      const response = await fetch('/api/integrations/pipedrive/stats', {
        headers: {
          'workspace-id': user.workspace_id,
        },
      })

      if (response.ok) {
        const stats = await response.json()
        setSyncStats(stats)
      }
    } catch (error) {
      console.error('Failed to load sync stats:', error)
    }
  }

  const triggerSync = async (objectType: string, direction?: string) => {
    if (!user?.workspace_id) return

    setTriggering(objectType)
    
    try {
      const response = await fetch('/api/integrations/pipedrive/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: user.workspace_id,
          object_type: objectType,
          direction,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Sync failed')
      }

      toast({
        title: 'Sync completed',
        description: `${result.synced} records synced, ${result.failed} failed`,
      })

      // Reload data
      await loadSyncData()

    } catch (error) {
      console.error('Sync failed:', error)
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setTriggering(null)
    }
  }

  const retryFailedSync = async (errorId: string) => {
    if (!user?.workspace_id) return

    try {
      const error = syncErrors.find(e => e.id === errorId)
      if (!error) return

      await triggerSync(error.object_type)
      
      // Remove the error from the list
      setSyncErrors(prev => prev.filter(e => e.id !== errorId))

    } catch (error) {
      console.error('Retry failed:', error)
      toast({
        title: 'Retry failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'syncing': return 'bg-blue-500'
      case 'completed': return 'bg-green-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'syncing': return <Clock className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'failed': return <AlertCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getSyncConfigByType = (objectType: string) => {
    return syncConfigs.find(c => c.object_type === objectType)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded animate-pulse" />
        <div className="grid gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pipedrive Sync Status</h1>
          <p className="text-muted-foreground">
            Monitor and manage your Pipedrive synchronization
          </p>
        </div>
        <Button onClick={loadSyncData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Sync Overview Statistics */}
      {syncStats && (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Object.entries(syncStats).map(([objectType, stats]) => (
            <Card key={objectType}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize">
                  {objectType}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.synced}</div>
                <p className="text-xs text-muted-foreground">
                  of {stats.total} total
                </p>
                {stats.failed > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    {stats.failed} failed
                  </p>
                )}
                <Progress 
                  value={stats.total > 0 ? (stats.synced / stats.total) * 100 : 0}
                  className="h-2 mt-2"
                />
              </CardContent>
            </Card>
          ))}

          {/* Webhook Status Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Webhook className="h-4 w-4" />
                Webhook Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${webhookStatus?.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm font-medium">
                  {webhookStatus?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {webhookStatus?.last_received_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last: {formatDistanceToNow(new Date(webhookStatus.last_received_at))} ago
                </p>
              )}
              {webhookStatus && (
                <p className="text-xs text-muted-foreground">
                  {webhookStatus.total_received} received
                  {webhookStatus.failed_count > 0 && `, ${webhookStatus.failed_count} failed`}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {['persons', 'deals', 'activities'].map(objectType => {
          const config = getSyncConfigByType(objectType)
          const isTriggering = triggering === objectType
          
          return (
            <Card key={objectType}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium capitalize">
                    {objectType} Sync
                  </CardTitle>
                  <Badge 
                    variant={config?.is_enabled ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {config?.is_enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {config?.last_sync_at && (
                  <p className="text-xs text-muted-foreground">
                    Last sync: {formatDistanceToNow(new Date(config.last_sync_at))} ago
                  </p>
                )}
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => triggerSync(objectType, 'import')}
                    disabled={!config?.is_enabled || isTriggering}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    {isTriggering ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => triggerSync(objectType, 'export')}
                    disabled={!config?.is_enabled || isTriggering}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    {isTriggering ? (
                      <>
                        <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-2" />
                        Export
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Tabs defaultValue="jobs" className="w-full">
        <TabsList>
          <TabsTrigger value="jobs">Recent Jobs</TabsTrigger>
          <TabsTrigger value="errors">
            Errors {syncErrors.length > 0 && `(${syncErrors.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Jobs</CardTitle>
              <CardDescription>
                Recent synchronization jobs and their status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncJobs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No sync jobs found
                  </p>
                ) : (
                  syncJobs.map(job => (
                    <div key={job.id}>
                      <div
                        className="flex items-center justify-between p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                      >
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${getStatusColor(job.status)}`}>
                            {getStatusIcon(job.status)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium capitalize">
                                {job.object_type}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {job.direction}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {formatDistanceToNow(new Date(job.created_at))} ago
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">
                              {job.records_success || 0} / {job.records_processed || 0}
                            </span>
                            <Badge 
                              variant={job.status === 'completed' ? 'default' : 
                                     job.status === 'failed' ? 'destructive' : 'secondary'}
                            >
                              {job.status}
                            </Badge>
                          </div>
                          {job.status === 'completed' && job.records_processed > 0 && (
                            <Progress 
                              value={(job.records_success / job.records_processed) * 100}
                              className="w-20 h-2 mt-1"
                            />
                          )}
                        </div>
                      </div>

                      {selectedJob === job.id && (
                        <div className="ml-12 p-4 bg-muted rounded-lg space-y-2 mt-2">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Started:</span>
                              <p>{new Date(job.created_at).toLocaleString()}</p>
                            </div>
                            {job.completed_at && (
                              <div>
                                <span className="font-medium">Completed:</span>
                                <p>{new Date(job.completed_at).toLocaleString()}</p>
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Records Processed:</span>
                              <p>{job.records_processed || 0}</p>
                            </div>
                            <div>
                              <span className="font-medium">Success Rate:</span>
                              <p>
                                {job.records_processed > 0 
                                  ? `${Math.round((job.records_success / job.records_processed) * 100)}%`
                                  : 'N/A'
                                }
                              </p>
                            </div>
                          </div>
                          
                          {job.error_message && (
                            <div className="mt-3">
                              <span className="font-medium text-destructive">Error:</span>
                              <p className="text-sm text-muted-foreground mt-1">
                                {job.error_message}
                              </p>
                            </div>
                          )}

                          {job.status === 'failed' && (
                            <Button 
                              onClick={(e) => {
                                e.stopPropagation()
                                triggerSync(job.object_type, job.direction)
                              }}
                              size="sm" 
                              variant="outline"
                              className="mt-2"
                            >
                              <RefreshCw className="h-3 w-3 mr-2" />
                              Retry
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Errors</CardTitle>
              <CardDescription>
                Failed synchronization attempts that need attention
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncErrors.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No sync errors found
                  </p>
                ) : (
                  syncErrors.map(error => (
                    <div
                      key={error.id}
                      className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium capitalize">
                              {error.object_type}
                            </span>
                            {error.coldcopy_id && (
                              <Badge variant="outline" className="text-xs">
                                CC: {error.coldcopy_id.slice(0, 8)}...
                              </Badge>
                            )}
                            {error.pipedrive_id && (
                              <Badge variant="outline" className="text-xs">
                                PD: {error.pipedrive_id}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {error.error_message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(error.created_at))} ago
                            {error.retry_count > 0 && ` • ${error.retry_count} retries`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {error.next_retry_at && new Date(error.next_retry_at) > new Date() && (
                          <Badge variant="secondary" className="text-xs">
                            Next retry: {formatDistanceToNow(new Date(error.next_retry_at))}
                          </Badge>
                        )}
                        <Button
                          onClick={() => retryFailedSync(error.id)}
                          size="sm"
                          variant="outline"
                        >
                          <RefreshCw className="h-3 w-3 mr-2" />
                          Retry
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}