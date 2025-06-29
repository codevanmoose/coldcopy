import { NextResponse } from 'next/server'

export async function GET() {
  // Check which environment variables are available
  const envCheck = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    JWT_SECRET: !!process.env.JWT_SECRET,
    ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
    
    // Show partial values for debugging (first 10 chars only)
    partialValues: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) || 'NOT_SET',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) || 'NOT_SET',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT_SET',
    }
  }

  return NextResponse.json({
    status: 'debug',
    timestamp: new Date().toISOString(),
    envCheck,
    nodeEnv: process.env.NODE_ENV,
  })
}