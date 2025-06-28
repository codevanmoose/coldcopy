import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/cors'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    region: process.env.VERCEL_REGION || 'unknown',
  }, { headers })
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  return new NextResponse(null, { status: 200, headers })
}