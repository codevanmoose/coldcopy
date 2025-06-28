import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      workspace_id,
      name,
      description,
      targetAudience,
      sequence,
      scheduling,
      tracking,
      compliance
    } = body

    if (!workspace_id || !name || !sequence?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if user can create campaigns
    if (!['workspace_admin', 'campaign_manager'].includes(member.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Create the multi-channel campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('multi_channel_campaigns')
      .insert({
        workspace_id,
        name,
        description,
        target_audience: targetAudience,
        sequence_config: sequence,
        scheduling_config: scheduling,
        tracking_config: tracking,
        compliance_config: compliance,
        status: 'draft',
        created_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (campaignError) {
      console.error('Campaign creation error:', campaignError)
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 })
    }

    // Create individual channel campaigns for each enabled channel in each sequence step
    const channelCampaigns = []
    
    for (const [stepIndex, step] of sequence.entries()) {
      for (const channel of step.channels) {
        if (!channel.isEnabled) continue

        let channelCampaignId
        
        switch (channel.channel) {
          case 'email':
            const { data: emailCampaign } = await supabase
              .from('campaigns')
              .insert({
                workspace_id,
                name: `${name} - Email Step ${step.step}`,
                type: 'email',
                status: 'draft',
                settings: {
                  template: channel.messageTemplate,
                  personalization_fields: channel.personalizationFields,
                  daily_limit: channel.limits.dailyLimit,
                  delay_hours: channel.delay,
                  parent_campaign_id: campaign.id,
                  sequence_step: step.step
                },
                created_by: user.id
              })
              .select('id')
              .single()
            
            channelCampaignId = emailCampaign?.id
            break

          case 'linkedin':
            const { data: linkedinCampaign } = await supabase
              .from('linkedin_campaigns')
              .insert({
                workspace_id,
                name: `${name} - LinkedIn Step ${step.step}`,
                status: 'draft',
                message_template: channel.messageTemplate,
                personalization_fields: channel.personalizationFields,
                limits: channel.limits,
                parent_campaign_id: campaign.id,
                sequence_step: step.step,
                created_by: user.id
              })
              .select('id')
              .single()
            
            channelCampaignId = linkedinCampaign?.id
            break

          case 'twitter':
            const { data: twitterCampaign } = await supabase
              .from('twitter_campaigns')
              .insert({
                workspace_id,
                name: `${name} - Twitter Step ${step.step}`,
                status: 'draft',
                actions: [{
                  type: 'dm',
                  template: channel.messageTemplate,
                  probability: 1.0
                }],
                limits: {
                  dailyDMs: channel.limits.dailyLimit
                },
                parent_campaign_id: campaign.id,
                sequence_step: step.step,
                created_by: user.id
              })
              .select('id')
              .single()
            
            channelCampaignId = twitterCampaign?.id
            break

          case 'sms':
            const { data: smsCampaign } = await supabase
              .from('sms_campaigns')
              .insert({
                workspace_id,
                name: `${name} - SMS Step ${step.step}`,
                status: 'draft',
                message_content: channel.messageTemplate,
                message_type: 'text',
                personalization: {
                  enabled: true,
                  fields: channel.personalizationFields,
                  fallbackValues: {}
                },
                limits: {
                  dailyLimit: channel.limits.dailyLimit
                },
                parent_campaign_id: campaign.id,
                sequence_step: step.step,
                created_by: user.id
              })
              .select('id')
              .single()
            
            channelCampaignId = smsCampaign?.id
            break
        }

        if (channelCampaignId) {
          channelCampaigns.push({
            channel: channel.channel,
            campaign_id: channelCampaignId,
            sequence_step: step.step,
            is_enabled: channel.isEnabled
          })
        }
      }
    }

    // Update the multi-channel campaign with channel campaign mappings
    await supabase
      .from('multi_channel_campaigns')
      .update({
        channel_campaigns: channelCampaigns
      })
      .eq('id', campaign.id)

    // Log campaign creation
    await supabase.from('audit_logs').insert({
      workspace_id,
      user_id: user.id,
      action: 'campaign_created',
      resource_type: 'multi_channel_campaign',
      resource_id: campaign.id,
      details: {
        campaign_name: name,
        channels_enabled: sequence.flatMap(step => 
          step.channels.filter(ch => ch.isEnabled).map(ch => ch.channel)
        ),
        sequence_steps: sequence.length
      }
    })

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        channel_campaigns: channelCampaigns
      }
    })
  } catch (error) {
    console.error('Multi-channel campaign creation error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspace_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 })
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Build query
    let query = supabase
      .from('multi_channel_campaigns')
      .select(`
        *,
        creator:users!created_by(id, email),
        analytics:multi_channel_campaign_analytics(*)
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: campaigns, error } = await query

    if (error) {
      console.error('Failed to fetch multi-channel campaigns:', error)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('multi_channel_campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)

    if (status) {
      countQuery = countQuery.eq('status', status)
    }

    const { count } = await countQuery

    return NextResponse.json({
      success: true,
      campaigns: campaigns || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    })
  } catch (error) {
    console.error('Multi-channel campaigns fetch error:', error)
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}