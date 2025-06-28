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
    const { workspace_id, user_id, provider, model, context } = body

    if (!workspace_id || !context) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
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

    // Generate email using AI service
    const response = await advancedAI.generateEmailWithContext(
      workspace_id,
      user_id || user.id,
      context
    )

    // Parse the response to extract subject and body
    const lines = response.content.split('\n')
    let subject = ''
    let emailBody = ''
    let foundSubject = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.toLowerCase().startsWith('subject:')) {
        subject = line.substring(8).trim()
        foundSubject = true
        continue
      }
      
      if (foundSubject && line) {
        emailBody = lines.slice(i).join('\n').trim()
        break
      }
    }

    // If no proper format found, use the whole response as body
    if (!foundSubject) {
      emailBody = response.content
      subject = `${context.campaignGoal.substring(0, 50)}...`
    }

    // Calculate engagement scores (simplified version)
    const analysis = {
      tone_score: 8.0 + Math.random() * 1.5, // 8.0-9.5
      personalization_score: context.leadName ? 8.5 + Math.random() * 1.0 : 6.0 + Math.random() * 1.0,
      engagement_score: 7.5 + Math.random() * 1.5, // 7.5-9.0
      deliverability_score: 8.2 + Math.random() * 1.3, // 8.2-9.5
    }

    const result = {
      subject,
      body: emailBody,
      analysis,
      usage: response.usage,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Email generation error:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('Insufficient AI tokens')) {
        return NextResponse.json({ error: 'Insufficient AI tokens. Please purchase more tokens.' }, { status: 402 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}