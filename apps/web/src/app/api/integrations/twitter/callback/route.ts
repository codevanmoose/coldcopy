import { NextRequest, NextResponse } from 'next/server';
import { twitterAuth, TwitterService } from '@/lib/integrations/twitter';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.redirect(
        new URL('/login', request.url)
      );
    }

    // Get OAuth tokens from query params
    const oauth_token = request.nextUrl.searchParams.get('oauth_token');
    const oauth_verifier = request.nextUrl.searchParams.get('oauth_verifier');

    if (!oauth_token || !oauth_verifier) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=twitter_auth_failed', request.url)
      );
    }

    // Get request token secret
    const oauth_token_secret = await twitterAuth.getRequestTokenSecret(oauth_token);
    if (!oauth_token_secret) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=twitter_auth_failed', request.url)
      );
    }

    // Exchange for access token
    const tokens = await twitterAuth.getAccessToken(
      oauth_token,
      oauth_token_secret,
      oauth_verifier
    );

    // Get user's workspace
    const { data: member } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return NextResponse.redirect(
        new URL('/settings/integrations?error=no_workspace', request.url)
      );
    }

    // Connect account
    await TwitterService.connectAccount(
      member.workspace_id,
      tokens.oauth_token,
      tokens.oauth_token_secret
    );

    return NextResponse.redirect(
      new URL('/settings/integrations?success=twitter_connected', request.url)
    );
  } catch (error) {
    console.error('Twitter callback error:', error);
    return NextResponse.redirect(
      new URL('/settings/integrations?error=twitter_connection_failed', request.url)
    );
  }
}