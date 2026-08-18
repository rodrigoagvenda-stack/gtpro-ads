-- Vincula uma conexão Meta Ads e uma conexão Google Ads como pertencentes ao mesmo
-- cliente da agência. Antes disso, o dropdown do header (Meta) e a lista de
-- "Contas conectadas" em Configurações → Google Ads eram seletores independentes
-- sem nenhuma relação — trocar um não trocava o outro, causando o agente reportar
-- nome de um cliente (Meta) junto com o ID de outro (Google).
--
-- is_active em meta_connections e google_connections continua sendo a fonte de
-- verdade lida pelo resto do código (getTokenAndAccount, getTokens, etc) — esta
-- tabela só coordena os dois em conjunto na hora de trocar o cliente ativo.
CREATE TABLE IF NOT EXISTS clients (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  meta_connection_id    uuid REFERENCES meta_connections(id) ON DELETE SET NULL,
  google_connection_id  uuid REFERENCES google_connections(id) ON DELETE SET NULL,
  is_active             boolean DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clients_tenant ON clients(tenant_id);

-- No máximo um cliente ativo por tenant
CREATE UNIQUE INDEX IF NOT EXISTS clients_active_tenant
  ON clients(tenant_id) WHERE (is_active = true);

-- Uma conexão Meta/Google só pode estar vinculada a um cliente por vez
CREATE UNIQUE INDEX IF NOT EXISTS clients_meta_conn_unique
  ON clients(meta_connection_id) WHERE meta_connection_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS clients_google_conn_unique
  ON clients(google_connection_id) WHERE google_connection_id IS NOT NULL;
