CREATE TABLE IF NOT EXISTS skills (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = plataforma (visível a todos)
  name        text NOT NULL,
  icon        text DEFAULT 'Zap',
  color       text DEFAULT 'violet',
  prompt      text NOT NULL,
  active      boolean DEFAULT true,
  is_default  boolean DEFAULT false,  -- true = criado pela plataforma
  ordem       int DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS skills_tenant ON skills (tenant_id);

-- Skills padrão da plataforma (tenant_id = NULL)
INSERT INTO skills (tenant_id, name, icon, color, prompt, is_default, ordem) VALUES
(NULL, 'Diagnóstico de KPIs', 'BarChart2', 'violet',
'Faça um diagnóstico completo dos KPIs da conta dos últimos 7 dias. Use get_account_insights e get_campaigns para obter os dados. Identifique os principais problemas e oportunidades. Seja direto, use listas, sem tabelas.',
true, 0),

(NULL, 'Analisar criativos', 'Image', 'blue',
'Liste os anúncios ativos e analise a performance de cada criativo. Use get_campaigns para listar campanhas ativas, depois get_ads para cada uma. Aponte criativos com CTR ou CPC fora do padrão e sugira o que testar.',
true, 1),

(NULL, 'Revisar copy', 'FileText', 'emerald',
'Busque os anúncios ativos com get_campaigns e get_ads. Para cada anúncio, avalie se o texto está claro, tem CTA forte e está alinhado com o objetivo. Sugira melhorias diretas para cada um.',
true, 2),

(NULL, 'Público ideal', 'Users', 'amber',
'Use get_insights_breakdown com breakdown=age para analisar faixas etárias, depois placement para canais. Identifique qual segmento performa melhor e sugira ajustes de targeting com dados concretos.',
true, 3),

(NULL, 'Próxima ação', 'Zap', 'red',
'Com base nos dados atuais (use get_account_insights e get_campaigns), qual é a ação mais urgente que devo tomar hoje? Seja específico: uma recomendação principal com justificativa baseada em dados.',
true, 4)

ON CONFLICT DO NOTHING;
