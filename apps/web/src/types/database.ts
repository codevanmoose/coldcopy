export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          domain: string | null
          logo_url: string | null
          brand_color: string
          settings: Json
          status: 'active' | 'suspended' | 'cancelled' | 'trial'
          trial_ends_at: string | null
          subscription_id: string | null
          subscription_status: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          domain?: string | null
          logo_url?: string | null
          brand_color?: string
          settings?: Json
          status?: 'active' | 'suspended' | 'cancelled' | 'trial'
          trial_ends_at?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          domain?: string | null
          logo_url?: string | null
          brand_color?: string
          settings?: Json
          status?: 'active' | 'suspended' | 'cancelled' | 'trial'
          trial_ends_at?: string | null
          subscription_id?: string | null
          subscription_status?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          phone?: string | null
          timezone?: string
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
          is_default: boolean
          invited_by: string | null
          invited_at: string | null
          joined_at: string
          permissions: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
          is_default?: boolean
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string
          permissions?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
          is_default?: boolean
          invited_by?: string | null
          invited_at?: string | null
          joined_at?: string
          permissions?: Json
          created_at?: string
          updated_at?: string
        }
      }
      workspace_invitations: {
        Row: {
          id: string
          workspace_id: string
          email: string
          role: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
          token: string
          invited_by: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          role?: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
          token: string
          invited_by: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          role?: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
          token?: string
          invited_by?: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          workspace_id: string
          name: string
          key_prefix: string
          key_hash: string
          scopes: Json
          last_used_at: string | null
          expires_at: string | null
          created_by: string
          created_at: string
          revoked_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          key_prefix: string
          key_hash: string
          scopes?: Json
          last_used_at?: string | null
          expires_at?: string | null
          created_by: string
          created_at?: string
          revoked_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          key_prefix?: string
          key_hash?: string
          scopes?: Json
          last_used_at?: string | null
          expires_at?: string | null
          created_by?: string
          created_at?: string
          revoked_at?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          workspace_id: string
          user_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          metadata: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string | null
          action?: string
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_workspaces: {
        Args: {
          user_id: string
        }
        Returns: {
          workspace_id: string
          workspace_name: string
          workspace_slug: string
          role: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
          is_default: boolean
        }[]
      }
      check_user_permission: {
        Args: {
          p_user_id: string
          p_workspace_id: string
          p_permission: string
        }
        Returns: boolean
      }
    }
    Enums: {
      user_role: 'super_admin' | 'workspace_admin' | 'campaign_manager' | 'outreach_specialist'
      workspace_status: 'active' | 'suspended' | 'cancelled' | 'trial'
    }
  }
}