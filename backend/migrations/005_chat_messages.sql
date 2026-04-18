CREATE TABLE IF NOT EXISTS chat_messages (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   text NOT NULL,
  role        text NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text NOT NULL,
  tools_used  jsonb,
  actions     jsonb,
  model       text,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_tenant_created ON chat_messages (tenant_id, created_at);
