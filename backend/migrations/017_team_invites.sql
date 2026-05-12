-- Tabela de convites para novos membros da equipe
CREATE TABLE IF NOT EXISTS invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at timestamptz,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_invites_token     ON invites(token);
CREATE INDEX idx_invites_tenant    ON invites(tenant_id);
CREATE INDEX idx_invites_email     ON invites(email);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

-- Membros autenticados só veem convites do próprio tenant
CREATE POLICY "tenant_isolation" ON invites
  USING (tenant_id = public.current_tenant_id());
