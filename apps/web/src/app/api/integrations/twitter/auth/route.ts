import { NextRequest, NextResponse } from 'next/server';
import { twitterAuth } from '@/lib/integrations/twitter';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get workspace ID from query params
    const workspaceId = request.nextUrl.searchParams.get('workspace_id');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      );
    }

    // Step 1: Get request token
    const { oauth_token, oauth_token_secret } = await twitterAuth.getRequestToken();

    // Store request token secret temporarily
    await twitterAuth.storeRequestToken(oauth_token, oauth_token_secret);

    // Generate authorization URL
    const authUrl = twitterAuth.getAuthorizationUrl(oauth_token);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Twitter auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize Twitter authentication' },
      { status: 500 }
    );
  }
}