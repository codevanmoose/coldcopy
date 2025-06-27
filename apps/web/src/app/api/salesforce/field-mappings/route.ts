import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspace_id = searchParams.get('workspace_id');
    const object_type = searchParams.get('object_type');

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'workspace_id is required' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get field mappings
    let query = supabase
      .from('salesforce_field_mappings')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('is_active', true);

    if (object_type) {
      query = query.eq('salesforce_object', object_type);
    }

    const { data: mappings, error } = await query.order('is_default', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Return first mapping if object_type specified, otherwise all
    if (object_type && mappings.length > 0) {
      return NextResponse.json({ mapping: mappings[0] });
    }

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error('Salesforce field mappings fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch field mappings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspace_id,
      mapping_name,
      salesforce_object,
      local_object,
      field_mappings,
      is_default,
    } = body;

    if (!workspace_id || !mapping_name || !salesforce_object || !local_object || !field_mappings) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('salesforce_field_mappings')
        .update({ is_default: false })
        .eq('workspace_id', workspace_id)
        .eq('salesforce_object', salesforce_object);
    }

    // Create field mapping
    const { data: mapping, error } = await supabase
      .from('salesforce_field_mappings')
      .insert({
        workspace_id,
        mapping_name,
        salesforce_object,
        local_object,
        field_mappings,
        is_default: is_default || false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error('Salesforce field mapping create error:', error);
    return NextResponse.json(
      { error: 'Failed to create field mapping' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      workspace_id,
      mapping_id,
      mapping_name,
      field_mappings,
      is_default,
    } = body;

    if (!workspace_id || !mapping_id) {
      return NextResponse.json(
        { error: 'workspace_id and mapping_id are required' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get current mapping to check object type
    const { data: currentMapping } = await supabase
      .from('salesforce_field_mappings')
      .select('salesforce_object')
      .eq('id', mapping_id)
      .eq('workspace_id', workspace_id)
      .single();

    if (!currentMapping) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    // If setting as default, unset other defaults
    if (is_default) {
      await supabase
        .from('salesforce_field_mappings')
        .update({ is_default: false })
        .eq('workspace_id', workspace_id)
        .eq('salesforce_object', currentMapping.salesforce_object)
        .neq('id', mapping_id);
    }

    // Update field mapping
    const { data: mapping, error } = await supabase
      .from('salesforce_field_mappings')
      .update({
        mapping_name,
        field_mappings,
        is_default,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mapping_id)
      .eq('workspace_id', workspace_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ mapping });
  } catch (error) {
    console.error('Salesforce field mapping update error:', error);
    return NextResponse.json(
      { error: 'Failed to update field mapping' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const workspace_id = searchParams.get('workspace_id');
    const mapping_id = searchParams.get('mapping_id');

    if (!workspace_id || !mapping_id) {
      return NextResponse.json(
        { error: 'workspace_id and mapping_id are required' },
        { status: 400 }
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete field mapping
    const { error } = await supabase
      .from('salesforce_field_mappings')
      .delete()
      .eq('id', mapping_id)
      .eq('workspace_id', workspace_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Salesforce field mapping delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete field mapping' },
      { status: 500 }
    );
  }
}