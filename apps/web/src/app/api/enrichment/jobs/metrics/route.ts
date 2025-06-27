import { NextRequest, NextResponse } from 'next/server'
import { getMetricsHandler } from '../route'

// Get job metrics
export async function GET(request: NextRequest) {
  return await getMetricsHandler(request)
}