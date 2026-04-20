-- WhatsApp agent conversation sessions (sem FK para evitar conflito de schema)
DROP TABLE IF EXISTS whatsapp_sessions;

CREATE TABLE whatsapp_sessions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone      text NOT NULL,
  tenant_id  uuid NOT NULL,
  step       text NOT NULL DEFAULT 'idle',
  context    jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (phone)
);

CREATE INDEX IF NOT EXISTS whatsapp_sessions_tenant ON whatsapp_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS whatsapp_sessions_phone  ON whatsapp_sessions (phone);
