-- =============================================================
-- GTPRO Migration 004
-- Simplifica o schema: tenant_id = auth.users.id diretamente
-- Remove FK constraints que bloqueavam inserts
-- Cria tabelas reports e oauth_states que estavam faltando
-- =============================================================

-- 1. Remover FK constraints de tenant_id (era referência para tenants.id)
--    O código usa user.id direto como tenant_id, sem a tabela intermediária

ALTER TABLE meta_connections   DROP CONSTRAINT IF EXISTS meta_connections_tenant_id_fkey;
ALTER TABLE agent_configs      DROP CONSTRAINT IF EXISTS agent_configs_tenant_id_fkey;
ALTER TABLE agent_logs         DROP CONSTRAINT IF EXISTS agent_logs_tenant_id_fkey;
ALTER TABLE alerts             DROP CONSTRAINT IF EXISTS alerts_tenant_id_fkey;
ALTER TABLE api_keys           DROP CONSTRAINT IF EXISTS api_keys_tenant_id_fkey;

-- 2. Colunas faltando
ALTER TABLE meta_connections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE agent_configs    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Criar tabela reports (não existia)
CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL,
  title        TEXT NOT NULL,
  period       TEXT,
  summary      TEXT,
  generated_by TEXT DEFAULT 'agent',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_tenant ON reports(tenant_id, created_at DESC);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tenant_isolation" ON reports
  USING (tenant_id = public.current_tenant_id());

-- 4. Criar tabela oauth_states (não existia)
CREATE TABLE IF NOT EXISTS oauth_states (
  state      TEXT PRIMARY KEY,
  tenant_id  UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
-- Acesso apenas via service role no backend (sem política de usuário)
