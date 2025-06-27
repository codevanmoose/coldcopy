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
  { params }: { params: { id: string } }
) {
  return await getJobHandler(request, { params })
}

// Update job
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await updateJobHandler(request, { params })
}

// Cancel job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return await cancelJobHandler(request, { params })
}