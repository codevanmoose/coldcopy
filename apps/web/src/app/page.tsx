// Enable ISR with 60 second revalidation
export const revalidate = 60

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4">ColdCopy</h1>
        <p className="text-xl text-gray-600 mb-8">AI-Powered Cold Outreach Platform</p>
        <div className="flex gap-4 justify-center">
          <a 
            href="/login" 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Get Started
          </a>
          <a 
            href="/dashboard" 
            className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition"
          >
            Dashboard
          </a>
        </div>
        <div className="mt-12 text-sm text-gray-500">
          <p>🚀 Your platform is live!</p>
          <p className="mt-2">Environment Status:</p>
          <p className="mt-1 text-xs">
            Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Configured' : '❌ Missing'}
          </p>
          <p className="text-xs">
            Supabase Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing'}
          </p>
        </div>
      </div>
    </main>
  )
}