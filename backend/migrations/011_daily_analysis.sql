-- Análise diária autônoma via WhatsApp
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS daily_analysis_enabled   boolean      DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_analysis_morning   integer      DEFAULT 9,    -- hora no fuso BRT (UTC-3)
  ADD COLUMN IF NOT EXISTS daily_analysis_afternoon integer      DEFAULT 15,   -- hora no fuso BRT (UTC-3)
  ADD COLUMN IF NOT EXISTS user_name                text         DEFAULT '',
  ADD COLUMN IF NOT EXISTS whatsapp_number          text         DEFAULT '',
  ADD COLUMN IF NOT EXISTS alerts_whatsapp_enabled  boolean      DEFAULT false;
