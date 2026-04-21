-- Campaign naming template
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS campaign_naming_template text;

-- Media library
CREATE TABLE IF NOT EXISTS media_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  type          text NOT NULL CHECK (type IN ('image', 'video')),
  meta_hash     text,
  meta_video_id text,
  file_size     bigint,
  width         int,
  height        int,
  duration_s    numeric(8,2),
  thumbnail_url text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_assets_tenant ON media_assets (tenant_id, created_at DESC);

ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'media_assets' AND policyname = 'tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON media_assets
      USING (tenant_id = (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;

-- api_usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period        text NOT NULL,           -- YYYY-MM
  input_tokens  bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  calls         int NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, period)
);

CREATE INDEX IF NOT EXISTS api_usage_tenant_period ON api_usage (tenant_id, period);

-- Tenant active flag (for CRM integration)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS blocked_reason text;

-- Upsert helper for api_usage called from the agent
CREATE OR REPLACE FUNCTION increment_api_usage(
  p_tenant_id     uuid,
  p_period        text,
  p_input_tokens  bigint,
  p_output_tokens bigint
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO api_usage (tenant_id, period, input_tokens, output_tokens, calls, updated_at)
  VALUES (p_tenant_id, p_period, p_input_tokens, p_output_tokens, 1, now())
  ON CONFLICT (tenant_id, period)
  DO UPDATE SET
    input_tokens  = api_usage.input_tokens  + p_input_tokens,
    output_tokens = api_usage.output_tokens + p_output_tokens,
    calls         = api_usage.calls + 1,
    updated_at    = now();
END;
$$;
