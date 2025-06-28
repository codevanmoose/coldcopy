import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { workflowEngine } from '@/lib/automation/workflow-engine'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id } = body
    
    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const result = await workflowEngine.pauseWorkflow(workspace_id, id)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error pausing workflow:', error)
    return NextResponse.json(
      { error: 'Failed to pause workflow' },
      { status: 500 }
    )
  }
}
