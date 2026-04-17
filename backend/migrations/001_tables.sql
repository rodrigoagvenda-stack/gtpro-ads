drop table if exists api_keys cascade;
drop table if exists alerts cascade;
drop table if exists agent_logs cascade;
drop table if exists agent_configs cascade;
drop table if exists meta_connections cascade;
drop table if exists tenant_members cascade;
drop table if exists tenants cascade;

create table tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  segmento text not null,
  created_at timestamptz default now()
);

create table tenant_members (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz default now()
);

create table meta_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  access_token_encrypted text not null,
  ad_account_id text,
  expires_at timestamptz,
  active boolean default true,
  created_at timestamptz default now(),
  unique (tenant_id)
);

create table agent_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  objetivo_principal text default 'conversoes',
  roas_minimo numeric(10,2),
  cpl_maximo numeric(10,2),
  cpa_maximo numeric(10,2),
  budget_mensal numeric(10,2),
  agente_horario_inicio time default '08:00',
  agente_horario_fim time default '22:00',
  limite_budget_sem_aprovacao numeric(10,2) default 50.00,
  modo_supervisionado boolean default true,
  updated_at timestamptz default now(),
  unique (tenant_id)
);

create table agent_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  action text not null,
  params jsonb default '{}',
  result jsonb,
  justification text,
  status text not null,
  created_at timestamptz default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  type text not null,
  message text not null,
  campaign_id text,
  status text default 'active',
  created_at timestamptz default now()
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  scope text not null default 'read',
  active boolean default true,
  created_at timestamptz default now()
);

create index idx_agent_logs_tenant_created on agent_logs(tenant_id, created_at desc);
create index idx_alerts_tenant_status on alerts(tenant_id, status);
create index idx_api_keys_hash on api_keys(key_hash);
create index idx_tenant_members_tenant on tenant_members(tenant_id);
