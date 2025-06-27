import { NextRequest, NextResponse } from 'next/server'
import { retryJobHandler } from '../../route'

// Retry job
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await retryJobHandler(request, { params })
}