'use client'

import { useEffect, useState } from 'react'

export default function DiagnosticPage() {
  const [diagnostics, setDiagnostics] = useState<any>({
    loading: true,
    clientSide: {},
    errors: []
  })

  useEffect(() => {
    const runDiagnostics = async () => {
      const results: any = {
        loading: false,
        clientSide: {
          hasWindow: typeof window !== 'undefined',
          hasLocalStorage: typeof localStorage !== 'undefined',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
          currentUrl: typeof window !== 'undefined' ? window.location.href : 'N/A',
        },
        envVars: {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set' : 'Missing',
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ? 'Set' : 'Missing',
        },
        errors: []
      }

      // Test API health endpoint
      try {
        const response = await fetch('/api/health')
        const data = await response.json()
        results.apiHealth = {
          status: response.status,
          data: data
        }
      } catch (error: any) {
        results.errors.push({
          test: 'API Health',
          error: error.message
        })
      }

      // Test Supabase connection (only if env vars are set)
      if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        try {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          const { data, error } = await supabase.auth.getSession()
          results.supabase = {
            connected: !error,
            hasSession: !!data?.session,
            error: error?.message
          }
        } catch (error: any) {
          results.errors.push({
            test: 'Supabase Connection',
            error: error.message
          })
        }
      } else {
        results.supabase = {
          connected: false,
          error: 'Missing environment variables'
        }
      }

      setDiagnostics(results)
    }

    runDiagnostics()
  }, [])

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">ColdCopy Diagnostic Page</h1>
      
      {diagnostics.loading ? (
        <p>Running diagnostics...</p>
      ) : (
        <div className="space-y-6">
          <section className="bg-gray-100 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Client-Side Environment</h2>
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(diagnostics.clientSide, null, 2)}
            </pre>
          </section>

          <section className="bg-gray-100 p-4 rounded-lg">
            <h2 className="text-xl font-semibold mb-3">Environment Variables</h2>
            <pre className="text-sm overflow-x-auto">
              {JSON.stringify(diagnostics.envVars, null, 2)}
            </pre>
          </section>

          {diagnostics.apiHealth && (
            <section className="bg-gray-100 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-3">API Health Check</h2>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(diagnostics.apiHealth, null, 2)}
              </pre>
            </section>
          )}

          {diagnostics.supabase && (
            <section className="bg-gray-100 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-3">Supabase Connection</h2>
              <pre className="text-sm overflow-x-auto">
                {JSON.stringify(diagnostics.supabase, null, 2)}
              </pre>
            </section>
          )}

          {diagnostics.errors.length > 0 && (
            <section className="bg-red-100 p-4 rounded-lg">
              <h2 className="text-xl font-semibold mb-3 text-red-700">Errors</h2>
              <pre className="text-sm overflow-x-auto text-red-700">
                {JSON.stringify(diagnostics.errors, null, 2)}
              </pre>
            </section>
          )}
        </div>
      )}

      <div className="mt-6">
        <a href="/" className="text-blue-600 hover:underline">← Back to Home</a>
      </div>
    </div>
  )
}