import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiKeyManager, API_SCOPES } from '@/lib/security/api-keys';
import { z } from 'zod';

// Schema for creating API key
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).min(1),
  expiresIn: z.number().optional(), // Days until expiration
  description: z.string().optional(),
  allowedIps: z.array(z.string().ip()).optional(),
});

// GET /api/workspace/api-keys - List API keys
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get workspace ID from query or user's default
    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      );
    }
    
    // Check permissions
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
    
    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    // List API keys
    const apiKeys = await ApiKeyManager.listApiKeys(workspaceId);
    
    // Get usage stats for each key
    const keysWithStats = await Promise.all(
      apiKeys.map(async (key) => {
        const { data: usageStats } = await supabase
          .from('api_key_usage')
          .select('count')
          .eq('api_key_id', key.id)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .single();
        
        return {
          ...key,
          usage_last_30_days: usageStats?.count || 0,
        };
      })
    );
    
    return NextResponse.json({
      apiKeys: keysWithStats,
      availableScopes: Object.values(API_SCOPES),
    });
  } catch (error) {
    console.error('List API keys error:', error);
    return NextResponse.json(
      { error: 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

// POST /api/workspace/api-keys - Create new API key
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const body = await request.json();
    const validation = createApiKeySchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const { name, scopes, expiresIn, description, allowedIps } = validation.data;
    const workspaceId = body.workspaceId;
    
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID required' },
        { status: 400 }
      );
    }
    
    // Check permissions
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
    
    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    // Validate scopes
    const validScopes = Object.values(API_SCOPES);
    const invalidScopes = scopes.filter(scope => !validScopes.includes(scope));
    if (invalidScopes.length > 0) {
      return NextResponse.json(
        { error: 'Invalid scopes', invalidScopes },
        { status: 400 }
      );
    }
    
    // Create API key
    const apiKey = await ApiKeyManager.createApiKey({
      workspaceId,
      name,
      scopes,
      expiresIn,
      userId: user.id,
    });
    
    // Add additional metadata if provided
    if (description || allowedIps) {
      await supabase
        .from('api_keys')
        .update({
          description,
          allowed_ips: allowedIps,
        })
        .eq('id', apiKey.id);
    }
    
    return NextResponse.json({
      apiKey: {
        ...apiKey,
        key: apiKey.key, // Only returned on creation
      },
      message: 'API key created successfully. Store the key securely as it won\'t be shown again.',
    });
  } catch (error) {
    console.error('Create API key error:', error);
    return NextResponse.json(
      { error: 'Failed to create API key' },
      { status: 500 }
    );
  }
}

// PATCH /api/workspace/api-keys/[id] - Update API key
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const keyId = url.pathname.split('/').pop();
    
    if (!keyId) {
      return NextResponse.json(
        { error: 'API key ID required' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { name, scopes, expires_at, description, allowedIps, is_active } = body;
    
    // Get the API key
    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('workspace_id')
      .eq('id', keyId)
      .single();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }
    
    // Check permissions
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', apiKey.workspace_id)
      .eq('user_id', user.id)
      .single();
    
    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    // Update API key
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (scopes !== undefined) updates.scopes = scopes;
    if (expires_at !== undefined) updates.expires_at = expires_at;
    if (description !== undefined) updates.description = description;
    if (allowedIps !== undefined) updates.allowed_ips = allowedIps;
    if (is_active !== undefined) updates.is_active = is_active;
    
    const updatedKey = await ApiKeyManager.updateApiKey(keyId, updates, user.id);
    
    return NextResponse.json({
      apiKey: updatedKey,
      message: 'API key updated successfully',
    });
  } catch (error) {
    console.error('Update API key error:', error);
    return NextResponse.json(
      { error: 'Failed to update API key' },
      { status: 500 }
    );
  }
}

// DELETE /api/workspace/api-keys/[id] - Revoke API key
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const url = new URL(request.url);
    const keyId = url.pathname.split('/').pop();
    
    if (!keyId) {
      return NextResponse.json(
        { error: 'API key ID required' },
        { status: 400 }
      );
    }
    
    // Get the API key
    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('workspace_id')
      .eq('id', keyId)
      .single();
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }
    
    // Check permissions
    const { data: member } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', apiKey.workspace_id)
      .eq('user_id', user.id)
      .single();
    
    if (!member || !['workspace_admin', 'super_admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
    
    // Revoke API key
    await ApiKeyManager.revokeApiKey(keyId, user.id);
    
    return NextResponse.json({
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}