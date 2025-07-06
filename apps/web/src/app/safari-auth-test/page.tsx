'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getBrowserInfo, isSafari } from '@/lib/utils/browser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SafariAuthTestPage() {
  const [browserInfo, setBrowserInfo] = useState<any>(null)
  const [authStatus, setAuthStatus] = useState<any>({})
  const [cookies, setCookies] = useState<string[]>([])
  const [localStorage, setLocalStorage] = useState<any>({})
  const [logs, setLogs] = useState<string[]>([])
  
  const supabase = createClient()
  
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toISOString()}: ${message}`])
  }
  
  useEffect(() => {
    // Get browser info
    setBrowserInfo(getBrowserInfo())
    
    // Test auth status
    testAuthStatus()
    
    // Check storage
    checkStorage()
  }, [])
  
  const testAuthStatus = async () => {
    addLog('Starting auth status check...')
    
    try {
      // Test 1: Direct session check
      const { data: { session }, error } = await supabase.auth.getSession()
      addLog(`getSession result: ${session ? 'Session found' : 'No session'}, error: ${error?.message || 'none'}`)
      
      // Test 2: User check
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      addLog(`getUser result: ${user ? 'User found' : 'No user'}, error: ${userError?.message || 'none'}`)
      
      // Test 3: Auth state listener
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        addLog(`Auth state change: ${event}, session: ${session ? 'present' : 'null'}`)
      })
      
      setAuthStatus({
        session: session ? 'Found' : 'Not found',
        user: user ? user.email : 'Not found',
        sessionError: error?.message || 'None',
        userError: userError?.message || 'None'
      })
      
      // Cleanup
      setTimeout(() => subscription.unsubscribe(), 5000)
    } catch (e: any) {
      addLog(`Error during auth check: ${e.message}`)
    }
  }
  
  const checkStorage = () => {
    // Check cookies
    const allCookies = document.cookie.split(';').map(c => c.trim())
    const authCookies = allCookies.filter(c => 
      c.includes('sb-') || c.includes('supabase') || c.includes('auth')
    )
    setCookies(authCookies)
    
    // Check localStorage
    const storageData: any = {}
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && (key.includes('supabase') || key.includes('auth'))) {
        storageData[key] = window.localStorage.getItem(key)?.substring(0, 50) + '...'
      }
    }
    setLocalStorage(storageData)
  }
  
  const testLogin = async () => {
    addLog('Testing login...')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'jaspervanmoose@gmail.com',
        password: 'okkenbollen33'
      })
      
      if (error) {
        addLog(`Login error: ${error.message}`)
      } else {
        addLog('Login successful!')
        setTimeout(() => {
          testAuthStatus()
          checkStorage()
        }, 1000)
      }
    } catch (e: any) {
      addLog(`Login exception: ${e.message}`)
    }
  }
  
  const testLogout = async () => {
    addLog('Testing logout...')
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        addLog(`Logout error: ${error.message}`)
      } else {
        addLog('Logout successful!')
        setTimeout(() => {
          testAuthStatus()
          checkStorage()
        }, 1000)
      }
    } catch (e: any) {
      addLog(`Logout exception: ${e.message}`)
    }
  }
  
  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Safari Authentication Test</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Browser Information</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-sm">
            {JSON.stringify(browserInfo, null, 2)}
          </pre>
          <p className="mt-2 font-semibold">
            Is Safari: {isSafari() ? 'YES' : 'NO'}
          </p>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Authentication Status</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-sm">
            {JSON.stringify(authStatus, null, 2)}
          </pre>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Auth Cookies</CardTitle>
        </CardHeader>
        <CardContent>
          {cookies.length > 0 ? (
            <ul className="text-sm">
              {cookies.map((cookie, i) => (
                <li key={i} className="mb-1 font-mono bg-gray-100 p-2 rounded">
                  {cookie}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">No auth cookies found</p>
          )}
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Local Storage (Auth Keys)</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto">
            {JSON.stringify(localStorage, null, 2)}
          </pre>
        </CardContent>
      </Card>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-x-4">
            <Button onClick={testLogin}>Test Login</Button>
            <Button onClick={testLogout} variant="outline">Test Logout</Button>
            <Button onClick={() => { testAuthStatus(); checkStorage(); }} variant="outline">
              Refresh Status
            </Button>
            <Button onClick={() => window.location.href = '/login'} variant="outline">
              Go to Login Page
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Debug Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-xs max-h-96 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}