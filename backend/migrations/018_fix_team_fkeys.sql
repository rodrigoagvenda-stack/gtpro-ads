-- Remove FK de invites.tenant_id (consistente com migration 004 que removeu FKs das outras tabelas)
ALTER TABLE invites DROP CONSTRAINT IF EXISTS invites_tenant_id_fkey;

-- Remove FK de tenant_members.tenant_id para permitir tenant_id = user.id (contas antigas)
ALTER TABLE tenant_members DROP CONSTRAINT IF EXISTS tenant_members_tenant_id_fkey;
