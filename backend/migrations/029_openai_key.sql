-- Chave OpenAI, usada só na função de geração de relatório (texto puro, sem tool-calling) —
-- mais barata que Claude pra esse caso específico. Fallback pro modelo Claude já configurado
-- se essa chave não for preenchida, então a migration por si só não muda nada em produção.
insert into platform_settings (key, value_encrypted) values
  ('openai_api_key', '')
on conflict (key) do nothing;
