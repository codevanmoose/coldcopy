import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from './cors'

export function withCors(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async function(req: NextRequest) {
    const origin = req.headers.get('origin')
    const headers = corsHeaders(origin)
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers })
    }
    
    // Execute handler
    const response = await handler(req)
    
    // Add CORS headers to response
    headers.forEach((value, key) => {
      response.headers.set(key, value)
    })
    
    return response
  }
}