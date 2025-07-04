import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

// Remove edge runtime to avoid global object issues
// export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION || 'unknown',
    env: {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      nodeEnv: process.env.NODE_ENV,
    }
  }, { headers })
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  return new NextResponse(null, { status: 200, headers })
}