-- Snapshot diário de seguidores por conta do Instagram. A Meta não expõe histórico de
-- follower_count além de uma janela recente, então essa tabela é a única forma de medir
-- crescimento ao longo do tempo (ex: seguidores ganhos durante uma iniciativa de conteúdo).
create table if not exists ig_follower_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  ig_user_id text not null,
  date date not null,
  followers_count integer not null,
  created_at timestamptz default now(),
  unique (tenant_id, ig_user_id, date)
);

create index if not exists ig_follower_history_tenant on ig_follower_history(tenant_id, ig_user_id);

alter table ig_follower_history enable row level security;

create policy ig_follower_history_tenant on ig_follower_history using (
  tenant_id = (select tenant_id from tenant_members where user_id = auth.uid() limit 1)
);
