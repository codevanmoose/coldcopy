import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { LinkedInAuth } from '@/lib/integrations/linkedin/auth';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(cookieStore);
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    
    // Handle OAuth errors
    if (error) {
      console.error('LinkedIn OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=linkedin_auth_failed&message=${encodeURIComponent(errorDescription || error)}`
      );
    }
    
    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_callback`
      );
    }
    
    // Verify state token
    const { data: authState, error: stateError } = await supabase
      .from('auth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'linkedin')
      .single();
      
    if (stateError || !authState) {
      console.error('Invalid state token:', stateError);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_state`
      );
    }
    
    // Check if state is expired
    if (new Date(authState.expires_at) < new Date()) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=state_expired`
      );
    }
    
    // Delete used state
    await supabase
      .from('auth_states')
      .delete()
      .eq('id', authState.id);
    
    // Exchange code for tokens
    const tokens = await LinkedInAuth.exchangeCodeForTokens(code);
    
    // Get user profile
    const profile = await LinkedInAuth.getUserProfile(tokens.access_token);
    
    // Save integration
    await LinkedInAuth.saveIntegration(
      authState.workspace_id,
      tokens,
      profile
    );
    
    // Create success notification
    await supabase
      .from('notifications')
      .insert({
        workspace_id: authState.workspace_id,
        user_id: authState.user_id,
        type: 'integration_connected',
        title: 'LinkedIn Connected',
        message: `Successfully connected LinkedIn account for ${profile.name}`,
        metadata: {
          integration: 'linkedin',
          account_name: profile.name,
          account_email: profile.email,
        },
      });
    
    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=linkedin_connected`
    );
    
  } catch (error) {
    console.error('LinkedIn callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=connection_failed`
    );
  }
}