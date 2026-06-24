-- Instagram accounts cache (page_access_token needed for sending DMs/replies)
CREATE TABLE IF NOT EXISTS ig_accounts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ig_user_id          text NOT NULL,
  ig_username         text,
  ig_name             text,
  profile_picture_url text,
  page_id             text NOT NULL,
  page_access_token   text NOT NULL,
  created_at          timestamptz DEFAULT now(),
  UNIQUE(tenant_id, ig_user_id)
);

CREATE INDEX IF NOT EXISTS ig_accounts_tenant ON ig_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS ig_accounts_ig_user ON ig_accounts(ig_user_id);

-- Automation flows
CREATE TABLE IF NOT EXISTS ig_flows (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             text NOT NULL,
  ig_user_id       text NOT NULL,
  ig_username      text,
  media_id         text,           -- NULL = qualquer post
  media_thumbnail  text,
  media_caption    text,
  trigger_type     text NOT NULL DEFAULT 'any',   -- 'any' | 'keyword'
  trigger_keywords text[] DEFAULT '{}',
  action_dm        boolean DEFAULT true,
  dm_message       text NOT NULL DEFAULT '',
  action_reply     boolean DEFAULT false,
  reply_message    text DEFAULT '',
  is_active        boolean DEFAULT true,
  executions       int DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ig_flows_tenant   ON ig_flows(tenant_id);
CREATE INDEX IF NOT EXISTS ig_flows_ig_user  ON ig_flows(ig_user_id);
CREATE INDEX IF NOT EXISTS ig_flows_active   ON ig_flows(ig_user_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE ig_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ig_flows     ENABLE ROW LEVEL SECURITY;

CREATE POLICY ig_accounts_tenant ON ig_accounts USING (
  tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
);
CREATE POLICY ig_flows_tenant ON ig_flows USING (
  tenant_id = (SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1)
);
