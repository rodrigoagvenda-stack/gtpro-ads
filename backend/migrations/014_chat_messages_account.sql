-- Add ad_account_id to chat_messages for per-account chat isolation
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS ad_account_id text;

-- Index for efficient per-tenant, per-account history queries
CREATE INDEX IF NOT EXISTS chat_messages_account
  ON chat_messages (tenant_id, ad_account_id, created_at);

-- agent_logs: ensure table exists with useful columns
CREATE TABLE IF NOT EXISTS agent_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  action      text NOT NULL,
  params      jsonb,
  result      jsonb,
  status      text NOT NULL DEFAULT 'success',
  justification text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON agent_logs
  USING (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS agent_logs_tenant_created
  ON agent_logs (tenant_id, created_at DESC);
