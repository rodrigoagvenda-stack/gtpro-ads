-- Allow OAuth flows to redirect back to external apps (e.g. Zaapply)
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS redirect_back TEXT;
