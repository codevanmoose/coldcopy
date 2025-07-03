'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'
import { 
  FileText, 
  Code, 
  Terminal, 
  Bug, 
  CheckCircle, 
  AlertCircle,
  BookOpen,
  Zap,
  Copy,
  ExternalLink,
  ArrowLeft
} from 'lucide-react'

export default function APIDocumentationPage() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8">
        <Link href="/test-api">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to API Testing
          </Button>
        </Link>
        
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <FileText className="h-8 w-8 text-primary" />
          API Testing Documentation
        </h1>
        <p className="text-muted-foreground">
          Complete guide to testing and debugging ColdCopy's API
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="client">API Client</TabsTrigger>
          <TabsTrigger value="debugging">Debugging</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What is API Testing?</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <p>
                The API Testing Dashboard allows you to verify that all ColdCopy services are functioning correctly. 
                It provides tools to test connectivity, validate configurations, and debug issues.
              </p>
              
              <h3 className="text-lg font-semibold mt-4">Key Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Visual Testing Interface</p>
                    <p className="text-sm text-muted-foreground">
                      Test endpoints with a single click and see real-time results
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Comprehensive Logging</p>
                    <p className="text-sm text-muted-foreground">
                      All API requests are logged with timing and response data
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Integration Testing</p>
                    <p className="text-sm text-muted-foreground">
                      Test connections to AI providers, email services, and more
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Debug Tools</p>
                    <p className="text-sm text-muted-foreground">
                      Built-in debugging features for troubleshooting issues
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>Get started with API testing in 3 steps</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                    1
                  </div>
                  <div>
                    <p className="font-medium">Navigate to Test API</p>
                    <p className="text-sm text-muted-foreground">
                      Click "Test API" in the sidebar or go to <code className="text-xs bg-muted px-1 py-0.5 rounded">/test-api</code>
                    </p>
                  </div>
                </li>
                
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                    2
                  </div>
                  <div>
                    <p className="font-medium">Run Tests</p>
                    <p className="text-sm text-muted-foreground">
                      Click "Test All Endpoints" or test individual endpoints
                    </p>
                  </div>
                </li>
                
                <li className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white font-semibold">
                    3
                  </div>
                  <div>
                    <p className="font-medium">Review Results</p>
                    <p className="text-sm text-muted-foreground">
                      Check status indicators and expand results for details
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Endpoints Tab */}
        <TabsContent value="endpoints" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Core Test Endpoints</CardTitle>
              <CardDescription>Essential endpoints for testing platform functionality</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  name: 'Health Check',
                  endpoint: '/api/health',
                  method: 'GET',
                  description: 'Basic connectivity test',
                  example: 'curl https://coldcopy.cc/api/health'
                },
                {
                  name: 'Auth Status',
                  endpoint: '/api/auth/me',
                  method: 'GET',
                  description: 'Verify authentication and get user info',
                  example: 'curl -H "Authorization: Bearer TOKEN" https://coldcopy.cc/api/auth/me'
                },
                {
                  name: 'AI Config Test',
                  endpoint: '/api/test-ai-config',
                  method: 'GET',
                  description: 'Check OpenAI and Anthropic configuration',
                  example: 'curl https://coldcopy.cc/api/test-ai-config'
                },
                {
                  name: 'Redis Test',
                  endpoint: '/api/test-redis',
                  method: 'GET',
                  description: 'Test Redis connectivity and operations',
                  example: 'curl https://coldcopy.cc/api/test-redis'
                }
              ].map((endpoint, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{endpoint.name}</h4>
                    <Badge variant="outline">{endpoint.method}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{endpoint.description}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1">
                      {endpoint.endpoint}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(endpoint.example)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Integration Test Endpoints</CardTitle>
              <CardDescription>Test external service integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertTitle>Pro Tip</AlertTitle>
                <AlertDescription>
                  Use these endpoints to verify that external services are properly configured before running campaigns.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Email Service</h4>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    POST /api/email/test
                  </code>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">AI Generation</h4>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    POST /api/test-ai-generation
                  </code>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Stripe Config</h4>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    GET /api/test-stripe-config
                  </code>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">Supabase Config</h4>
                  <code className="text-xs bg-muted px-2 py-1 rounded block">
                    GET /api/test-supabase-config
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Client Tab */}
        <TabsContent value="client" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Using the API Client</CardTitle>
              <CardDescription>Built-in JavaScript client for easy API access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Import the Client</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                    <code>{`import { api } from '@/lib/api-client'`}</code>
                  </pre>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Authentication</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                    <code>{`// Login
const user = await api.auth.login(email, password)

// Get current user
const me = await api.auth.me()

// Logout
await api.auth.logout()`}</code>
                  </pre>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Working with Campaigns</h4>
                  <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                    <code>{`// List campaigns
const campaigns = await api.campaigns.list(workspaceId)

// Create campaign
const campaign = await api.campaigns.create(workspaceId, {
  name: 'Q1 Outreach',
  subject: 'Introduction',
  body: 'Hello {{firstName}}...'
})

// Start campaign
await api.campaigns.start(workspaceId, campaignId)`}</code>
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debugging Tab */}
        <TabsContent value="debugging" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Common Issues & Solutions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <h4 className="font-medium">CORS Errors</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    "Access-Control-Allow-Origin" errors in browser console
                  </p>
                  <Alert>
                    <AlertTitle>Solution</AlertTitle>
                    <AlertDescription>
                      Ensure your API URL is correctly configured and the backend allows your frontend origin.
                    </AlertDescription>
                  </Alert>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <h4 className="font-medium">401 Unauthorized</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Authentication token is missing or expired
                  </p>
                  <Alert>
                    <AlertTitle>Solution</AlertTitle>
                    <AlertDescription>
                      Check if you're logged in. Try refreshing your session or logging in again.
                    </AlertDescription>
                  </Alert>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <h4 className="font-medium">Network Timeouts</h4>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Requests taking too long or timing out
                  </p>
                  <Alert>
                    <AlertTitle>Solution</AlertTitle>
                    <AlertDescription>
                      Check your internet connection and verify the API server is running. Consider implementing request timeouts.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Debug Mode</CardTitle>
              <CardDescription>Enable verbose logging for troubleshooting</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm">
                  Enable debug mode in your browser console to see detailed API logs:
                </p>
                <pre className="bg-muted p-3 rounded text-sm">
                  <code>{`// Enable debug mode
localStorage.setItem('DEBUG_API', 'true')

// Disable debug mode
localStorage.removeItem('DEBUG_API')`}</code>
                </pre>
                <Alert>
                  <AlertTitle>What Debug Mode Shows</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>All API request URLs and methods</li>
                      <li>Request/response timing</li>
                      <li>Response status codes</li>
                      <li>Detailed error messages</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Examples Tab */}
        <TabsContent value="examples" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Code Examples</CardTitle>
              <CardDescription>Common API usage patterns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Error Handling</h4>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  <code>{`try {
  const lead = await api.leads.create(workspaceId, {
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe'
  })
  console.log('Lead created:', lead)
} catch (error) {
  if (error.status === 400) {
    console.error('Validation error:', error.message)
  } else if (error.status === 401) {
    console.error('Not authenticated')
  } else {
    console.error('Unexpected error:', error)
  }
}`}</code>
                </pre>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Batch Operations</h4>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  <code>{`// Import multiple leads
const leads = [
  { email: 'lead1@example.com', name: 'Lead 1' },
  { email: 'lead2@example.com', name: 'Lead 2' },
  // ... more leads
]

const results = await Promise.all(
  leads.map(lead => 
    api.leads.create(workspaceId, lead)
      .catch(err => ({ error: err, lead }))
  )
)

// Check results
results.forEach(result => {
  if (result.error) {
    console.error('Failed to create lead:', result.lead.email)
  }
})`}</code>
                </pre>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">Pagination</h4>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
                  <code>{`// Fetch all leads with pagination
async function getAllLeads(workspaceId) {
  const allLeads = []
  let page = 1
  let hasMore = true
  
  while (hasMore) {
    const response = await api.leads.list(workspaceId, {
      page,
      perPage: 100
    })
    
    allLeads.push(...response.data)
    hasMore = page < response.totalPages
    page++
  }
  
  return allLeads
}`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Testing Checklist</CardTitle>
              <CardDescription>Ensure everything is working correctly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  'Environment variables are configured',
                  'Authentication is working',
                  'API endpoints are accessible',
                  'CORS is properly configured',
                  'External services are connected',
                  'Error handling is implemented',
                  'Rate limits are respected',
                  'Debug logging is available'
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="h-4 w-4 border rounded" />
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Actions */}
      <div className="mt-8 flex items-center justify-between">
        <Link href="/test-api">
          <Button variant="outline">
            <Terminal className="h-4 w-4 mr-2" />
            Go to API Testing
          </Button>
        </Link>
        
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a
              href="https://github.com/codevanmoose/coldcopy/wiki/API-Documentation"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Full Documentation
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/help">
              <BookOpen className="h-4 w-4 mr-2" />
              Help Center
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}