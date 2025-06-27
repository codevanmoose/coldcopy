import { NextRequest, NextResponse } from 'next/server'
import { processJobsOnce } from '@/lib/enrichment/worker'

// ====================================
// Serverless Job Processing Endpoint
// ====================================

// This endpoint is designed to be called by Vercel Cron Jobs
// or external schedulers to process enrichment jobs in a serverless environment

export async function POST(request: NextRequest) {
  try {
    // Check if request is from authorized source
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get optional parameters
    const body = await request.json().catch(() => ({}))
    const maxJobs = body.maxJobs || 10
    const timeout = body.timeout || 25000 // 25 seconds default

    console.log(`Processing up to ${maxJobs} jobs with ${timeout}ms timeout`)

    // Process jobs with timeout
    const processedCount = await Promise.race([
      processJobsOnce(maxJobs),
      new Promise<number>((_, reject) => 
        setTimeout(() => reject(new Error('Processing timeout')), timeout)
      )
    ])

    return NextResponse.json({
      success: true,
      processedJobs: processedCount,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Serverless job processing error:', error)
    
    return NextResponse.json({
      error: 'Processing failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      status: 'healthy',
      service: 'enrichment-processor',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    })
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}