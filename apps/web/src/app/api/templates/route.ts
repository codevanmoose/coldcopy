import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/api-auth'

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
  id?: string
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

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(authResult.error, { status: authResult.status })
    }
    
    const { supabase, user } = authResult

    // Get workspace_id from workspace_members (try any workspace if no default)
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const workspaceId = membership.workspace_id

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const isPublic = searchParams.get('public') === 'true'
    const search = searchParams.get('search')?.toLowerCase()
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Get templates for the workspace (handle missing table gracefully)
    let templates = [];
    let total = 0;
    
    try {
      let query = supabase
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
          created_by
        `)
        .or(`workspace_id.eq.${workspaceId},is_public.eq.true`)
        .order('updated_at', { ascending: false })

      // Apply filters
      if (category && category !== 'all') {
        query = query.eq('category', category)
      }

      if (isPublic) {
        query = query.eq('is_public', true)
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1)

      const { data: templatesData, error } = await query

      if (error) {
        console.warn('Email templates table not found or error:', error.message);
        // Return empty array if table doesn't exist
        templates = [];
        total = 0;
      } else {
        // Transform the data
        templates = templatesData?.map(template => ({
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
          author: 'Author',
          isFavorite: false
        })) || [];

        // Get total count for pagination
        try {
          const { count } = await supabase
            .from('email_templates')
            .select('*', { count: 'exact', head: true })
            .or(`workspace_id.eq.${workspaceId},is_public.eq.true`);
          total = count || 0;
        } catch (e) {
          total = templates.length;
        }
      }
    } catch (e) {
      console.warn('Email templates query failed:', e.message);
      templates = [];
      total = 0;
    }

    return NextResponse.json({
      templates,
      total,
      offset,
      limit
    })

  } catch (error) {
    console.error('Template fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult.error) {
      return NextResponse.json(authResult.error, { status: authResult.status })
    }
    
    const { supabase, user } = authResult

    // Get workspace_id from workspace_members (try any workspace if no default)
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership?.workspace_id) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 400 })
    }

    const workspaceId = membership.workspace_id

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

    const templateData = {
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
      workspace_id: workspaceId,
      created_by: user.id,
      usage_count: 0
    }

    const { data: template, error } = await supabase
      .from('email_templates')
      .insert(templateData)
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
      console.error('Error creating template:', error)
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 })
    }

    // Transform response
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

  } catch (error) {
    console.error('Template creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}