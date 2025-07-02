'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { CheckCircle2, XCircle, RefreshCw, AlertCircle, Database } from 'lucide-react'

export default function RedisStatusPage() {
  const [status, setStatus] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkRedisStatus = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Check connection
      const statusRes = await fetch('/api/test-redis')
      const statusData = await statusRes.json()
      setStatus(statusData)

      // Get stats if connected
      if (statusData.status === 'connected') {
        const statsRes = await fetch('/api/redis-stats')
        const statsData = await statsRes.json()
        setStats(statsData)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    checkRedisStatus()
  }, [])

  const getStatusIcon = () => {
    if (loading) return <RefreshCw className="h-5 w-5 animate-spin" />
    if (status?.status === 'connected') return <CheckCircle2 className="h-5 w-5 text-green-500" />
    if (status?.status === 'not_configured') return <AlertCircle className="h-5 w-5 text-yellow-500" />
    return <XCircle className="h-5 w-5 text-red-500" />
  }

  const getStatusBadge = () => {
    if (loading) return <Badge variant="secondary">Checking...</Badge>
    if (status?.status === 'connected') return <Badge variant="default" className="bg-green-500">Connected</Badge>
    if (status?.status === 'not_configured') return <Badge variant="secondary">Not Configured</Badge>
    return <Badge variant="destructive">Error</Badge>
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Redis Cache Status</h1>
        <p className="text-gray-600">Monitor your Upstash Redis connection and performance</p>
      </div>

      {/* Connection Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Connection Status</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              {getStatusBadge()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {status?.status === 'not_configured' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Redis Not Configured</AlertTitle>
              <AlertDescription>
                <p className="mb-2">To enable Redis caching:</p>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Create an account at <a href="https://upstash.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">upstash.com</a></li>
                  <li>Create a Redis database</li>
                  <li>Add environment variables to Vercel:
                    <ul className="list-disc ml-5 mt-1">
                      {status.requiredVars?.map((v: string) => (
                        <li key={v} className="font-mono text-sm">{v}</li>
                      ))}
                    </ul>
                  </li>
                  <li>Redeploy your application</li>
                </ol>
              </AlertDescription>
            </Alert>
          )}

          {status?.status === 'connected' && status.test && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Connection Test</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Write Test:</span>
                    <span className="ml-2 font-mono">{status.test.match ? '✅ Passed' : '❌ Failed'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Keys:</span>
                    <span className="ml-2 font-semibold">{status.stats.totalKeys}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {status?.status === 'connection_error' && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Connection Error</AlertTitle>
              <AlertDescription>
                <p>{status.message}</p>
                <p className="text-sm mt-1">{status.hint}</p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Stats Card */}
      {stats && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cache Statistics</CardTitle>
            <CardDescription>Current usage and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Usage */}
              <div>
                <h3 className="font-semibold mb-3">Usage</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily Commands:</span>
                    <span className="font-mono">{stats.usage?.estimatedDailyCommands?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Free Commands Left:</span>
                    <span className="font-mono">{stats.costs?.freeCommandsRemaining?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* Costs */}
              <div>
                <h3 className="font-semibold mb-3">Estimated Costs</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Daily:</span>
                    <span className="font-mono">{stats.costs?.estimatedDaily}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Monthly:</span>
                    <span className="font-mono">{stats.costs?.estimatedMonthly}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cache Patterns */}
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Cache Patterns</h3>
              <div className="space-y-2">
                {stats.cachePatterns?.map((pattern: any) => (
                  <div key={pattern.pattern} className="flex justify-between text-sm">
                    <span className="font-mono text-gray-600">{pattern.pattern}</span>
                    <span>{pattern.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {stats.recommendations && stats.recommendations.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Recommendations</h3>
                <ul className="list-disc ml-5 space-y-1 text-sm text-gray-600">
                  {stats.recommendations.map((rec: string, idx: number) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={checkRedisStatus} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
        <Button variant="outline" asChild>
          <a href="/UPSTASH_REDIS_SETUP.md" target="_blank">
            View Setup Guide
          </a>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}