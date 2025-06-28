import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_preview: string; // First 8 chars of the key
  key_hash: string; // SHA-256 hash of the key
  scopes: string[];
  expires_at?: string;
  last_used_at?: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // Full API key (only returned on creation)
}

export class ApiKeyManager {
  private static readonly KEY_PREFIX = 'cc_';
  private static readonly KEY_LENGTH = 32;

  /**
   * Generate a new API key
   */
  static generateApiKey(): string {
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH);
    const key = randomBytes.toString('base64url');
    return `${this.KEY_PREFIX}${key}`;
  }

  /**
   * Hash an API key for storage
   */
  static hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Get key preview (first 8 characters)
   */
  static getKeyPreview(key: string): string {
    return key.substring(0, 8) + '...';
  }

  /**
   * Create a new API key
   */
  static async createApiKey({
    workspaceId,
    name,
    scopes,
    expiresIn,
    userId,
  }: {
    workspaceId: string;
    name: string;
    scopes: string[];
    expiresIn?: number; // Days until expiration
    userId: string;
  }): Promise<ApiKeyWithSecret> {
    const supabase = createClient();
    
    // Generate the key
    const key = this.generateApiKey();
    const keyHash = this.hashApiKey(key);
    const keyPreview = this.getKeyPreview(key);
    
    // Calculate expiration
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Store in database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        workspace_id: workspaceId,
        name,
        key_preview: keyPreview,
        key_hash: keyHash,
        scopes,
        expires_at: expiresAt,
        created_by: userId,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create API key: ${error.message}`);
    }

    // Log the creation
    await supabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      user_id: userId,
      action: 'api_key.create',
      resource_type: 'api_key',
      resource_id: data.id,
      metadata: {
        name,
        scopes,
        expires_at: expiresAt,
      },
    });

    return {
      ...data,
      key, // Include the full key only on creation
    };
  }

  /**
   * Validate an API key
   */
  static async validateApiKey(
    key: string
  ): Promise<{ valid: boolean; apiKey?: ApiKey; error?: string }> {
    const supabase = createClient();
    
    // Check key format
    if (!key.startsWith(this.KEY_PREFIX)) {
      return { valid: false, error: 'Invalid key format' };
    }

    // Hash the provided key
    const keyHash = this.hashApiKey(key);

    // Look up the key
    const { data: apiKey, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Check expiration
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKey.id);

    return { valid: true, apiKey };
  }

  /**
   * Check if API key has required scope
   */
  static hasScope(apiKey: ApiKey, requiredScope: string): boolean {
    // Check for wildcard scope
    if (apiKey.scopes.includes('*')) {
      return true;
    }

    // Check for exact scope
    if (apiKey.scopes.includes(requiredScope)) {
      return true;
    }

    // Check for parent scope (e.g., 'leads' includes 'leads.read')
    const scopeParts = requiredScope.split('.');
    for (let i = scopeParts.length; i > 0; i--) {
      const parentScope = scopeParts.slice(0, i).join('.');
      if (apiKey.scopes.includes(parentScope)) {
        return true;
      }
    }

    return false;
  }

  /**
   * List API keys for a workspace
   */
  static async listApiKeys(workspaceId: string): Promise<ApiKey[]> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list API keys: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(keyId: string, userId: string): Promise<void> {
    const supabase = createClient();
    
    // Get the key details first
    const { data: apiKey } = await supabase
      .from('api_keys')
      .select('workspace_id, name')
      .eq('id', keyId)
      .single();

    // Update the key
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', keyId);

    if (error) {
      throw new Error(`Failed to revoke API key: ${error.message}`);
    }

    // Log the revocation
    if (apiKey) {
      await supabase.from('audit_logs').insert({
        workspace_id: apiKey.workspace_id,
        user_id: userId,
        action: 'api_key.revoke',
        resource_type: 'api_key',
        resource_id: keyId,
        metadata: {
          name: apiKey.name,
        },
      });
    }
  }

  /**
   * Update API key (name, scopes, expiration)
   */
  static async updateApiKey(
    keyId: string,
    updates: {
      name?: string;
      scopes?: string[];
      expires_at?: string | null;
    },
    userId: string
  ): Promise<ApiKey> {
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('api_keys')
      .update(updates)
      .eq('id', keyId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update API key: ${error.message}`);
    }

    // Log the update
    await supabase.from('audit_logs').insert({
      workspace_id: data.workspace_id,
      user_id: userId,
      action: 'api_key.update',
      resource_type: 'api_key',
      resource_id: keyId,
      metadata: {
        updates,
      },
    });

    return data;
  }
}

