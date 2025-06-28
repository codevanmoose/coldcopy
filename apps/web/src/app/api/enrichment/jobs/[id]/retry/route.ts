import { NextRequest, NextResponse } from 'next/server'
import { retryJobHandler } from '../../route'

// Retry job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await retryJobHandler(request, { params })
}
