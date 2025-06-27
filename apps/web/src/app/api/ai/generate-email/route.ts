import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAIService } from '@/lib/ai'
import { z } from 'zod'

const generateEmailSchema = z.object({
  leadInfo: z.object({
    name: z.string().optional(),
    email: z.string().email(),
    title: z.string().optional(),
    company: z.string().optional(),
    industry: z.string().optional(),
    location: z.string().optional(),
    customFields: z.record(z.string()).optional(),
  }),
  companyInfo: z.object({
    name: z.string(),
    description: z.string().optional(),
    website: z.string().optional(),
    industry: z.string().optional(),
  }).optional(),
  productInfo: z.object({
    name: z.string(),
    description: z.string().optional(),
    benefits: z.array(z.string()).optional(),
    useCase: z.string().optional(),
    pricing: z.string().optional(),
  }).optional(),
  template: z.string().optional(),
  tone: z.enum(['professional', 'friendly', 'casual', 'formal', 'enthusiastic']).optional(),
  style: z.enum(['direct', 'storytelling', 'problem-solution', 'benefit-focused', 'question-based']).optional(),
  customInstructions: z.string().optional(),
  includeUnsubscribe: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('*, workspace:workspaces(*)')
      .eq('id', user.id)
      .single()

    if (userError || !dbUser || !dbUser.workspace) {
      return NextResponse.json({ error: 'User workspace not found' }, { status: 404 })
    }

    // Check AI tokens (we'll implement this in the next task)
    const { data: tokenBalance } = await supabase
      .from('workspaces')
      .select('ai_tokens_balance')
      .eq('id', dbUser.workspace.id)
      .single()

    if (!tokenBalance || tokenBalance.ai_tokens_balance < 100) {
      return NextResponse.json(
        { error: 'Insufficient AI tokens. Please purchase more tokens to continue.' },
        { status: 402 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = generateEmailSchema.parse(body)

    // Get AI configuration from workspace settings
    const aiConfig = dbUser.workspace.settings?.ai || {}
    const provider = aiConfig.provider || process.env.AI_PROVIDER
    const apiKey = aiConfig.apiKey || process.env.AI_API_KEY
    const model = aiConfig.model || process.env.AI_MODEL

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'AI service not configured. Please contact support.' },
        { status: 500 }
      )
    }

    // Create AI service
    const aiService = createAIService()
    if (!aiService) {
      return NextResponse.json(
        { error: 'AI service initialization failed' },
        { status: 500 }
      )
    }

    // Add company info from workspace if not provided
    const companyInfo = validatedData.companyInfo || {
      name: dbUser.workspace.name,
      description: dbUser.workspace.settings?.company?.description,
      website: dbUser.workspace.settings?.company?.website,
      industry: dbUser.workspace.settings?.company?.industry,
    }

    // Generate email
    const result = await aiService.generateEmail({
      ...validatedData,
      companyInfo,
      model,
      temperature: aiConfig.temperature || 0.7,
      maxTokens: aiConfig.maxTokens || 500,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate email' },
        { status: 500 }
      )
    }

    // Parse the generated content to extract subject and body
    const content = result.content || ''
    const subjectMatch = content.match(/Subject:\s*(.+?)(?:\n|$)/i)
    const subject = subjectMatch ? subjectMatch[1].trim() : 'No subject'
    const emailBody = content.replace(/Subject:\s*.+?\n\n?/i, '').trim()

    // Deduct tokens from balance
    if (result.usage) {
      const tokensUsed = result.usage.totalTokens
      await supabase
        .from('workspaces')
        .update({
          ai_tokens_balance: tokenBalance.ai_tokens_balance - tokensUsed,
          ai_tokens_used: (dbUser.workspace.ai_tokens_used || 0) + tokensUsed,
        })
        .eq('id', dbUser.workspace.id)

      // Log AI usage
      await supabase.from('ai_usage_logs').insert({
        workspace_id: dbUser.workspace.id,
        user_id: user.id,
        provider,
        model: result.model,
        prompt_tokens: result.usage.promptTokens,
        completion_tokens: result.usage.completionTokens,
        total_tokens: result.usage.totalTokens,
        purpose: 'email_generation',
        metadata: {
          lead_email: validatedData.leadInfo.email,
          tone: validatedData.tone,
          style: validatedData.style,
        },
      })
    }

    return NextResponse.json({
      success: true,
      subject,
      body: emailBody,
      usage: result.usage,
      remainingTokens: tokenBalance.ai_tokens_balance - (result.usage?.totalTokens || 0),
    })
  } catch (error) {
    console.error('Email generation error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}