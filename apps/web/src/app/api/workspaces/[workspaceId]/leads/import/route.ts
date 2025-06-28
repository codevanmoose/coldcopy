import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { corsHeaders } from '@/lib/cors'
import Papa from 'papaparse'

export const runtime = 'nodejs' // Required for file handling
export const maxDuration = 60 // Allow up to 60 seconds for large imports

// POST /api/workspaces/[workspaceId]/leads/import
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ workspaceId: string }> }
) {
  const { workspaceId } = await context.params
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  
  try {
    const supabase = await createClient()
    
    // Verify user has access to workspace
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }
    
    // Check workspace membership with write permission
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()
      
    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403, headers })
    }
    
    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400, headers })
    }
    
    // Check file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400, headers })
    }
    
    // Read file content
    const text = await file.text()
    
    // Parse CSV
    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.toLowerCase().trim().replace(/\s+/g, '_')
    })
    
    if (parseResult.errors.length > 0) {
      return NextResponse.json({ 
        error: 'CSV parsing error',
        details: parseResult.errors 
      }, { status: 400, headers })
    }
    
    const rows = parseResult.data as any[]
    
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in CSV' }, { status: 400, headers })
    }
    
    // Prepare leads for insertion
    const leadsToInsert = []
    const errors = []
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 2 // Account for header row
      
      // Map CSV fields to lead fields
      const email = row.email || row.email_address || row.contact_email
      const firstName = row.first_name || row.firstname || row.name?.split(' ')[0]
      const lastName = row.last_name || row.lastname || row.name?.split(' ').slice(1).join(' ')
      const company = row.company || row.company_name || row.organization
      const title = row.title || row.job_title || row.position || row.role
      
      // Validate email
      if (!email || !email.includes('@')) {
        errors.push({
          row: rowNumber,
          error: 'Invalid or missing email address'
        })
        continue
      }
      
      // Extract custom fields
      const customFields: any = {}
      const knownFields = ['email', 'email_address', 'contact_email', 'first_name', 'firstname', 
                          'last_name', 'lastname', 'name', 'company', 'company_name', 
                          'organization', 'title', 'job_title', 'position', 'role', 'tags']
      
      Object.keys(row).forEach(key => {
        if (!knownFields.includes(key) && row[key]) {
          customFields[key] = row[key]
        }
      })
      
      // Parse tags
      let tags = []
      if (row.tags) {
        tags = row.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
      }
      
      leadsToInsert.push({
        workspace_id: workspaceId,
        email: email.toLowerCase().trim(),
        first_name: firstName?.trim(),
        last_name: lastName?.trim(),
        company: company?.trim(),
        title: title?.trim(),
        tags,
        custom_fields: customFields,
        status: 'new'
      })
    }
    
    if (leadsToInsert.length === 0) {
      return NextResponse.json({ 
        error: 'No valid leads to import',
        errors 
      }, { status: 400, headers })
    }
    
    // Insert leads in batches of 100
    const batchSize = 100
    let imported = 0
    let duplicates = 0
    
    for (let i = 0; i < leadsToInsert.length; i += batchSize) {
      const batch = leadsToInsert.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('leads')
        .upsert(batch, {
          onConflict: 'workspace_id,email',
          ignoreDuplicates: true
        })
        .select()
      
      if (error) {
        console.error('Error importing batch:', error)
        errors.push({
          batch: `${i + 1}-${Math.min(i + batchSize, leadsToInsert.length)}`,
          error: error.message
        })
      } else if (data) {
        imported += data.length
        duplicates += batch.length - data.length
      }
    }
    
    // Log audit event
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: 'leads.imported',
      resource_type: 'lead',
      metadata: { 
        total: leadsToInsert.length,
        imported,
        duplicates,
        errors: errors.length
      }
    })
    
    return NextResponse.json({ 
      success: true,
      imported,
      duplicates,
      total: leadsToInsert.length,
      errors: errors.length > 0 ? errors : undefined
    }, { headers })
    
  } catch (error) {
    console.error('Error in leads import:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers }
    )
  }
}

// OPTIONS handler for CORS
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = corsHeaders(origin)
  return new NextResponse(null, { status: 200, headers })
}