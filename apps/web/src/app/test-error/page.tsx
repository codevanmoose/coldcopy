export default function TestErrorPage() {
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'Not set',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Set (hidden)' : 'Not set',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'Not set',
    NODE_ENV: process.env.NODE_ENV || 'Not set',
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Environment Variable Check</h1>
      
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Current Environment Variables:</h2>
        <pre className="text-sm overflow-x-auto">
          {JSON.stringify(envVars, null, 2)}
        </pre>
      </div>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-2">Diagnostic Information:</h2>
        <ul className="list-disc list-inside space-y-1">
          <li>Next.js Version: {require('next/package.json').version}</li>
          <li>React Version: {require('react/package.json').version}</li>
          <li>Build Time: {new Date().toISOString()}</li>
        </ul>
      </div>

      <div className="mt-6">
        <a href="/" className="text-blue-600 hover:underline">← Back to Home</a>
      </div>
    </div>
  )
}