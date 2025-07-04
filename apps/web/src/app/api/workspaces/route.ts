import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { onWorkspaceCreated } from '@/lib/demo-content'

const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(255).regex(/^[a-z0-9-]+$/),
  skipDemoContent: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: workspaceData, error } = await supabase
      .rpc('get_user_workspaces', { user_id: user.id })

    if (error) {
      console.error('RPC error:', error)
      throw error
    }

    // Transform the response to match expected format
    const workspaces = workspaceData?.map((w: any) => ({
      id: w.workspace_id,
      name: w.workspace_name,
      slug: w.workspace_slug,
      role: w.role,
      is_default: w.is_default
    })) || []

    return NextResponse.json({ workspaces })
  } catch (error) {
    console.error('Get workspaces error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workspaces' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, skipDemoContent } = createWorkspaceSchema.parse(body)

    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if slug is already taken
    const { data: existingWorkspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingWorkspace) {
      return NextResponse.json(
        { error: 'Workspace slug already exists' },
        { status: 400 }
      )
    }

    // Create workspace
    const { data: workspace, error: createError } = await supabase
      .from('workspaces')
      .insert({
        name,
        slug,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (createError) {
      throw createError
    }

    // Add user as workspace admin
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'workspace_admin',
        is_default: false,
      })

    if (memberError) {
      // Rollback workspace creation
      await supabase.from('workspaces').delete().eq('id', workspace.id)
      throw memberError
    }

    // Create audit log
    await supabase.from('audit_logs').insert({
      workspace_id: workspace.id,
      user_id: user.id,
      action: 'workspace_created',
      resource_type: 'workspace',
      resource_id: workspace.id,
      metadata: {
        name,
        slug,
      },
    })

    // Seed demo content for new workspace (async, non-blocking)
    onWorkspaceCreated(workspace.id, skipDemoContent)

    return NextResponse.json({ workspace })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Create workspace error:', error)
    return NextResponse.json(
      { error: 'Failed to create workspace' },
      { status: 500 }
    )
  }
}