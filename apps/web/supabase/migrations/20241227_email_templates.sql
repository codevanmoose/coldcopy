-- Create email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Template metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  thumbnail TEXT,
  
  -- Template content
  blocks JSONB NOT NULL DEFAULT '[]',
  variables TEXT[] DEFAULT '{}',
  styles JSONB NOT NULL DEFAULT '{"backgroundColor": "#ffffff", "fontFamily": "Arial, sans-serif", "maxWidth": "600px"}',
  subject VARCHAR(255) NOT NULL DEFAULT '',
  preview_text TEXT DEFAULT '',
  
  -- Template settings
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_email_templates_workspace_id ON email_templates(workspace_id);
CREATE INDEX idx_email_templates_created_by ON email_templates(created_by);
CREATE INDEX idx_email_templates_category ON email_templates(category);
CREATE INDEX idx_email_templates_is_public ON email_templates(is_public);
CREATE INDEX idx_email_templates_tags ON email_templates USING GIN(tags);
CREATE INDEX idx_email_templates_updated_at ON email_templates(updated_at DESC);

-- Add full-text search index
CREATE INDEX idx_email_templates_search ON email_templates USING GIN(
  to_tsvector('english', name || ' ' || COALESCE(description, ''))
);

-- Enable RLS
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view templates in their workspace or public templates" ON email_templates
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    ) OR is_public = true
  );

