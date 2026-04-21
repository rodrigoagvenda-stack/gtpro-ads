-- CAPI + deduplication + conversion tracking columns

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS converted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS conversion_value  numeric(10,2),
  ADD COLUMN IF NOT EXISTS capi_lead_sent    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capi_purchase_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dedup_key         text,
  ADD COLUMN IF NOT EXISTS ip_address        text;

-- Prevent duplicate leads (same email/phone + tenant within 24 h)
CREATE UNIQUE INDEX IF NOT EXISTS leads_dedup_key
  ON leads (tenant_id, dedup_key)
  WHERE dedup_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_converted
  ON leads (tenant_id, converted_at)
  WHERE converted_at IS NOT NULL;

-- Store pixel_id alongside the Meta access token for CAPI
ALTER TABLE meta_connections
  ADD COLUMN IF NOT EXISTS pixel_id text;
