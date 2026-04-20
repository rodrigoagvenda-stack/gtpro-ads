-- RLS para tabelas criadas após a migration inicial (002_rls.sql)
-- current_tenant_id() já existe e lê app_metadata.tenant_id do JWT

-- ─── chat_messages ────────────────────────────────────────────────────────────
-- tenant_id é text aqui; cast para uuid na comparação
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON chat_messages
  USING (tenant_id::uuid = public.current_tenant_id());

-- ─── leads ────────────────────────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON leads
  USING (tenant_id = public.current_tenant_id());

-- ─── skills ───────────────────────────────────────────────────────────────────
-- Skills de plataforma têm tenant_id NULL → visíveis para todos os tenants
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON skills
  USING (tenant_id IS NULL OR tenant_id = public.current_tenant_id());

-- ─── alert_configs ────────────────────────────────────────────────────────────
ALTER TABLE alert_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON alert_configs
  USING (tenant_id = public.current_tenant_id());

-- ─── whatsapp_sessions ────────────────────────────────────────────────────────
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON whatsapp_sessions
  USING (tenant_id = public.current_tenant_id());

-- ─── platform_settings ────────────────────────────────────────────────────────
-- Tabela global — nenhum usuário JWT acessa diretamente.
-- Somente service_role (que bypassa RLS) tem permissão.
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
-- sem policies = deny-all para JWTs de usuário
