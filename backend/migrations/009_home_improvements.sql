-- Report scheduling
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS report_schedule      text DEFAULT 'none',  -- 'none' | 'weekly' | 'monthly'
  ADD COLUMN IF NOT EXISTS report_whatsapp      boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS report_last_sent_at  timestamptz;

-- Multi-account Meta: remove unique constraint, add name + is_active
ALTER TABLE meta_connections
  DROP CONSTRAINT IF EXISTS meta_connections_tenant_id_key,
  ADD COLUMN IF NOT EXISTS name      text DEFAULT 'Conta principal',
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Only one active per tenant (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS meta_connections_active_tenant
  ON meta_connections (tenant_id) WHERE (is_active = true);
