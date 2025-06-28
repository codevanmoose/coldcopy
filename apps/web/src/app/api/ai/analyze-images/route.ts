import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { advancedAI } from '@/lib/ai/advanced-ai-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, user_id, images, context } = body

    if (!workspace_id || !images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json({ error: 'Missing required fields or no images provided' }, { status: 400 })
    }

    // Verify user has access to workspace
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id, ai_tokens_balance')
      .eq('id', workspace_id)
      .single()

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    // Check if user is member of workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Validate image count (limit to 5 images per request)
    if (images.length > 5) {
      return NextResponse.json({ error: 'Maximum 5 images allowed per request' }, { status: 400 })
    }

    // Validate base64 images
    for (const image of images) {
      if (typeof image !== 'string' || !image) {
        return NextResponse.json({ error: 'Invalid image format. Expected base64 strings.' }, { status: 400 })
      }
    }

    // Analyze images using AI service
    const response = await advancedAI.analyzeLeadImages(
      workspace_id,
      user_id || user.id,
      images,
      context
    )

    const result = {
      content: response.content,
      usage: response.usage,
      insights: {
        // Extract key insights from the analysis
        professional_setting: response.content.toLowerCase().includes('office') || response.content.toLowerCase().includes('professional'),
        technology_visible: response.content.toLowerCase().includes('computer') || response.content.toLowerCase().includes('laptop') || response.content.toLowerCase().includes('tech'),
        team_environment: response.content.toLowerCase().includes('team') || response.content.toLowerCase().includes('colleagues'),
        company_branding: response.content.toLowerCase().includes('brand') || response.content.toLowerCase().includes('logo'),
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Image analysis error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Insufficient AI tokens')) {
        return NextResponse.json({ error: 'Insufficient AI tokens. Please purchase more tokens.' }, { status: 402 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}