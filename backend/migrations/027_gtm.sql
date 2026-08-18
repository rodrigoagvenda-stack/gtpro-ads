-- Conexões OAuth Google Tag Manager por tenant. Mesmo fluxo OAuth do Google
-- Ads/GA4 (escopos tagmanager.edit.containers + tagmanager.publish
-- adicionados ao mesmo pedido de consentimento).
CREATE TABLE IF NOT EXISTS gtm_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  account_id              text NOT NULL,
  account_name            text,
  container_id            text NOT NULL,
  container_name          text,
  public_id               text,   -- GTM-XXXXXXX, o ID usado no snippet do site
  access_token_encrypted  text NOT NULL,
  refresh_token_encrypted text NOT NULL,
  is_active               boolean DEFAULT false,
  active                  boolean DEFAULT true,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE(tenant_id, container_id)
);

CREATE INDEX IF NOT EXISTS gtm_connections_tenant ON gtm_connections(tenant_id);
CREATE INDEX IF NOT EXISTS gtm_connections_active ON gtm_connections(tenant_id, is_active) WHERE is_active = true;

ALTER TABLE client_ad_accounts ADD COLUMN IF NOT EXISTS gtm_connection_id uuid REFERENCES gtm_connections(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS client_ad_accounts_gtm_conn_unique
  ON client_ad_accounts(gtm_connection_id) WHERE gtm_connection_id IS NOT NULL;
