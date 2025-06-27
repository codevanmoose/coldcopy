import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SalesforceAuth } from '@/lib/integrations/salesforce/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
      console.error('Salesforce OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=salesforce_auth_failed`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=invalid_callback`
      );
    }

    // Extract workspace ID from state
    const [workspaceId] = state.split(':');
    if (!workspaceId) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=invalid_state`
      );
    }

    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/login?redirect=/dashboard/integrations`
      );
    }

    // Verify user has access to workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=unauthorized`
      );
    }

    const auth = new SalesforceAuth({
      client_id: process.env.SALESFORCE_CLIENT_ID!,
      client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
      redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
      sandbox: process.env.SALESFORCE_SANDBOX === 'true',
    });

    // Exchange code for tokens
    const tokenResponse = await auth.exchangeCodeForToken({
      code,
      redirect_uri: process.env.SALESFORCE_REDIRECT_URI!,
    });

    // Get user info
    const userInfo = await auth.getUserInfo(
      tokenResponse.access_token,
      tokenResponse.instance_url
    );

    // Store integration
    const { error: storeError } = await auth.storeIntegration(
      workspaceId,
      tokenResponse,
      userInfo
    );

    if (storeError) {
      console.error('Error storing Salesforce integration:', storeError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=storage_failed`
      );
    }

    // Create default field mappings
    await createDefaultFieldMappings(workspaceId);

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?success=salesforce_connected`
    );
  } catch (error) {
    console.error('Salesforce callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/integrations?error=callback_failed`
    );
  }
}

async function createDefaultFieldMappings(workspaceId: string) {
  const supabase = createClient();

  // Lead field mappings
  await supabase
    .from('salesforce_field_mappings')
    .insert({
      workspace_id: workspaceId,
      mapping_name: 'Default Lead Mapping',
      salesforce_object: 'Lead',
      local_object: 'lead',
      field_mappings: [
        { local_field: 'first_name', salesforce_field: 'FirstName' },
        { local_field: 'last_name', salesforce_field: 'LastName' },
        { local_field: 'email', salesforce_field: 'Email' },
        { local_field: 'company', salesforce_field: 'Company' },
        { local_field: 'job_title', salesforce_field: 'Title' },
        { local_field: 'phone', salesforce_field: 'Phone' },
        { local_field: 'website', salesforce_field: 'Website' },
        { local_field: 'industry', salesforce_field: 'Industry' },
        { local_field: 'linkedin_url', salesforce_field: 'LinkedIn_URL__c' },
      ],
      is_active: true,
      is_default: true,
    });

  // Campaign field mappings
  await supabase
    .from('salesforce_field_mappings')
    .insert({
      workspace_id: workspaceId,
      mapping_name: 'Default Campaign Mapping',
      salesforce_object: 'Campaign',
      local_object: 'campaign',
      field_mappings: [
        { local_field: 'name', salesforce_field: 'Name' },
        { local_field: 'description', salesforce_field: 'Description' },
        { local_field: 'status', salesforce_field: 'Status', transform: 'uppercase' },
        { local_field: 'created_at', salesforce_field: 'StartDate', transform: 'date' },
      ],
      is_active: true,
      is_default: true,
    });
}