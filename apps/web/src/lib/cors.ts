import { NextRequest, NextResponse } from 'next/server'

const allowedOrigins = [
  'https://coldcopy.cc',
  'https://www.coldcopy.cc',
  'https://api.coldcopy.cc',
  'http://localhost:3000',
  'http://localhost:3001',
]

export function corsHeaders(origin: string | null = null) {
  const headers = new Headers()
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    headers.set('Access-Control-Allow-Origin', origin)
  } else if (!origin) {
    // For server-to-server requests
    headers.set('Access-Control-Allow-Origin', '*')
  }
  
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Workspace-Id, X-API-Key')
  headers.set('Access-Control-Max-Age', '86400')
  headers.set('Access-Control-Allow-Credentials', 'true')
  
  return headers
}

export function handleCors(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers })
  }
  
  return headers
}