// Available API scopes
export const API_SCOPES = {
  // Full access
  ALL: '*',
  
  // Lead management
  LEADS_READ: 'leads.read',
  LEADS_WRITE: 'leads.write',
  LEADS_DELETE: 'leads.delete',
  LEADS_IMPORT: 'leads.import',
  LEADS_EXPORT: 'leads.export',
  LEADS_ENRICH: 'leads.enrich',
  
  // Campaign management
  CAMPAIGNS_READ: 'campaigns.read',
  CAMPAIGNS_WRITE: 'campaigns.write',
  CAMPAIGNS_DELETE: 'campaigns.delete',
  CAMPAIGNS_SEND: 'campaigns.send',
  
  // Email management
  EMAIL_SEND: 'email.send',
  EMAIL_READ: 'email.read',
  EMAIL_TRACK: 'email.track',
  
  // Analytics
  ANALYTICS_READ: 'analytics.read',
  
  // Workspace management
  WORKSPACE_READ: 'workspace.read',
  WORKSPACE_WRITE: 'workspace.write',
  WORKSPACE_MEMBERS: 'workspace.members',
  
  // Billing
  BILLING_READ: 'billing.read',
  BILLING_WRITE: 'billing.write',
  
  // Webhooks
  WEBHOOKS_READ: 'webhooks.read',
  WEBHOOKS_WRITE: 'webhooks.write',
} as const;

// Scope groups for UI
export const SCOPE_GROUPS = {
  'Lead Management': [
    { value: API_SCOPES.LEADS_READ, label: 'View leads' },
    { value: API_SCOPES.LEADS_WRITE, label: 'Create and update leads' },
    { value: API_SCOPES.LEADS_DELETE, label: 'Delete leads' },
    { value: API_SCOPES.LEADS_IMPORT, label: 'Import leads' },
    { value: API_SCOPES.LEADS_EXPORT, label: 'Export leads' },
    { value: API_SCOPES.LEADS_ENRICH, label: 'Enrich leads' },
  ],
  'Campaign Management': [
    { value: API_SCOPES.CAMPAIGNS_READ, label: 'View campaigns' },
    { value: API_SCOPES.CAMPAIGNS_WRITE, label: 'Create and update campaigns' },
    { value: API_SCOPES.CAMPAIGNS_DELETE, label: 'Delete campaigns' },
    { value: API_SCOPES.CAMPAIGNS_SEND, label: 'Send campaigns' },
  ],
  'Email': [
    { value: API_SCOPES.EMAIL_SEND, label: 'Send emails' },
    { value: API_SCOPES.EMAIL_READ, label: 'Read email data' },
    { value: API_SCOPES.EMAIL_TRACK, label: 'Track email events' },
  ],
  'Analytics': [
    { value: API_SCOPES.ANALYTICS_READ, label: 'View analytics' },
  ],
  'Workspace': [
    { value: API_SCOPES.WORKSPACE_READ, label: 'View workspace data' },
    { value: API_SCOPES.WORKSPACE_WRITE, label: 'Update workspace settings' },
    { value: API_SCOPES.WORKSPACE_MEMBERS, label: 'Manage team members' },
  ],
  'Billing': [
    { value: API_SCOPES.BILLING_READ, label: 'View billing information' },
    { value: API_SCOPES.BILLING_WRITE, label: 'Update billing settings' },
  ],
  'Webhooks': [
    { value: API_SCOPES.WEBHOOKS_READ, label: 'View webhooks' },
    { value: API_SCOPES.WEBHOOKS_WRITE, label: 'Manage webhooks' },
  ],
};