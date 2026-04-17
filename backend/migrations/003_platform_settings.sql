-- Configurações globais da plataforma (Anthropic key, Meta App credentials)
-- Só o dono da plataforma acessa — sem RLS (acesso via service role no backend)

create table if not exists platform_settings (
  key text primary key,
  value_encrypted text not null,
  updated_at timestamptz default now()
);

-- Seed com chaves vazias para aparecer no painel
insert into platform_settings (key, value_encrypted) values
  ('anthropic_api_key', ''),
  ('meta_app_id', ''),
  ('meta_app_secret', '')
on conflict (key) do nothing;
