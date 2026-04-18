-- WhatsApp platform config (stored in platform_settings)
INSERT INTO platform_settings (key, value_encrypted) VALUES
  ('whatsapp_provider', ''),        -- 'uazapi' | 'official'
  ('whatsapp_uazapi_url', ''),      -- base URL da instância UazAPI
  ('whatsapp_uazapi_key', ''),      -- API key UazAPI
  ('whatsapp_uazapi_instance', ''), -- nome da instância
  ('whatsapp_official_token', ''),  -- token API oficial Meta
  ('whatsapp_official_phone_id', '') -- Phone Number ID (API oficial)
ON CONFLICT (key) DO NOTHING;

-- Tenant WhatsApp number + notification preferences
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS whatsapp_number          text,
  ADD COLUMN IF NOT EXISTS alerts_whatsapp_enabled  boolean DEFAULT false;

-- Alert type preferences per tenant
CREATE TABLE IF NOT EXISTS alert_configs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  alert_type  text NOT NULL,
  enabled     boolean DEFAULT true,
  channels    text[] DEFAULT ARRAY['in_app'],  -- 'in_app', 'whatsapp'
  created_at  timestamptz DEFAULT now(),
  UNIQUE (tenant_id, alert_type)
);

CREATE INDEX IF NOT EXISTS alert_configs_tenant ON alert_configs (tenant_id);
