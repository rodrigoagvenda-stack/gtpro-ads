-- Scope API keys to specific ad accounts (null = all accounts)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ad_account_ids TEXT[];