CREATE POLICY "Users can insert templates in their workspace" ON email_templates
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Users can update templates they created in their workspace" ON email_templates
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Users can delete templates they created in their workspace" ON email_templates
  FOR DELETE USING (
    workspace_id IN (
      SELECT workspace_id FROM user_profiles 
      WHERE user_id = auth.uid()
    ) AND created_by = auth.uid()
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER trigger_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_templates_updated_at();

-- Insert default templates
INSERT INTO email_templates (
  workspace_id,
  created_by,
  name,
  description,
  category,
  blocks,
  variables,
  subject,
  preview_text,
  is_public,
  tags
) VALUES 
-- Get the first workspace (for demo purposes)
(
  (SELECT id FROM workspaces LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  'Cold Outreach - SaaS Introduction',
  'Perfect template for introducing your SaaS product to potential customers',
  'Cold Outreach',
  '[
    {
      "id": "1",
      "type": "heading",
      "content": "Hi {{first_name}},",
      "styles": {
        "fontSize": "24px",
        "fontWeight": "bold",
        "color": "#333333",
        "textAlign": "left",
        "margin": "0 0 20px 0"
      }
    },
    {
      "id": "2",
      "type": "text",
      "content": "I noticed that {{company}} is in the {{industry}} space, and I thought you might be interested in how we''ve helped similar companies increase their efficiency by 40%.",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 20px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "3",
      "type": "text",
      "content": "Our platform helps {{industry}} companies like yours automate repetitive tasks and focus on what matters most - growing your business.",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 20px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "4",
      "type": "text",
      "content": "Would you be open to a quick 15-minute call this week to see if this could help {{company}} as well?",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 30px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "5",
      "type": "button",
      "content": "Schedule a Call",
      "styles": {
        "backgroundColor": "#007bff",
        "color": "#ffffff",
        "padding": "12px 24px",
        "borderRadius": "6px",
        "textAlign": "center",
        "fontSize": "16px",
        "fontWeight": "bold"
      },
      "metadata": {
        "buttonText": "Schedule a Call",
        "linkUrl": "https://calendly.com/your-link"
      }
    },
    {
      "id": "6",
      "type": "text",
      "content": "Best regards,<br>{{sender_name}}",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "30px 0 0 0",
        "lineHeight": "1.6"
      }
    }
  ]'::jsonb,
  '{"first_name", "company", "industry", "sender_name"}',
  'Quick question about {{company}}',
  'Helping {{industry}} companies increase efficiency...',
  true,
  '{"saas", "introduction", "b2b", "cold-outreach"}'
),
(
  (SELECT id FROM workspaces LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  'Follow-up - No Response',
  'Gentle follow-up template for prospects who haven''t responded to your initial outreach',
  'Follow-up',
  '[
    {
      "id": "1",
      "type": "heading",
      "content": "Hi {{first_name}},",
      "styles": {
        "fontSize": "24px",
        "fontWeight": "bold",
        "color": "#333333",
        "textAlign": "left",
        "margin": "0 0 20px 0"
      }
    },
    {
      "id": "2",
      "type": "text",
      "content": "I wanted to follow up on my previous email about {{previous_topic}}.",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 20px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "3",
      "type": "text",
      "content": "I understand you''re probably busy, but I thought this might be worth a quick conversation given the potential impact on {{company}}.",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 20px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "4",
      "type": "text",
      "content": "Would you prefer a brief call or should I send you some additional information instead?",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 30px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "5",
      "type": "text",
      "content": "Best,<br>{{sender_name}}",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0",
        "lineHeight": "1.6"
      }
    }
  ]'::jsonb,
  '{"first_name", "previous_topic", "company", "sender_name"}',
  'Following up - {{previous_topic}}',
  'Quick follow-up on our previous conversation...',
  true,
  '{"follow-up", "gentle", "reminder", "no-response"}'
),
(
  (SELECT id FROM workspaces LIMIT 1),
  (SELECT id FROM auth.users LIMIT 1),
  'Meeting Request - Product Demo',
  'Professional template for requesting product demonstration meetings',
  'Meeting Request',
  '[
    {
      "id": "1",
      "type": "heading",
      "content": "Hi {{first_name}},",
      "styles": {
        "fontSize": "24px",
        "fontWeight": "bold",
        "color": "#333333",
        "textAlign": "left",
        "margin": "0 0 20px 0"
      }
    },
    {
      "id": "2",
      "type": "text",
      "content": "I''d love to show you how our solution can help {{company}} {{specific_benefit}}.",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 20px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "3",
      "type": "text",
      "content": "The demo takes about {{demo_duration}} and I can tailor it specifically to your {{industry}} use case.",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 20px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "4",
      "type": "text",
      "content": "Are you available for a quick call this week? I have some time slots available:",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 15px 0",
        "lineHeight": "1.6"
      }
    },
    {
      "id": "5",
      "type": "text",
      "content": "• Tuesday at 2 PM<br>• Wednesday at 10 AM<br>• Friday at 3 PM",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "0 0 30px 0",
        "lineHeight": "1.8"
      }
    },
    {
      "id": "6",
      "type": "button",
      "content": "Book a Time",
      "styles": {
        "backgroundColor": "#28a745",
        "color": "#ffffff",
        "padding": "12px 24px",
        "borderRadius": "6px",
        "textAlign": "center",
        "fontSize": "16px",
        "fontWeight": "bold"
      },
      "metadata": {
        "buttonText": "Book a Time",
        "linkUrl": "https://calendly.com/your-demo-link"
      }
    },
    {
      "id": "7",
      "type": "text",
      "content": "Looking forward to connecting!<br><br>{{sender_name}}",
      "styles": {
        "fontSize": "16px",
        "color": "#555555",
        "textAlign": "left",
        "margin": "30px 0 0 0",
        "lineHeight": "1.6"
      }
    }
  ]'::jsonb,
  '{"first_name", "company", "specific_benefit", "demo_duration", "industry", "sender_name"}',
  '{{demo_duration}} demo for {{company}}?',
  'Quick product demo tailored for {{industry}}...',
  true,
  '{"meeting", "demo", "calendar", "product-demo"}'
);

-- Add some usage stats to make templates look more realistic
UPDATE email_templates SET usage_count = 156 WHERE name = 'Cold Outreach - SaaS Introduction';
UPDATE email_templates SET usage_count = 243 WHERE name = 'Follow-up - No Response';
UPDATE email_templates SET usage_count = 89 WHERE name = 'Meeting Request - Product Demo';