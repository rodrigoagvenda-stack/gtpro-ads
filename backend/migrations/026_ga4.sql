-- Conexões OAuth Google Analytics 4 por tenant. Reusa o mesmo fluxo OAuth do
-- Google Ads (mesmo Client ID/Secret, escopo analytics.readonly adicionado ao
-- mesmo pedido de consentimento) — token próprio guardado aqui porque um
-- tenant pode ter GA4 sem ter Google Ads conectado, ou vice-versa.
CREATE TABLE IF NOT EXISTS ga4_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  property_id             text NOT NULL,
  property_name           text,
  account_name            text,
  access_token_encrypted  text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  is_active               boolean DEFAULT false,
  active                  boolean DEFAULT true,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(tenant_id, property_id)
);

CREATE INDEX IF NOT EXISTS ga4_connections_tenant ON ga4_connections(tenant_id);
CREATE INDEX IF NOT EXISTS ga4_connections_active ON ga4_connections(tenant_id, is_active) WHERE is_active = true;

-- Vincula GA4 ao mesmo "cliente" que já une Meta + Google Ads.
ALTER TABLE client_ad_accounts ADD COLUMN IF NOT EXISTS ga4_connection_id uuid REFERENCES ga4_connections(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_ad_accounts_ga4_conn_unique
  ON client_ad_accounts(ga4_connection_id) WHERE ga4_connection_id IS NOT NULL;
