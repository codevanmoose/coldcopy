import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PipedriveAuth } from '@/lib/integrations/pipedrive/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=missing_params`
      );
    }

    const supabase = createServerClient(cookies());

    // Verify state token
    const { data: authState } = await supabase
      .from('auth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'pipedrive')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!authState) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=invalid_state`
      );
    }

    // Delete used state
    await supabase
      .from('auth_states')
      .delete()
      .eq('state', state);

    // Exchange code for tokens
    const auth = new PipedriveAuth();
    const tokens = await auth.exchangeCodeForTokens(code);

    // Get company info
    const companyInfo = await auth.getCompanyInfo(tokens.access_token);

    // Save integration
    await auth.saveIntegration(
      authState.workspace_id,
      tokens,
      companyInfo.companyDomain
    );

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?success=pipedrive_connected`
    );
  } catch (error) {
    console.error('Pipedrive callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?error=connection_failed`
    );
  }
}