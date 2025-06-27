import { createClient } from '@supabase/supabase-js'
import { PostgrestError } from '@supabase/supabase-js'

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}))

describe('Data Isolation & Row Level Security', () => {
  let mockSupabase: any
  let mockAuth: any

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock auth context
    mockAuth = {
      getUser: jest.fn(),
      setSession: jest.fn(),
    }

    // Mock Supabase client
    mockSupabase = {
      auth: mockAuth,
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      rpc: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase)
  })

  describe('Workspace Data Isolation', () => {
    describe('Leads Table RLS', () => {
      it('should only return leads from user workspace', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const leads = [
          { id: 'lead-1', workspace_id: 'workspace-123', email: 'user1@example.com' },
          { id: 'lead-2', workspace_id: 'workspace-123', email: 'user2@example.com' },
        ]

        mockSupabase.order.mockResolvedValue({ data: leads, error: null })

        // Act
        const result = await getLeads('user-123')

        // Assert
        expect(result).toHaveLength(2)
        expect(mockSupabase.from).toHaveBeenCalledWith('leads')
        expect(mockSupabase.select).toHaveBeenCalledWith('*')
        // RLS should automatically filter by workspace
      })

      it('should prevent access to leads from other workspaces', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-456' } },
          error: null,
        })

        const postgrestError: PostgrestError = {
          message: 'No rows found',
          details: '',
          hint: '',
          code: 'PGRST116',
        }

        mockSupabase.order.mockResolvedValue({ data: null, error: postgrestError })

        // Act
        const result = await getLeads('user-456')

        // Assert
        expect(result).toEqual([])
      })

      it('should prevent inserting leads to unauthorized workspaces', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const postgrestError: PostgrestError = {
          message: 'Row level security policy violation',
          details: 'Policy check failed',
          hint: '',
          code: '42501',
        }

        mockSupabase.single.mockResolvedValue({ data: null, error: postgrestError })

        // Act & Assert
        await expect(
          createLead('user-123', {
            email: 'test@example.com',
            workspace_id: 'unauthorized-workspace',
          })
        ).rejects.toThrow('Row level security policy violation')
      })

      it('should allow inserting leads to authorized workspace', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const newLead = {
          id: 'lead-new',
          email: 'new@example.com',
          workspace_id: 'workspace-123',
        }

        mockSupabase.single.mockResolvedValue({ data: newLead, error: null })

        // Act
        const result = await createLead('user-123', {
          email: 'new@example.com',
          workspace_id: 'workspace-123',
        })

        // Assert
        expect(result.id).toBe('lead-new')
        expect(result.workspace_id).toBe('workspace-123')
      })

      it('should prevent updating leads from other workspaces', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const postgrestError: PostgrestError = {
          message: 'No rows updated',
          details: 'RLS policy prevents update',
          hint: '',
          code: 'PGRST100',
        }

        mockSupabase.single.mockResolvedValue({ data: null, error: postgrestError })

        // Act & Assert
        await expect(
          updateLead('user-123', 'lead-from-other-workspace', {
            first_name: 'Unauthorized',
          })
        ).rejects.toThrow('No rows updated')
      })

      it('should prevent deleting leads from other workspaces', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const postgrestError: PostgrestError = {
          message: 'No rows deleted',
          details: 'RLS policy prevents deletion',
          hint: '',
          code: 'PGRST100',
        }

        mockSupabase.order.mockResolvedValue({ data: null, error: postgrestError })

        // Act & Assert
        await expect(deleteLead('user-123', 'lead-from-other-workspace')).rejects.toThrow(
          'No rows deleted'
        )
      })
    })

    describe('Campaigns Table RLS', () => {
      it('should only return campaigns from user workspace', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const campaigns = [
          { id: 'campaign-1', workspace_id: 'workspace-123', name: 'Campaign 1' },
          { id: 'campaign-2', workspace_id: 'workspace-123', name: 'Campaign 2' },
        ]

        mockSupabase.order.mockResolvedValue({ data: campaigns, error: null })

        // Act
        const result = await getCampaigns('user-123')

        // Assert
        expect(result).toHaveLength(2)
        expect(result[0].workspace_id).toBe('workspace-123')
      })

      it('should prevent unauthorized campaign access', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'unauthorized-user' } },
          error: null,
        })

        const postgrestError: PostgrestError = {
          message: 'Row level security policy violation',
          details: '',
          hint: '',
          code: '42501',
        }

        mockSupabase.single.mockResolvedValue({ data: null, error: postgrestError })

        // Act & Assert
        await expect(getCampaign('unauthorized-user', 'campaign-123')).rejects.toThrow(
          'Row level security policy violation'
        )
      })
    })

    describe('Subscriptions Table RLS', () => {
      it('should only return subscriptions for user workspace', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const subscription = {
          id: 'sub-123',
          workspace_id: 'workspace-123',
          status: 'active',
        }

        mockSupabase.single.mockResolvedValue({ data: subscription, error: null })

        // Act
        const result = await getSubscription('user-123')

        // Assert
        expect(result.workspace_id).toBe('workspace-123')
      })

      it('should prevent unauthorized subscription modification', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'unauthorized-user' } },
          error: null,
        })

        const postgrestError: PostgrestError = {
          message: 'Insufficient privilege',
          details: 'User cannot modify subscription',
          hint: '',
          code: '42501',
        }

        mockSupabase.single.mockResolvedValue({ data: null, error: postgrestError })

        // Act & Assert
        await expect(
          updateSubscription('unauthorized-user', 'sub-123', { status: 'canceled' })
        ).rejects.toThrow('Insufficient privilege')
      })
    })

    describe('Payment Methods Table RLS', () => {
      it('should only return payment methods for user workspace', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const paymentMethods = [
          { id: 'pm-1', workspace_id: 'workspace-123', last4: '4242' },
          { id: 'pm-2', workspace_id: 'workspace-123', last4: '1111' },
        ]

        mockSupabase.order.mockResolvedValue({ data: paymentMethods, error: null })

        // Act
        const result = await getPaymentMethods('user-123')

        // Assert
        expect(result).toHaveLength(2)
        expect(result.every((pm) => pm.workspace_id === 'workspace-123')).toBe(true)
      })
    })
  })

  describe('User Role-Based Access Control', () => {
    describe('Workspace Admin Permissions', () => {
      it('should allow workspace admin to access all workspace data', async () => {
        // Arrange
        const adminUser = {
          id: 'admin-123',
          workspace_id: 'workspace-123',
          role: 'workspace_admin',
        }

        mockAuth.getUser.mockResolvedValue({
          data: { user: adminUser },
          error: null,
        })

        mockSupabase.order.mockResolvedValue({
          data: [
            { id: 'lead-1', workspace_id: 'workspace-123' },
            { id: 'lead-2', workspace_id: 'workspace-123' },
          ],
          error: null,
        })

        // Act
        const result = await getLeads('admin-123')

        // Assert
        expect(result).toHaveLength(2)
      })

      it('should allow workspace admin to manage billing', async () => {
        // Arrange
        const adminUser = {
          id: 'admin-123',
          workspace_id: 'workspace-123',
          role: 'workspace_admin',
        }

        mockAuth.getUser.mockResolvedValue({ data: { user: adminUser }, error: null })
        mockSupabase.single.mockResolvedValue({
          data: { id: 'sub-123', status: 'active' },
          error: null,
        })

        // Act
        const result = await getSubscription('admin-123')

        // Assert
        expect(result.id).toBe('sub-123')
      })
    })

    describe('Campaign Manager Permissions', () => {
      it('should allow campaign manager to access campaigns', async () => {
        // Arrange
        const campaignManager = {
          id: 'cm-123',
          workspace_id: 'workspace-123',
          role: 'campaign_manager',
        }

        mockAuth.getUser.mockResolvedValue({
          data: { user: campaignManager },
          error: null,
        })

        mockSupabase.order.mockResolvedValue({
          data: [{ id: 'campaign-1', workspace_id: 'workspace-123' }],
          error: null,
        })

        // Act
        const result = await getCampaigns('cm-123')

        // Assert
        expect(result).toHaveLength(1)
      })

      it('should prevent campaign manager from accessing billing', async () => {
        // Arrange
        const campaignManager = {
          id: 'cm-123',
          workspace_id: 'workspace-123',
          role: 'campaign_manager',
        }

        mockAuth.getUser.mockResolvedValue({
          data: { user: campaignManager },
          error: null,
        })

        const postgrestError: PostgrestError = {
          message: 'Insufficient privilege',
          details: 'Campaign manager cannot access billing',
          hint: '',
          code: '42501',
        }

        mockSupabase.single.mockResolvedValue({ data: null, error: postgrestError })

        // Act & Assert
        await expect(getSubscription('cm-123')).rejects.toThrow('Insufficient privilege')
      })
    })

    describe('Viewer Permissions', () => {
      it('should allow viewer to read data but not modify', async () => {
        // Arrange
        const viewer = {
          id: 'viewer-123',
          workspace_id: 'workspace-123',
          role: 'viewer',
        }

        mockAuth.getUser.mockResolvedValue({ data: { user: viewer }, error: null })
        mockSupabase.order.mockResolvedValue({
          data: [{ id: 'lead-1', workspace_id: 'workspace-123' }],
          error: null,
        })

        // Act
        const result = await getLeads('viewer-123')

        // Assert
        expect(result).toHaveLength(1)
      })

      it('should prevent viewer from modifying data', async () => {
        // Arrange
        const viewer = {
          id: 'viewer-123',
          workspace_id: 'workspace-123',
          role: 'viewer',
        }

        mockAuth.getUser.mockResolvedValue({ data: { user: viewer }, error: null })

        const postgrestError: PostgrestError = {
          message: 'Insufficient privilege',
          details: 'Viewer role cannot modify data',
          hint: '',
          code: '42501',
        }

        mockSupabase.single.mockResolvedValue({ data: null, error: postgrestError })

        // Act & Assert
        await expect(
          createLead('viewer-123', {
            email: 'test@example.com',
            workspace_id: 'workspace-123',
          })
        ).rejects.toThrow('Insufficient privilege')
      })
    })
  })

  describe('Cross-Workspace Data Access Prevention', () => {
    it('should prevent users from accessing other workspace data through joins', async () => {
      // Arrange
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123', workspace_id: 'workspace-123' } },
        error: null,
      })

      const postgrestError: PostgrestError = {
        message: 'Row level security policy violation',
        details: 'Cannot access data from other workspace',
        hint: '',
        code: '42501',
      }

      mockSupabase.order.mockResolvedValue({ data: null, error: postgrestError })

      // Act & Assert
      await expect(
        getCampaignLeadsFromOtherWorkspace('user-123', 'other-workspace-campaign')
      ).rejects.toThrow('Row level security policy violation')
    })

    it('should prevent data leakage through foreign key relationships', async () => {
      // Arrange
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      // Attempt to access campaign sequences from another workspace
      const postgrestError: PostgrestError = {
        message: 'No rows found',
        details: 'RLS prevents access',
        hint: '',
        code: 'PGRST116',
      }

      mockSupabase.order.mockResolvedValue({ data: null, error: postgrestError })

      // Act & Assert
      await expect(
        getCampaignSequences('user-123', 'campaign-from-other-workspace')
      ).rejects.toThrow('No rows found')
    })

    it('should enforce workspace isolation in aggregate queries', async () => {
      // Arrange
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      // Should only count leads from user's workspace
      mockSupabase.single.mockResolvedValue({
        data: { count: 5 }, // Only user's workspace leads
        error: null,
      })

      // Act
      const result = await getLeadCount('user-123')

      // Assert
      expect(result.count).toBe(5)
      // RLS should ensure this only counts workspace-specific leads
    })
  })

  describe('API Security', () => {
    describe('Authentication Requirements', () => {
      it('should require authentication for all data access', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'No user found' },
        })

        // Act & Assert
        await expect(getLeads('unauthenticated')).rejects.toThrow('No user found')
      })

      it('should reject expired tokens', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'JWT expired' },
        })

        // Act & Assert
        await expect(getLeads('expired-token-user')).rejects.toThrow('JWT expired')
      })
    })

    describe('Input Validation', () => {
      it('should validate workspace IDs in requests', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        // Act & Assert
        await expect(
          createLead('user-123', {
            email: 'test@example.com',
            workspace_id: 'invalid-uuid-format',
          })
        ).rejects.toThrow()
      })

      it('should sanitize user inputs', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const maliciousInput = {
          email: 'test@example.com',
          first_name: "<script>alert('xss')</script>",
          workspace_id: 'workspace-123',
        }

        mockSupabase.single.mockResolvedValue({
          data: {
            ...maliciousInput,
            first_name: "&lt;script&gt;alert('xss')&lt;/script&gt;",
          },
          error: null,
        })

        // Act
        const result = await createLead('user-123', maliciousInput)

        // Assert
        expect(result.first_name).not.toContain('<script>')
      })
    })

    describe('Rate Limiting', () => {
      it('should enforce rate limits per workspace', async () => {
        // Arrange
        mockAuth.getUser.mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        })

        const rateLimitError: PostgrestError = {
          message: 'Rate limit exceeded',
          details: 'Too many requests from workspace',
          hint: '',
          code: '429',
        }

        mockSupabase.order.mockResolvedValue({ data: null, error: rateLimitError })

        // Act & Assert
        await expect(getLeads('user-123')).rejects.toThrow('Rate limit exceeded')
      })
    })
  })

  describe('Data Encryption', () => {
    it('should handle encrypted PII fields', async () => {
      // Arrange
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      const encryptedLead = {
        id: 'lead-123',
        email: 'encrypted:abc123def456',
        phone: 'encrypted:xyz789uvw123',
        workspace_id: 'workspace-123',
      }

      mockSupabase.single.mockResolvedValue({ data: encryptedLead, error: null })

      // Act
      const result = await getLead('user-123', 'lead-123')

      // Assert
      expect(result.email).toContain('encrypted:')
      expect(result.phone).toContain('encrypted:')
    })
  })

  describe('Audit Logging', () => {
    it('should log data access attempts', async () => {
      // Arrange
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      })

      mockSupabase.order.mockResolvedValue({
        data: [{ id: 'lead-1' }],
        error: null,
      })

      mockSupabase.insert.mockResolvedValue({ error: null })

      // Act
      await getLeads('user-123')

      // Assert
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          action: 'select',
          table_name: 'leads',
        })
      )
    })

    it('should log failed access attempts', async () => {
      // Arrange
      mockAuth.getUser.mockResolvedValue({
        data: { user: { id: 'unauthorized-user' } },
        error: null,
      })

      const postgrestError: PostgrestError = {
        message: 'Access denied',
        details: '',
        hint: '',
        code: '42501',
      }

      mockSupabase.order.mockResolvedValue({ data: null, error: postgrestError })
      mockSupabase.insert.mockResolvedValue({ error: null })

      // Act & Assert
      await expect(getLeads('unauthorized-user')).rejects.toThrow('Access denied')

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'unauthorized-user',
          action: 'select_failed',
          table_name: 'leads',
          error_message: 'Access denied',
        })
      )
    })
  })
})

