-- Onboarding flag
ALTER TABLE agent_configs
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;

-- Mark existing tenants as already onboarded (they pre-date this feature)
UPDATE agent_configs SET onboarding_completed = true;

-- Super-admin role for Rodrigo
UPDATE tenant_members
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@vendai.pro'
);
