import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { z } from 'zod';

const fieldMappingSchema = z.object({
  source_field: z.string(),
  target_field: z.string(),
  field_type: z.enum(['contact', 'company', 'deal', 'custom']),
  is_required: z.boolean().default(false),
  transform_rules: z.object({
    type: z.enum(['direct', 'format', 'map', 'custom']).optional(),
    format: z.string().optional(),
    mapping: z.record(z.string()).optional(),
    custom: z.string().optional(),
  }).optional(),
});

const updateFieldMappingsSchema = z.object({
  mappings: z.array(fieldMappingSchema),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'hubspot')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Get field mappings
    const { data: mappings, error } = await supabase
      .from('integration_field_mappings')
      .select('*')
      .eq('integration_id', integration.id)
      .order('created_at');

    if (error) {
      throw error;
    }

    return NextResponse.json({ mappings: mappings || [] });
  } catch (error) {
    console.error('Field mappings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field mappings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient(cookies());
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace
    const workspaceId = request.headers.get('x-workspace-id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Verify user has admin access
    const { data: member } = await supabase
      .from('workspace_users')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateFieldMappingsSchema.parse(body);

    // Get integration
    const { data: integration } = await supabase
      .from('integrations')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('provider', 'hubspot')
      .eq('is_active', true)
      .single();

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
    }

    // Delete existing mappings
    await supabase
      .from('integration_field_mappings')
      .delete()
      .eq('integration_id', integration.id);

    // Insert new mappings
    if (validatedData.mappings.length > 0) {
      const mappingsToInsert = validatedData.mappings.map(mapping => ({
        integration_id: integration.id,
        source_field: mapping.source_field,
        target_field: mapping.target_field,
        field_type: mapping.field_type,
        is_required: mapping.is_required,
        transform_rules: mapping.transform_rules || {},
      }));

      const { error: insertError } = await supabase
        .from('integration_field_mappings')
        .insert(mappingsToInsert);

      if (insertError) {
        throw insertError;
      }
    }

    // Update integration settings
    await supabase
      .from('integrations')
      .update({
        settings: {
          ...(integration as any).settings,
          field_mappings_updated_at: new Date().toISOString(),
          field_mappings_updated_by: user.id,
        },
      })
      .eq('id', integration.id);

    return NextResponse.json({ 
      success: true,
      message: 'Field mappings updated successfully',
      mappingsCount: validatedData.mappings.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid field mappings', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Field mappings update error:', error);
    return NextResponse.json(
      { error: 'Failed to update field mappings' },
      { status: 500 }
    );
  }
}