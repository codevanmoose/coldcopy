import { NextRequest, NextResponse } from 'next/server'
import { bulkCancelHandler } from '../route'

// Bulk operations on jobs
export async function POST(request: NextRequest) {
  return await bulkCancelHandler(request)
}