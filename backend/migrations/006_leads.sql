-- Adiciona colunas UTM + tenant na tabela leads existente
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS tenant_id    uuid REFERENCES tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS utm_source   text,
  ADD COLUMN IF NOT EXISTS utm_medium   text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content  text,
  ADD COLUMN IF NOT EXISTS utm_term     text,
  ADD COLUMN IF NOT EXISTS fbclid       text,
  ADD COLUMN IF NOT EXISTS page_url     text,
  ADD COLUMN IF NOT EXISTS source       text DEFAULT 'webhook',
  ADD COLUMN IF NOT EXISTS metadata     jsonb DEFAULT '{}';

CREATE INDEX IF NOT EXISTS leads_tenant_created  ON leads (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_utm_campaign    ON leads (tenant_id, utm_campaign);

-- Token de webhook por tenant
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS webhook_token text DEFAULT encode(gen_random_bytes(24), 'hex');
