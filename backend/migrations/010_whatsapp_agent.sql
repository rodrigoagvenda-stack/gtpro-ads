-- WhatsApp agent conversation sessions
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone      text NOT NULL,
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step       text NOT NULL DEFAULT 'idle',
  context    jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS whatsapp_sessions_tenant ON whatsapp_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS whatsapp_sessions_phone  ON whatsapp_sessions (phone);
