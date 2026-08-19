-- Memória longa: perfil compacto e estático do negócio do cliente (o que vende, público-alvo,
-- proposta), sempre injetado no system prompt do agente sem crescer com o histórico de chat.
-- Diferente de agent_configs (regras operacionais: ROAS mín, CPL máx etc) e de chat_messages
-- (histórico conversacional, que agora é cortado nas últimas ~30 mensagens por turno).
alter table agent_configs
  add column if not exists business_profile text;
