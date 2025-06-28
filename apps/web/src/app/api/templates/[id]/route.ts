import { NextRequest, NextResponse } from 'next/server'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

interface TemplateBlock {
  id: string
  type: 'text' | 'heading' | 'image' | 'button' | 'divider' | 'spacer' | 'variable'
  content: string
  styles: {
    fontSize?: string
    fontWeight?: string
    color?: string
    backgroundColor?: string
    textAlign?: 'left' | 'center' | 'right'
    padding?: string
    margin?: string
    borderRadius?: string
    border?: string
  }
  metadata?: {
    imageUrl?: string
    linkUrl?: string
    buttonText?: string
    variableName?: string
    alt?: string
  }
}

interface EmailTemplate {
  name: string
  description: string
  category: string
  blocks: TemplateBlock[]
  variables: string[]
  styles: {
    backgroundColor: string
    fontFamily: string
    maxWidth: string
  }
  previewText: string
  subject: string
  isPublic?: boolean
  tags?: string[]
  thumbnail?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .select(`
        id,
        name,
        description,
        category,
        blocks,
        variables,
        styles,
        preview_text,
        subject,
        is_public,
        tags,
        thumbnail,
        usage_count,
        created_at,
        updated_at,
        workspace_id,
        created_by,
        user_profiles!email_templates_created_by_fkey (
          first_name,
          last_name
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching template:', error)
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // Check permissions - user can access if:
    // 1. Template belongs to their workspace
    // 2. Template is public
    // 3. User created the template
    const canAccess = template.workspace_id === profile.workspace_id || 
                     template.is_public || 
                     template.created_by === user.id

    if (!canAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Increment usage count if accessing a template (not for preview)
    const incrementUsage = request.nextUrl.searchParams.get('increment') === 'true'
    if (incrementUsage && template.workspace_id !== profile.workspace_id) {
      await supabase
        .from('email_templates')
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq('id', id)
    }

    const transformedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      blocks: template.blocks,
      variables: template.variables,
      styles: template.styles,
      previewText: template.preview_text,
      subject: template.subject,
      isPublic: template.is_public,
      tags: template.tags || [],
      thumbnail: template.thumbnail,
      usageCount: template.usage_count || 0,
      lastModified: template.updated_at,
      author: template.user_profiles 
        ? `${template.user_profiles.first_name} ${template.user_profiles.last_name}`.trim() 
        : 'Unknown',
      canEdit: template.workspace_id === profile.workspace_id
    }

    return NextResponse.json(transformedTemplate)

  } catch (error) {
    console.error('Template fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Check if template exists and user has permission to edit
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('email_templates')
      .select('workspace_id, created_by')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // User can edit if they own the template or it belongs to their workspace
    const canEdit = existingTemplate.workspace_id === profile.workspace_id

    if (!canEdit) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body: EmailTemplate = await request.json()

    // Validate required fields
    if (!body.name || !body.category || !body.blocks) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Extract variables from blocks
    const extractedVariables = new Set<string>()
    const variableRegex = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g

    body.blocks.forEach(block => {
      if (block.content) {
        let match
        while ((match = variableRegex.exec(block.content)) !== null) {
          extractedVariables.add(match[1])
        }
      }
      if (block.metadata?.buttonText) {
        let match
        while ((match = variableRegex.exec(block.metadata.buttonText)) !== null) {
          extractedVariables.add(match[1])
        }
      }
    })

    // Also check subject and preview text
    if (body.subject) {
      let match
      while ((match = variableRegex.exec(body.subject)) !== null) {
        extractedVariables.add(match[1])
      }
    }

    if (body.previewText) {
      let match
      while ((match = variableRegex.exec(body.previewText)) !== null) {
        extractedVariables.add(match[1])
      }
    }

    const updateData = {
      name: body.name,
      description: body.description || '',
      category: body.category,
      blocks: body.blocks,
      variables: Array.from(extractedVariables),
      styles: body.styles || {
        backgroundColor: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        maxWidth: '600px'
      },
      preview_text: body.previewText || '',
      subject: body.subject || '',
      is_public: body.isPublic || false,
      tags: body.tags || [],
      thumbnail: body.thumbnail || null,
      updated_at: new Date().toISOString()
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .update(updateData)
      .eq('id', id)
      .select(`
        id,
        name,
        description,
        category,
        blocks,
        variables,
        styles,
        preview_text,
        subject,
        is_public,
        tags,
        thumbnail,
        usage_count,
        created_at,
        updated_at
      `)
      .single()

    if (error) {
      console.error('Error updating template:', error)
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 })
    }

    const transformedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      blocks: template.blocks,
      variables: template.variables,
      styles: template.styles,
      previewText: template.preview_text,
      subject: template.subject,
      isPublic: template.is_public,
      tags: template.tags || [],
      thumbnail: template.thumbnail,
      usageCount: template.usage_count,
      lastModified: template.updated_at,
      author: 'You'
    }

    return NextResponse.json(transformedTemplate)

  } catch (error) {
    console.error('Template update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    // Check if template exists and user has permission to delete
    const { data: existingTemplate, error: fetchError } = await supabase
      .from('email_templates')
      .select('workspace_id, created_by')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    // User can delete if they own the template or it belongs to their workspace
    const canDelete = existingTemplate.workspace_id === profile.workspace_id

    if (!canDelete) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting template:', error)
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Template deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single()

    if (!profile?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const { action } = await request.json()

    if (action === 'duplicate') {
      // Get the original template
      const { data: originalTemplate, error: fetchError } = await supabase
        .from('email_templates')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      // Check if user can access the template
      const canAccess = originalTemplate.workspace_id === profile.workspace_id || 
                       originalTemplate.is_public

      if (!canAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }

      // Create duplicate
      const duplicateData = {
        name: `${originalTemplate.name} (Copy)`,
        description: originalTemplate.description,
        category: originalTemplate.category,
        blocks: originalTemplate.blocks,
        variables: originalTemplate.variables,
        styles: originalTemplate.styles,
        preview_text: originalTemplate.preview_text,
        subject: originalTemplate.subject,
        is_public: false, // Duplicates are always private
        tags: originalTemplate.tags || [],
        thumbnail: originalTemplate.thumbnail,
        workspace_id: profile.workspace_id,
        created_by: user.id,
        usage_count: 0
      }

      const { data: template, error } = await supabase
        .from('email_templates')
        .insert(duplicateData)
        .select(`
          id,
          name,
          description,
          category,
          blocks,
          variables,
          styles,
          preview_text,
          subject,
          is_public,
          tags,
          thumbnail,
          usage_count,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        console.error('Error duplicating template:', error)
        return NextResponse.json({ error: 'Failed to duplicate template' }, { status: 500 })
      }

      const transformedTemplate = {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        blocks: template.blocks,
        variables: template.variables,
        styles: template.styles,
        previewText: template.preview_text,
        subject: template.subject,
        isPublic: template.is_public,
        tags: template.tags || [],
        thumbnail: template.thumbnail,
        usageCount: template.usage_count,
        lastModified: template.updated_at,
        author: 'You'
      }

      return NextResponse.json(transformedTemplate, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('Template action error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
