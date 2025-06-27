-- Token packages table
CREATE TABLE IF NOT EXISTS token_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tokens INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  stripe_price_id TEXT,
  is_active BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  features JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default token packages
INSERT INTO token_packages (name, description, tokens, price_cents, features, is_popular) VALUES
  ('Starter Pack', 'Perfect for trying out AI features', 10000, 1000, '["~40 emails", "No expiration", "Basic support"]', false),
  ('Growth Pack', 'Most popular for growing teams', 50000, 4500, '["~200 emails", "No expiration", "Priority support", "10% bonus tokens"]', true),
  ('Scale Pack', 'Best value for high-volume outreach', 250000, 20000, '["~1,000 emails", "No expiration", "Dedicated support", "25% bonus tokens"]', false);

-- Token purchases table
CREATE TABLE IF NOT EXISTS token_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id UUID REFERENCES token_packages(id),
  tokens INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  stripe_invoice_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'refunded')),
  payment_method TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Token transactions table (for tracking all token movements)
CREATE TABLE IF NOT EXISTS token_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'usage', 'refund', 'adjustment', 'grant')),
  amount INTEGER NOT NULL, -- positive for credits, negative for debits
  balance_after INTEGER NOT NULL,
  description TEXT,
  reference_type TEXT, -- 'ai_generation', 'purchase', etc.
  reference_id UUID, -- ID of related record
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_token_purchases_workspace ON token_purchases(workspace_id);
CREATE INDEX idx_token_purchases_status ON token_purchases(status);
CREATE INDEX idx_token_purchases_created_at ON token_purchases(created_at DESC);

CREATE INDEX idx_token_transactions_workspace ON token_transactions(workspace_id);
CREATE INDEX idx_token_transactions_type ON token_transactions(type);
CREATE INDEX idx_token_transactions_created_at ON token_transactions(created_at DESC);

-- Enable RLS
ALTER TABLE token_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for token_packages (public read)
CREATE POLICY "Anyone can view active token packages" ON token_packages
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for token_purchases
CREATE POLICY "Users can view their workspace token purchases" ON token_purchases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.workspace_id = token_purchases.workspace_id
    )
  );

CREATE POLICY "Workspace admins can manage token purchases" ON token_purchases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.workspace_id = token_purchases.workspace_id
      AND users.role IN ('workspace_admin', 'super_admin')
    )
  );

-- RLS Policies for token_transactions
CREATE POLICY "Users can view their workspace token transactions" ON token_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.workspace_id = token_transactions.workspace_id
    )
  );

-- Function to record token transaction
CREATE OR REPLACE FUNCTION record_token_transaction(
  p_workspace_id UUID,
  p_user_id UUID,
  p_type TEXT,
  p_amount INTEGER,
  p_description TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Get current balance
  SELECT ai_tokens_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id;
  
  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;
  
  -- Insert transaction record
  INSERT INTO token_transactions (
    workspace_id,
    user_id,
    type,
    amount,
    balance_after,
    description,
    reference_type,
    reference_id,
    metadata
  ) VALUES (
    p_workspace_id,
    p_user_id,
    p_type,
    p_amount,
    v_new_balance,
    p_description,
    p_reference_type,
    p_reference_id,
    p_metadata
  ) RETURNING id INTO v_transaction_id;
  
  -- Update workspace balance
  UPDATE workspaces
  SET 
    ai_tokens_balance = v_new_balance,
    updated_at = NOW()
  WHERE id = p_workspace_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql;