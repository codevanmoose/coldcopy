import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's workspace
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const workspaceId = profile.workspace_id

    // Get enrichment credits
    // First try to get workspace-specific credits
    let { data: credits, error: creditsError } = await supabase
      .from('enrichment_credits')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('provider_id', null)
      .single()

    // If no credits found, check if workspace uses the general token system
    if (creditsError || !credits) {
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('ai_tokens_balance, ai_tokens_used')
        .eq('id', workspaceId)
        .single()

      if (workspaceError || !workspace) {
        return NextResponse.json({ error: 'Failed to fetch credit balance' }, { status: 500 })
      }

      // Convert AI tokens to enrichment credits (1:1 ratio for now)
      const available = workspace.ai_tokens_balance || 0
      const used = workspace.ai_tokens_used || 0
      const allocated = available + used

      return NextResponse.json({
        available,
        used,
        allocated,
        type: 'ai_tokens'
      })
    }

    // Return enrichment-specific credits
    return NextResponse.json({
      available: parseFloat(credits.credits_available || '0'),
      used: parseFloat(credits.credits_used || '0'),
      allocated: parseFloat(credits.credits_allocated || '0'),
      resetPeriod: credits.reset_period,
      autoRefill: credits.auto_refill,
      autoRefillAmount: credits.auto_refill_amount ? parseFloat(credits.auto_refill_amount) : null,
      autoRefillThreshold: credits.auto_refill_threshold ? parseFloat(credits.auto_refill_threshold) : null,
      type: 'enrichment_credits'
    })

  } catch (error) {
    console.error('Get credits error:', error)
    return NextResponse.json({ 
      error: 'Failed to fetch credit balance' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { amount, action } = body

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    if (!['add', 'deduct'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get user's workspace
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile?.workspace_id) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const workspaceId = profile.workspace_id

    // Update credits based on action
    if (action === 'add') {
      const { error: updateError } = await supabase.rpc('add_enrichment_credits', {
        p_workspace_id: workspaceId,
        p_credits_to_add: amount
      })

      if (updateError) {
        throw updateError
      }
    } else {
      const { error: updateError } = await supabase.rpc('use_enrichment_credits', {
        p_workspace_id: workspaceId,
        p_provider_id: null,
        p_credits_used: amount
      })

      if (updateError) {
        throw updateError
      }
    }

    // Return updated balance
    const { data: credits } = await supabase
      .from('enrichment_credits')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('provider_id', null)
      .single()

    if (credits) {
      return NextResponse.json({
        available: parseFloat(credits.credits_available || '0'),
        used: parseFloat(credits.credits_used || '0'),
        allocated: parseFloat(credits.credits_allocated || '0')
      })
    }

    // Fallback to AI tokens
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('ai_tokens_balance, ai_tokens_used')
      .eq('id', workspaceId)
      .single()

    return NextResponse.json({
      available: workspace?.ai_tokens_balance || 0,
      used: workspace?.ai_tokens_used || 0,
      allocated: (workspace?.ai_tokens_balance || 0) + (workspace?.ai_tokens_used || 0)
    })

  } catch (error) {
    console.error('Update credits error:', error)
    return NextResponse.json({ 
      error: 'Failed to update credits' 
    }, { status: 500 })
  }
}