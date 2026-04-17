alter table tenants enable row level security;
alter table tenant_members enable row level security;
alter table meta_connections enable row level security;
alter table agent_configs enable row level security;
alter table agent_logs enable row level security;
alter table alerts enable row level security;
alter table api_keys enable row level security;

create or replace function public.current_tenant_id()
returns uuid language plpgsql stable security definer as $$
begin
  return (
    current_setting('request.jwt.claims', true)::jsonb
    -> 'app_metadata'
    ->> 'tenant_id'
  )::uuid;
end;
$$;

create policy "tenant_isolation" on tenants
  using (id = public.current_tenant_id());

create policy "tenant_isolation" on tenant_members
  using (tenant_id = public.current_tenant_id());

create policy "tenant_isolation" on meta_connections
  using (tenant_id = public.current_tenant_id());

create policy "tenant_isolation" on agent_configs
  using (tenant_id = public.current_tenant_id());

create policy "tenant_isolation" on agent_logs
  using (tenant_id = public.current_tenant_id());

create policy "tenant_isolation" on alerts
  using (tenant_id = public.current_tenant_id());

create policy "tenant_isolation" on api_keys
  using (tenant_id = public.current_tenant_id());
