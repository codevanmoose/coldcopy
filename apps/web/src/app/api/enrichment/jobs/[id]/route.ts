import { NextRequest, NextResponse } from 'next/server'
import { 
  getJobHandler,
  updateJobHandler,
  cancelJobHandler,
  retryJobHandler
} from '../route'

// Get specific job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await getJobHandler(request, { params })
}

// Update job
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await updateJobHandler(request, { params })
}

// Cancel job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return await cancelJobHandler(request, { params })
}
