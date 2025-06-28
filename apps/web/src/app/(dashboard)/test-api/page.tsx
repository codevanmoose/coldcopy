'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'

interface TestResult {
  endpoint: string
  status: 'pending' | 'testing' | 'success' | 'error'
  message?: string
  response?: any
}

export default function TestApiPage() {
  const { workspace } = useAuthStore()
  const [testResults, setTestResults] = useState<TestResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const testEndpoints = [
    {
      name: 'Health Check',
      endpoint: '/health',
      method: 'GET',
      requiresAuth: false,
    },
    {
      name: 'Auth Status',
      endpoint: '/api/auth/me',
      method: 'GET',
      requiresAuth: true,
    },
    {
      name: 'Workspaces List',
      endpoint: '/api/workspaces',
      method: 'GET',
      requiresAuth: true,
    },
    {
      name: 'Current Workspace',
      endpoint: `/api/workspaces/${workspace?.id || 'current'}`,
      method: 'GET',
      requiresAuth: true,
    },
  ]

  const runTests = async () => {
    setIsRunning(true)
    const results: TestResult[] = testEndpoints.map(test => ({
      endpoint: test.name,
      status: 'pending',
    }))
    setTestResults(results)

    for (let i = 0; i < testEndpoints.length; i++) {
      const test = testEndpoints[i]
      
      // Update status to testing
      results[i] = { ...results[i], status: 'testing' }
      setTestResults([...results])

      try {
        const response = await apiClient.get(test.endpoint)
        
        if (response.error) {
          results[i] = {
            ...results[i],
            status: 'error',
            message: response.error,
            response: response,
          }
        } else {
          results[i] = {
            ...results[i],
            status: 'success',
            message: `Status: ${response.status}`,
            response: response.data,
          }
        }
      } catch (error) {
        results[i] = {
          ...results[i],
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }
      }

      setTestResults([...results])
      
      // Add a small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setIsRunning(false)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <div className="h-4 w-4 rounded-full bg-gray-300" />
      case 'testing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">API Connection Test</h1>
        <p className="text-muted-foreground">
          Test the connection between the frontend and backend API
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Connection Information</CardTitle>
          <CardDescription>
            Current configuration and environment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">API URL:</span>
              <br />
              <span className="text-muted-foreground">
                {process.env.NEXT_PUBLIC_API_URL || 'https://api.coldcopy.cc'}
              </span>
            </div>
            <div>
              <span className="font-medium">Frontend URL:</span>
              <br />
              <span className="text-muted-foreground">
                {window.location.origin}
              </span>
            </div>
            <div>
              <span className="font-medium">Workspace ID:</span>
              <br />
              <span className="text-muted-foreground">
                {workspace?.id || 'Not available'}
              </span>
            </div>
            <div>
              <span className="font-medium">Auth Status:</span>
              <br />
              <span className="text-muted-foreground">
                {workspace ? 'Authenticated' : 'Not authenticated'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API Endpoint Tests</CardTitle>
          <CardDescription>
            Test various API endpoints to ensure connectivity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={runTests} 
            disabled={isRunning}
            className="w-full"
          >
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Tests...
              </>
            ) : (
              'Run All Tests'
            )}
          </Button>

          {testResults.length > 0 && (
            <div className="space-y-3">
              {testResults.map((result, index) => (
                <div 
                  key={index}
                  className="flex items-start space-x-3 p-3 rounded-lg border bg-card"
                >
                  <div className="mt-0.5">
                    {getStatusIcon(result.status)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">{result.endpoint}</p>
                    {result.message && (
                      <p className="text-sm text-muted-foreground">
                        {result.message}
                      </p>
                    )}
                    {result.response && result.status === 'success' && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                          View Response
                        </summary>
                        <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto">
                          {JSON.stringify(result.response, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertDescription>
          This page tests the connection between your frontend application and the backend API. 
          If any tests fail, check the browser console for more details and ensure CORS is properly configured.
        </AlertDescription>
      </Alert>
    </div>
  )
}