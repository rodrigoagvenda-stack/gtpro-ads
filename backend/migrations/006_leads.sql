-- Leads capturados via webhook (integração com CRM / landing pages)
CREATE TABLE IF NOT EXISTS leads (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Dados do lead
  contact_name  text,
  email         text,
  whatsapp      text,
  company_name  text,

  -- Atribuição UTM
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,   -- ad set name
  utm_term      text,   -- ad / creative name
  fbclid        text,

  -- Contexto
  page_url      text,
  source        text DEFAULT 'webhook',  -- 'webhook', 'manual', 'meta_lead_form'
  metadata      jsonb DEFAULT '{}',

  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_tenant_created  ON leads (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_utm_campaign    ON leads (tenant_id, utm_campaign);

-- Token de webhook por tenant (coluna extra em agent_configs)
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS webhook_token text DEFAULT encode(gen_random_bytes(24), 'hex');
