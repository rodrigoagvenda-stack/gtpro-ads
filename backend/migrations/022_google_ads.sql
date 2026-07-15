-- Google Ads credentials em platform_settings
INSERT INTO platform_settings (key, value_encrypted) VALUES
  ('google_client_id', ''),
  ('google_client_secret', ''),
  ('google_developer_token', '')
ON CONFLICT (key) DO NOTHING;

-- Conexões OAuth Google Ads por tenant (multi-conta via MCC)
CREATE TABLE IF NOT EXISTS google_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id             text NOT NULL,          -- ID da conta do cliente (sem hífens)
  customer_name           text,
  currency_code           text,
  access_token_encrypted  text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  manager_customer_id     text,                   -- MCC login_customer_id
  is_active               boolean DEFAULT false,
  active                  boolean DEFAULT true,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(tenant_id, customer_id)
);

CREATE INDEX IF NOT EXISTS google_connections_tenant ON google_connections(tenant_id);
CREATE INDEX IF NOT EXISTS google_connections_active ON google_connections(tenant_id, is_active) WHERE is_active = true;

-- oauth_states já existe — apenas adicionamos suporte a provider
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS provider text DEFAULT 'meta';
