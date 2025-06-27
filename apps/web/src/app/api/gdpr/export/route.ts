import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import archiver from 'archiver'
import { Readable } from 'stream'

const exportSchema = z.object({
  requestId: z.string(),
  format: z.enum(['json', 'csv']).default('json'),
})

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
    const { requestId, format } = exportSchema.parse(body)

    // Verify the request belongs to the user and is approved
    const { data: exportRequest, error: requestError } = await supabase
      .from('gdpr_requests')
      .select('*')
      .eq('id', requestId)
      .eq('user_id', user.id)
      .eq('type', 'export')
      .eq('status', 'processing')
      .single()

    if (requestError || !exportRequest) {
      return NextResponse.json({ error: 'Invalid or unauthorized request' }, { status: 403 })
    }

    // Collect all user data
    const userData = await collectUserData(user.id, supabase)

    // Generate export based on format
    let exportData: Buffer
    let fileName: string
    let contentType: string

    if (format === 'json') {
      exportData = Buffer.from(JSON.stringify(userData, null, 2))
      fileName = `user-data-export-${user.id}-${Date.now()}.json`
      contentType = 'application/json'
    } else {
      // CSV format - flatten the data structure
      const csvData = await convertToCSV(userData)
      exportData = Buffer.from(csvData)
      fileName = `user-data-export-${user.id}-${Date.now()}.csv`
      contentType = 'text/csv'
    }

    // Create a signed URL for download
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('gdpr-exports')
      .upload(`${user.id}/${fileName}`, exportData, {
        contentType,
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('Error uploading export:', uploadError)
      return NextResponse.json({ error: 'Failed to create export' }, { status: 500 })
    }

    // Get signed URL (valid for 7 days)
    const { data: { signedUrl }, error: urlError } = await supabase.storage
      .from('gdpr-exports')
      .createSignedUrl(`${user.id}/${fileName}`, 7 * 24 * 60 * 60)

    if (urlError) {
      console.error('Error creating signed URL:', urlError)
      return NextResponse.json({ error: 'Failed to create download link' }, { status: 500 })
    }

    // Update request status
    await supabase
      .from('gdpr_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...exportRequest.metadata,
          download_url: signedUrl,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        },
      })
      .eq('id', requestId)

    // Create export job record
    await supabase
      .from('gdpr_export_jobs')
      .insert({
        request_id: requestId,
        user_id: user.id,
        status: 'completed',
        download_url: signedUrl,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        file_size: exportData.length,
        format,
      })

    // Log the export
    await supabase
      .from('gdpr_audit_logs')
      .insert({
        user_id: user.id,
        action: 'data_exported',
        resource_type: 'gdpr_export',
        resource_id: requestId,
        metadata: {
          format,
          file_size: exportData.length,
        },
      })

    // Send email notification
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        to: user.email,
        subject: 'Your Data Export is Ready',
        template: 'gdpr-export-ready',
        data: {
          userName: user.user_metadata?.full_name || user.email,
          downloadUrl: signedUrl,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        },
      }),
    })

    return NextResponse.json({
      success: true,
      downloadUrl: signedUrl,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      format,
      fileSize: exportData.length,
    })
  } catch (error) {
    console.error('Error in data export:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 })
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function collectUserData(userId: string, supabase: any) {
  const data: any = {
    exportedAt: new Date().toISOString(),
    userId,
  }

  // Collect user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (profile) {
    data.profile = profile
  }

  // Collect workspaces
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', userId)
  
  data.workspaces = workspaces || []

  // Collect workspace memberships
  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('*, workspace:workspaces(*)')
    .eq('user_id', userId)
  
  data.workspaceMemberships = memberships || []

  // Collect campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('created_by', userId)
  
  data.campaigns = campaigns || []

  // Collect leads
  const workspaceIds = [...(workspaces || []).map(w => w.id), ...(memberships || []).map(m => m.workspace_id)]
  
  if (workspaceIds.length > 0) {
    const { data: leads } = await supabase
      .from('leads')
      .select('*')
      .in('workspace_id', workspaceIds)
    
    data.leads = leads || []
  }

  // Collect email templates
  const { data: templates } = await supabase
    .from('email_templates')
    .select('*')
    .eq('created_by', userId)
  
  data.emailTemplates = templates || []

  // Collect AI usage
  const { data: aiUsage } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('user_id', userId)
  
  data.aiUsage = aiUsage || []

  // Collect preferences
  const { data: preferences } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  
  if (preferences) {
    data.preferences = preferences
  }

  // Collect consents
  const { data: consents } = await supabase
    .from('gdpr_consents')
    .select('*')
    .eq('user_id', userId)
  
  data.consents = consents || []

  // Collect audit logs (last 90 days)
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  
  const { data: auditLogs } = await supabase
    .from('gdpr_audit_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', ninetyDaysAgo.toISOString())
    .order('created_at', { ascending: false })
  
  data.auditLogs = auditLogs || []

  return data
}

async function convertToCSV(data: any): Promise<string> {
  const csv: string[] = []
  
  // Profile section
  csv.push('PROFILE DATA')
  csv.push('Field,Value')
  if (data.profile) {
    Object.entries(data.profile).forEach(([key, value]) => {
      csv.push(`${key},"${value}"`)
    })
  }
  csv.push('')
  
  // Workspaces section
  csv.push('WORKSPACES')
  if (data.workspaces.length > 0) {
    const headers = Object.keys(data.workspaces[0])
    csv.push(headers.join(','))
    data.workspaces.forEach((workspace: any) => {
      csv.push(headers.map(h => `"${workspace[h] || ''}"`).join(','))
    })
  }
  csv.push('')
  
  // Campaigns section
  csv.push('CAMPAIGNS')
  if (data.campaigns.length > 0) {
    const headers = Object.keys(data.campaigns[0])
    csv.push(headers.join(','))
    data.campaigns.forEach((campaign: any) => {
      csv.push(headers.map(h => `"${campaign[h] || ''}"`).join(','))
    })
  }
  csv.push('')
  
  // Add more sections as needed...
  
  return csv.join('\n')
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get export job status
    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get('requestId')

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID required' }, { status: 400 })
    }

    // Get export job
    const { data: exportJob, error } = await supabase
      .from('gdpr_export_jobs')
      .select('*')
      .eq('request_id', requestId)
      .eq('user_id', user.id)
      .single()

    if (error || !exportJob) {
      return NextResponse.json({ error: 'Export job not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      job: exportJob,
    })
  } catch (error) {
    console.error('Error in export GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}