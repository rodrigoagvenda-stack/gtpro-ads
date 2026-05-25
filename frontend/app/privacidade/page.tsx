import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Política de Privacidade e Proteção de Dados — GTPRO",
  description: "Política de privacidade e proteção de dados pessoais da plataforma GTPRO, em conformidade com a LGPD (Lei 13.709/2018) e as políticas da Meta Platforms.",
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-white uppercase tracking-wide border-b border-white/10 pb-2">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-zinc-400">{children}</div>
    </section>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-zinc-300 font-medium mb-1">{title}</p>
      <div className="text-zinc-400">{children}</div>
    </div>
  )
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <Image src="/logo.png" alt="Grupo Venda" width={180} height={40} className="object-contain" />
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Voltar</Link>
        </div>

        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-white mb-1">Política de Privacidade e Proteção de Dados</h1>
          <p className="text-xs text-zinc-500">
            Versão 1.0 · Vigência: 01 de junho de 2026 · Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)
          </p>
        </div>

        {/* Aviso de destaque */}
        <div className="mb-10 p-4 rounded-lg border border-violet-500/20 bg-violet-500/5 text-xs text-zinc-400 leading-relaxed">
          Esta Política descreve como a <strong className="text-zinc-200">Grupo Venda Tecnologia</strong>, controladora da plataforma GTPRO
          (acessível em <strong className="text-zinc-200">gtpro.vendai.pro</strong>), coleta, usa, armazena, protege e compartilha dados
          pessoais, em conformidade com a LGPD, o Marco Civil da Internet (Lei nº 12.965/2014) e as Políticas da Meta Platforms.
          Ao usar a Plataforma, você declara ter lido, compreendido e concordado com os termos aqui dispostos.
        </div>

        <div className="space-y-10">

          <Section title="1. Identificação e qualificação das partes">
            <Sub title="Controladora de Dados">
              <p>
                <strong className="text-zinc-300">Grupo Venda Tecnologia</strong><br />
                Plataforma: GTPRO — gtpro.vendai.pro<br />
                E-mail do Encarregado (DPO): <a href="mailto:privacidade@vendai.pro" className="text-violet-400 hover:text-violet-300">privacidade@vendai.pro</a><br />
                A Controladora é responsável pelas decisões sobre o tratamento dos dados pessoais coletados por meio da Plataforma.
              </p>
            </Sub>
            <Sub title="Encarregado de Dados (DPO)">
              <p>
                Nos termos do art. 41 da LGPD, a Controladora designou um Encarregado de Proteção de Dados, responsável por:
                (i) aceitar reclamações e comunicações dos titulares; (ii) prestar esclarecimentos; e (iii) adotar providências.
                Contato: <a href="mailto:privacidade@vendai.pro" className="text-violet-400 hover:text-violet-300">privacidade@vendai.pro</a> — Resposta em até 15 dias úteis.
              </p>
            </Sub>
            <Sub title="Operadores">
              <p>
                Atuam como operadores de dados em nome da Controladora: Supabase Inc. (banco de dados e autenticação),
                Anthropic PBC (processamento de linguagem natural) e Meta Platforms Inc. (Marketing API).
                Cada operador processa os dados estritamente conforme instruções da Controladora e possui políticas de
                privacidade próprias que complementam esta.
              </p>
            </Sub>
          </Section>

          <Section title="2. Dados pessoais tratados e finalidade">
            <p>
              Tratamos apenas os dados estritamente necessários ao funcionamento da Plataforma,
              observando o princípio da minimização previsto no art. 6º, III, da LGPD.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2.5 pr-4 text-zinc-400 font-medium w-1/4">Categoria</th>
                    <th className="text-left py-2.5 pr-4 text-zinc-400 font-medium w-2/5">Dados coletados</th>
                    <th className="text-left py-2.5 text-zinc-400 font-medium">Finalidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-3 pr-4 text-zinc-300 align-top">Cadastro</td>
                    <td className="py-3 pr-4 text-zinc-500 align-top">Nome, e-mail, senha (hash bcrypt)</td>
                    <td className="py-3 text-zinc-500 align-top">Identificação e autenticação na Plataforma</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-zinc-300 align-top">Credenciais Meta</td>
                    <td className="py-3 pr-4 text-zinc-500 align-top">Token OAuth (criptografado AES-256), ID da conta de anúncios</td>
                    <td className="py-3 text-zinc-500 align-top">Execução de operações na Meta Marketing API em nome do Usuário</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-zinc-300 align-top">Dados de campanhas</td>
                    <td className="py-3 pr-4 text-zinc-500 align-top">Campanhas, conjuntos, criativos, métricas de performance, públicos</td>
                    <td className="py-3 text-zinc-500 align-top">Exibição de relatórios e alimentação do assistente de IA</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-zinc-300 align-top">Dados de uso</td>
                    <td className="py-3 pr-4 text-zinc-500 align-top">Endereço IP, user-agent, logs de acesso, ações na interface</td>
                    <td className="py-3 text-zinc-500 align-top">Segurança, detecção de fraudes, melhoria do serviço</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-zinc-300 align-top">Dados de pagamento</td>
                    <td className="py-3 pr-4 text-zinc-500 align-top">Status da assinatura, histórico de cobranças (sem dados do cartão)</td>
                    <td className="py-3 text-zinc-500 align-top">Gestão de assinaturas e cobrança recorrente</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 text-zinc-300 align-top">Cookies</td>
                    <td className="py-3 pr-4 text-zinc-500 align-top">Identificador de sessão, preferências de interface, aceite desta política</td>
                    <td className="py-3 text-zinc-500 align-top">Manutenção do login e personalização</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="text-zinc-500 text-xs">
              Não coletamos dados sensíveis (art. 5º, II, LGPD). Não coletamos dados pessoais de leads
              ou usuários finais das campanhas — esses dados pertencem exclusivamente à conta Meta do Usuário.
            </p>
          </Section>

          <Section title="3. Base legal para o tratamento (art. 7º LGPD)">
            <p>Cada atividade de tratamento de dados possui base legal específica:</p>
            <div className="space-y-2">
              {[
                ["Execução de contrato (art. 7º, V)", "Tratamento de dados de cadastro, credenciais Meta e dados de campanhas — necessários para prestar o serviço contratado."],
                ["Legítimo interesse (art. 7º, IX)", "Dados de uso e logs de segurança — necessários para proteger a integridade da Plataforma e dos dados dos Usuários."],
                ["Consentimento (art. 7º, I)", "Cookies analíticos não essenciais — coletados apenas após aceite explícito pelo banner de cookies."],
                ["Cumprimento de obrigação legal (art. 7º, II)", "Retenção de logs e registros fiscais conforme exigência legal (Marco Civil, legislação tributária)."],
              ].map(([base, desc]) => (
                <div key={base} className="flex gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                  <div className="w-1 rounded-full bg-violet-500/50 shrink-0" />
                  <div>
                    <p className="text-zinc-300 text-xs font-medium">{base}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="4. Compartilhamento e transferência de dados">
            <p>
              Os dados são compartilhados somente com terceiros estritamente necessários à operação da Plataforma,
              todos vinculados por acordos de processamento de dados adequados à LGPD:
            </p>
            <Sub title="Meta Platforms Inc. (EUA)">
              Os tokens de acesso são usados exclusivamente para realizar chamadas à Meta Marketing API
              em nome do Usuário autenticado. Nenhum dado é enviado à Meta além do necessário para executar
              a operação solicitada. Rege-se pelos Termos de Serviço da Meta e pelas Cláusulas Contratuais Padrão (SCCs) da UE.
            </Sub>
            <Sub title="Supabase Inc. (EUA / UE)">
              Banco de dados e autenticação. Os dados são armazenados em servidores certificados (SOC 2 Type II)
              com criptografia em repouso e em trânsito. A transferência internacional é amparada por SCCs.
            </Sub>
            <Sub title="Anthropic PBC (EUA)">
              O assistente de IA processa contexto de campanhas (nomes, métricas, objetivos) para gerar
              recomendações. Nenhum dado de identificação pessoal do Usuário ou de terceiros é enviado.
              A transferência é amparada por SCCs e pela política de privacidade da Anthropic.
            </Sub>
            <Sub title="Autoridades públicas">
              Dados poderão ser divulgados a autoridades competentes mediante ordem judicial, requisição
              da ANPD, ou obrigação legal aplicável, nos termos do art. 7º, II e VI, da LGPD.
            </Sub>
            <p className="text-zinc-500 text-xs p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              A Controladora não vende, aluga, cede ou compartilha dados pessoais com terceiros para
              fins comerciais, publicitários ou de perfilamento externo.
            </p>
          </Section>

          <Section title="5. Transferência internacional de dados">
            <p>
              Alguns de nossos operadores estão localizados nos Estados Unidos. A transferência de dados
              para esses países é realizada com base em mecanismos de proteção adequados, conforme
              previsto no art. 33 da LGPD:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-zinc-400">
              <li>Cláusulas Contratuais Padrão (SCCs) aprovadas por autoridades de proteção de dados;</li>
              <li>Certificações e relatórios de conformidade (SOC 2, ISO 27001) dos operadores;</li>
              <li>Consentimento específico do Usuário, quando aplicável e exigido pela LGPD.</li>
            </ul>
            <p>
              Para obter cópia dos mecanismos de transferência aplicáveis, entre em contato com o DPO.
            </p>
          </Section>

          <Section title="6. Segurança e medidas técnicas">
            <p>
              Adotamos medidas técnicas e organizacionais adequadas para proteger os dados pessoais contra
              acesso não autorizado, perda, alteração, divulgação ou destruição:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ["Criptografia em trânsito", "TLS 1.2+ em todas as comunicações"],
                ["Criptografia em repouso", "AES-256 para tokens de acesso Meta e dados sensíveis"],
                ["Autenticação segura", "Senhas armazenadas com hash bcrypt (fator de custo ≥12)"],
                ["Controle de acesso", "Princípio do menor privilégio — acesso restrito por função"],
                ["Isolamento de dados", "Arquitetura multi-tenant com Row Level Security (RLS) no Supabase"],
                ["Auditoria e logs", "Registros de acesso e operações críticas com retenção de 12 meses"],
                ["Revisão periódica", "Avaliações de segurança e atualização de dependências regulares"],
                ["Backup", "Backups automáticos com retenção e criptografia"],
              ].map(([title, desc]) => (
                <div key={title} className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                  <p className="text-zinc-300 text-xs font-medium">{title}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="7. Retenção e eliminação de dados">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2.5 pr-4 text-zinc-400 font-medium">Categoria</th>
                    <th className="text-left py-2.5 pr-4 text-zinc-400 font-medium">Prazo de retenção</th>
                    <th className="text-left py-2.5 text-zinc-400 font-medium">Fundamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ["Dados de conta", "Vigência da conta + 90 dias após cancelamento", "Execução do contrato"],
                    ["Tokens Meta", "Removidos imediatamente após desconexão ou cancelamento", "Minimização"],
                    ["Dados de campanhas", "Vigência da conta + 90 dias após cancelamento", "Execução do contrato"],
                    ["Logs de acesso", "12 meses", "Marco Civil da Internet (art. 15)"],
                    ["Registros fiscais", "5 anos", "Código Tributário Nacional"],
                    ["Cookies de sessão", "Sessão do navegador", "Técnico"],
                    ["Cookies de preferência", "12 meses", "Consentimento"],
                  ].map(([cat, prazo, fund]) => (
                    <tr key={cat}>
                      <td className="py-2.5 pr-4 text-zinc-300 align-top">{cat}</td>
                      <td className="py-2.5 pr-4 text-zinc-500 align-top">{prazo}</td>
                      <td className="py-2.5 text-zinc-500 align-top">{fund}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Após o vencimento dos prazos, os dados são eliminados de forma segura e irreversível,
              incluindo cópias de backup, conforme art. 16 da LGPD.
            </p>
          </Section>

          <Section title="8. Direitos dos titulares (art. 18 LGPD)">
            <p>
              Como titular de dados pessoais, você possui os seguintes direitos, exercíveis a qualquer
              momento mediante solicitação ao DPO:
            </p>
            <div className="space-y-2">
              {[
                ["Confirmação e acesso", "Confirmar se tratamos seus dados e obter cópia completa em formato legível."],
                ["Correção", "Solicitar a correção de dados incompletos, inexatos ou desatualizados."],
                ["Anonimização, bloqueio ou eliminação", "Dados desnecessários, excessivos ou tratados em desconformidade com a LGPD."],
                ["Portabilidade", "Receber seus dados em formato estruturado, interoperável, para transferência a outro fornecedor."],
                ["Eliminação", "Solicitar a exclusão de dados tratados com base em consentimento (art. 18, VI)."],
                ["Revogação do consentimento", "Retirar o consentimento a qualquer momento, sem prejuízo do tratamento realizado anteriormente."],
                ["Informação sobre compartilhamento", "Saber com quais entidades públicas e privadas seus dados foram compartilhados."],
                ["Oposição", "Opor-se ao tratamento realizado com base em outras hipóteses legais, em caso de descumprimento."],
                ["Revisão de decisões automatizadas", "Solicitar revisão humana de decisões tomadas exclusivamente por meios automatizados (art. 20)."],
              ].map(([dir, desc]) => (
                <div key={dir} className="flex gap-3">
                  <span className="text-violet-400 text-xs mt-1 shrink-0">→</span>
                  <div>
                    <span className="text-zinc-300 text-xs font-medium">{dir}: </span>
                    <span className="text-zinc-500 text-xs">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <p className="text-zinc-300 text-xs font-medium mb-2">Como exercer seus direitos</p>
              <p className="text-zinc-500 text-xs leading-relaxed">
                Envie e-mail para <a href="mailto:privacidade@vendai.pro" className="text-violet-400">privacidade@vendai.pro</a> com
                assunto <strong className="text-zinc-300">"LGPD — [Direito solicitado]"</strong>, informando seu nome completo e
                e-mail cadastrado. Responderemos em até <strong className="text-zinc-300">15 dias úteis</strong>. Em caso de
                impossibilidade de atendimento imediato, informaremos o motivo e o prazo para resposta definitiva.
                Você também pode registrar reclamação perante a <strong className="text-zinc-300">ANPD</strong> em{" "}
                <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-violet-400">gov.br/anpd</a>.
              </p>
            </div>
          </Section>

          <Section title="9. Decisões automatizadas e inteligência artificial">
            <p>
              A Plataforma utiliza modelos de linguagem (IA) para gerar recomendações de otimização,
              copy de anúncios e análise de performance. Em conformidade com o art. 20 da LGPD:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-zinc-400">
              <li>As recomendações da IA são <strong className="text-zinc-300">sugestivas</strong> — a decisão final é sempre do Usuário;</li>
              <li>Nenhuma decisão com efeito jurídico ou impacto significativo é tomada exclusivamente por meios automatizados;</li>
              <li>O Usuário pode solicitar revisão humana de qualquer saída gerada pela IA pelo canal do DPO;</li>
              <li>Os prompts enviados à IA não incluem dados de identificação pessoal de terceiros.</li>
            </ul>
          </Section>

          <Section title="10. Cookies e tecnologias de rastreamento">
            <p>Utilizamos as seguintes categorias de cookies:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2.5 pr-3 text-zinc-400 font-medium">Categoria</th>
                    <th className="text-left py-2.5 pr-3 text-zinc-400 font-medium">Nome / Exemplo</th>
                    <th className="text-left py-2.5 pr-3 text-zinc-400 font-medium">Duração</th>
                    <th className="text-left py-2.5 pr-3 text-zinc-400 font-medium">Finalidade</th>
                    <th className="text-left py-2.5 text-zinc-400 font-medium">Essencial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ["Sessão", "sb-access-token", "Sessão", "Autenticação Supabase", "Sim"],
                    ["Preferência", "gtpro_cookie_consent", "12 meses", "Registro do aceite desta política", "Sim"],
                    ["Segurança", "sb-refresh-token", "60 dias", "Renovação de sessão segura", "Sim"],
                    ["Analítico", "gtpro_analytics_*", "12 meses", "Métricas de uso anonimizadas", "Não"],
                  ].map(([cat, nome, dur, fin, ess]) => (
                    <tr key={cat}>
                      <td className="py-2.5 pr-3 text-zinc-300 align-top">{cat}</td>
                      <td className="py-2.5 pr-3 text-zinc-500 font-mono align-top">{nome}</td>
                      <td className="py-2.5 pr-3 text-zinc-500 align-top">{dur}</td>
                      <td className="py-2.5 pr-3 text-zinc-500 align-top">{fin}</td>
                      <td className={`py-2.5 align-top font-medium ${ess === "Sim" ? "text-emerald-500" : "text-zinc-500"}`}>{ess}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Cookies não essenciais são coletados apenas após consentimento explícito. Você pode
              gerenciar ou revogar o consentimento a qualquer momento nas configurações do navegador
              ou por e-mail ao DPO.
            </p>
          </Section>

          <Section title="11. Incidentes de segurança">
            <p>
              Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares,
              a Controladora adotará os seguintes procedimentos, conforme art. 48 da LGPD:
            </p>
            <ul className="space-y-1.5 list-disc list-inside text-zinc-400">
              <li>Comunicação à <strong className="text-zinc-300">ANPD</strong> em prazo razoável após a ciência do incidente;</li>
              <li>Notificação ao <strong className="text-zinc-300">Usuário afetado</strong> por e-mail, descrevendo a natureza dos dados envolvidos, os riscos e as medidas adotadas;</li>
              <li>Contenção imediata e investigação do incidente com apoio de equipe técnica especializada;</li>
              <li>Registro e documentação do incidente para fins de auditoria e melhoria contínua.</li>
            </ul>
            <p>Para relatar suspeita de incidente ou vulnerabilidade: <a href="mailto:seguranca@vendai.pro" className="text-violet-400 hover:text-violet-300">seguranca@vendai.pro</a></p>
          </Section>

          <Section title="12. Integração com a Meta Platform">
            <p>
              Ao conectar sua conta Meta, você autoriza a Plataforma a acessar sua conta de anúncios
              com os escopos <code className="text-xs bg-white/[0.06] px-1.5 py-0.5 rounded text-violet-300">ads_management</code>,{" "}
              <code className="text-xs bg-white/[0.06] px-1.5 py-0.5 rounded text-violet-300">ads_read</code> e{" "}
              <code className="text-xs bg-white/[0.06] px-1.5 py-0.5 rounded text-violet-300">pages_read_engagement</code>.
              Esta autorização pode ser revogada a qualquer momento em{" "}
              <strong className="text-zinc-300">facebook.com → Configurações → Aplicativos e sites</strong>.
              A revogação do acesso na Meta não exclui automaticamente os dados armazenados na Plataforma —
              para isso, solicite a exclusão ao DPO.
            </p>
          </Section>

          <Section title="13. Menores de idade">
            <p>
              A Plataforma é destinada exclusivamente a pessoas jurídicas e profissionais maiores de 18 anos.
              Não coletamos intencionalmente dados de menores. Caso identifiquemos tratamento de dados
              de menor de idade sem o consentimento adequado, os dados serão eliminados imediatamente.
            </p>
          </Section>

          <Section title="14. Links externos">
            <p>
              A Plataforma pode conter links para sites de terceiros (Meta, Supabase, etc.).
              Esta Política não se aplica a esses sites. Recomendamos a leitura das políticas de
              privacidade de cada serviço externo acessado.
            </p>
          </Section>

          <Section title="15. Alterações desta política">
            <p>
              Esta Política pode ser atualizada para refletir mudanças legais, tecnológicas ou operacionais.
              Alterações relevantes serão comunicadas com <strong className="text-zinc-300">30 dias de antecedência</strong> por
              e-mail cadastrado e/ou aviso na Plataforma. A versão em vigor é sempre a publicada em{" "}
              <strong className="text-zinc-300">gtpro.vendai.pro/privacidade</strong>.
              O uso continuado após a data de vigência implica aceite das alterações.
            </p>
          </Section>

          <Section title="16. Contato e canais de atendimento">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ["DPO / Privacidade", "privacidade@vendai.pro", "Direitos LGPD, solicitações de dados, incidentes"],
                ["Suporte técnico", "suporte@vendai.pro", "Dúvidas sobre o funcionamento da Plataforma"],
                ["Segurança", "seguranca@vendai.pro", "Relato de vulnerabilidades e incidentes"],
              ].map(([role, email, desc]) => (
                <div key={role} className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                  <p className="text-zinc-300 text-xs font-medium mb-1">{role}</p>
                  <a href={`mailto:${email}`} className="text-violet-400 hover:text-violet-300 text-xs">{email}</a>
                  <p className="text-zinc-600 text-xs mt-1">{desc}</p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white/[0.02] rounded-lg border border-white/[0.05] text-xs text-zinc-500">
              <strong className="text-zinc-400">Autoridade Nacional de Proteção de Dados (ANPD):</strong>{" "}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">gov.br/anpd</a>{" "}
              — Você tem o direito de registrar reclamação perante a ANPD caso entenda que seus direitos não foram atendidos.
            </div>
          </Section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="Grupo Venda" width={120} height={28} className="object-contain opacity-40" />
          <div className="text-center text-xs text-zinc-600 space-y-1">
            <p>GTPRO · gtpro.vendai.pro · © {new Date().getFullYear()} Grupo Venda Tecnologia</p>
            <p>
              <Link href="/termos" className="hover:text-zinc-400 transition-colors">Termos de Uso</Link>
              {" · "}
              <Link href="/privacidade" className="hover:text-zinc-400 transition-colors">Política de Privacidade</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