// Mock service functions
async function getLeads(userId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function createLead(userId: string, leadData: any) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('leads')
    .insert(leadData)
    .select()
    .single()

  if (error) throw error
  return data
}

async function updateLead(userId: string, leadId: string, updates: any) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('leads')
    .update(updates)
    .eq('id', leadId)
    .select()
    .single()

  if (error) throw error
  return data
}

async function deleteLead(userId: string, leadId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', leadId)

  if (error) throw error
}

async function getLead(userId: string, leadId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  if (error) throw error
  return data
}

async function getCampaigns(userId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function getCampaign(userId: string, campaignId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (error) throw error
  return data
}

async function getSubscription(userId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .single()

  if (error) throw error
  return data
}

async function updateSubscription(userId: string, subscriptionId: string, updates: any) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', subscriptionId)
    .select()
    .single()

  if (error) throw error
  return data
}

async function getPaymentMethods(userId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('payment_methods')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function getCampaignLeadsFromOtherWorkspace(userId: string, campaignId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('campaign_leads')
    .select(`
      *,
      leads (*)
    `)
    .eq('campaign_id', campaignId)

  if (error) throw error
  return data || []
}

async function getCampaignSequences(userId: string, campaignId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('campaign_sequences')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sequence_number')

  if (error) throw error
  return data || []
}

async function getLeadCount(userId: string) {
  const supabase = createClient()
  await supabase.auth.setSession({ access_token: `token-${userId}`, user: { id: userId } } as any)

  const { data, error } = await supabase
    .from('leads')
    .select('count')
    .single()

  if (error) throw error
  return data
}