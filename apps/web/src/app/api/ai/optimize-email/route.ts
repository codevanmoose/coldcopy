import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdvancedAI } from '@/lib/ai/advanced-ai-service'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspace_id, user_id, email_content, target, context } = body

    if (!workspace_id || !email_content || !target) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate optimization target
    const validTargets = ['deliverability', 'engagement', 'conversion']
    if (!validTargets.includes(target)) {
      return NextResponse.json({ error: 'Invalid optimization target. Must be: deliverability, engagement, or conversion' }, { status: 400 })
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

    // Create AI service instance
    const advancedAI = await createAdvancedAI(supabase)

    // Optimize email using AI service
    const response = await advancedAI.optimizeEmailContent(
      workspace_id,
      user_id || user.id,
      email_content,
      {
        target,
        industry: context?.industry,
        audience: context?.audience,
      }
    )

    // Parse the optimization response to extract the optimized content
    const content = response.content
    let optimizedContent = ''
    let suggestions = []
    let score = 8.0

    // Try to extract structured response
    const sections = content.split(/(?:optimized version|improved email|final version)/i)
    if (sections.length > 1) {
      optimizedContent = sections[sections.length - 1].trim()
    } else {
      optimizedContent = content
    }

    // Extract suggestions if available
    const suggestionMatch = content.match(/suggestions?:?\s*(.*?)(?:\n\n|\nOptimized|$)/is)
    if (suggestionMatch) {
      suggestions = suggestionMatch[1].split(/\d+\.|"|-/).filter(s => s.trim()).map(s => s.trim())
    }

    // Extract score if available
    const scoreMatch = content.match(/score:?\s*(\d+(?:\.\d+)?)/i)
    if (scoreMatch) {
      score = parseFloat(scoreMatch[1])
    }

    const result = {
      content: optimizedContent,
      suggestions,
      score,
      target,
      usage: response.usage,
      improvements: {
        // Analyze what was improved based on target
        [target]: {
          score: score,
          improvements: suggestions.length,
          key_changes: target === 'deliverability' 
            ? ['spam score reduction', 'sender reputation improvement']
            : target === 'engagement'
            ? ['subject line optimization', 'call-to-action enhancement']
            : ['conversion rate optimization', 'value proposition clarity']
        }
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Email optimization error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Insufficient AI tokens')) {
        return NextResponse.json({ error: 'Insufficient AI tokens. Please purchase more tokens.' }, { status: 402 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}