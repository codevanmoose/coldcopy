import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Missing Supabase environment variables',
        config: {
          url: !!supabaseUrl,
          key: !!supabaseAnonKey,
        }
      }, { status: 500 })
    }

    // Test Supabase connection
    const supabase = await createClient()
    
    // Try a simple query to test connection
    const { data, error } = await supabase.auth.getSession()
    
    return NextResponse.json({
      status: 'Supabase Configuration Check',
      config: {
        url_configured: !!supabaseUrl,
        key_configured: !!supabaseAnonKey,
        url_preview: supabaseUrl?.substring(0, 30) + '...',
        key_preview: supabaseAnonKey?.substring(0, 20) + '...',
        connection_test: error ? 'failed' : 'success',
        session_check: data ? 'working' : 'no_session',
      },
      message: error ? `Connection error: ${error.message}` : '✅ Supabase is configured and accessible'
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to test Supabase connection',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}