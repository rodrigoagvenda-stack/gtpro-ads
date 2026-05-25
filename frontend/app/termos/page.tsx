import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Termos de Uso — GTPRO",
  description: "Termos e condições de uso da plataforma GTPRO",
}

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-16">

        <div className="mb-10">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Voltar</Link>
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2">Termos de Uso</h1>
        <p className="text-xs text-zinc-500 mb-10">Última atualização: maio de 2026 · GTPRO — gtpro.vendai.pro</p>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-medium text-white mb-3">1. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta ou usar a plataforma GTPRO ("Plataforma"), operada pela Vendai Tecnologia
              ("Vendai", "nós"), você ("Usuário") concorda integralmente com estes Termos de Uso e com nossa{" "}
              <Link href="/privacidade" className="text-violet-400 hover:text-violet-300">Política de Privacidade</Link>.
              Se não concordar com qualquer disposição, não utilize a Plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">2. Descrição do serviço</h2>
            <p className="mb-3">
              O GTPRO é uma plataforma SaaS que permite ao Usuário gerenciar campanhas de tráfego pago
              na Meta (Facebook e Instagram) por meio de inteligência artificial. O serviço inclui:
            </p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Criação, edição e exclusão de campanhas, conjuntos de anúncios e criativos via Meta Marketing API.</li>
              <li>Visualização de métricas e relatórios de performance.</li>
              <li>Assistente de IA para otimização e criação de campanhas.</li>
              <li>Gerenciamento de públicos, pixels e integrações com a Meta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">3. Cadastro e conta</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>O Usuário deve fornecer informações verdadeiras e atualizadas no cadastro.</li>
              <li>É responsabilidade do Usuário manter a confidencialidade de suas credenciais de acesso.</li>
              <li>Cada conta é de uso individual e intransferível, salvo nos planos com múltiplos usuários.</li>
              <li>O Usuário deve ter no mínimo 18 anos e capacidade legal para contratar.</li>
              <li>Contas suspeitas de uso fraudulento podem ser suspensas imediatamente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">4. Uso da plataforma</h2>
            <p className="mb-3">O Usuário compromete-se a:</p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Usar a Plataforma exclusivamente para fins legítimos de gestão de anúncios.</li>
              <li>Respeitar as <a href="https://www.facebook.com/policies/ads/" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">Políticas de Anúncios da Meta</a> ao criar campanhas.</li>
              <li>Não criar campanhas com conteúdo ilegal, enganoso, discriminatório ou que viole direitos de terceiros.</li>
              <li>Não tentar acessar contas, dados ou recursos da Plataforma sem autorização.</li>
              <li>Não usar a Plataforma para engenharia reversa, scraping ou reprodução não autorizada.</li>
              <li>Não sobrecarregar os servidores com requisições automatizadas excessivas.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">5. Responsabilidade sobre campanhas</h2>
            <p className="mb-2">
              O Usuário é o único responsável pelo conteúdo, segmentação e resultado das campanhas criadas
              através da Plataforma. A Vendai:
            </p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Não revisa previamente os criativos ou copies criados pelo Usuário ou pelo assistente de IA.</li>
              <li>Não garante resultados específicos de performance, alcance ou retorno sobre investimento.</li>
              <li>Não se responsabiliza por rejeições, suspensões ou penalidades aplicadas pela Meta à conta do Usuário.</li>
              <li>Não é responsável por falhas, mudanças ou indisponibilidades na Meta Marketing API.</li>
            </ul>
            <p className="mt-3 text-zinc-500">
              O assistente de IA gera sugestões com base em dados históricos e padrões de mercado.
              Suas recomendações são orientativas — a decisão final e a responsabilidade são sempre do Usuário.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">6. Planos e pagamentos</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>O acesso à Plataforma está sujeito ao pagamento de assinatura conforme o plano contratado.</li>
              <li>Os valores são cobrados antecipadamente, de forma recorrente (mensal ou anual).</li>
              <li>Em caso de inadimplência, o acesso pode ser suspenso após 3 dias e cancelado após 30 dias.</li>
              <li>Não realizamos reembolso proporcional por cancelamentos no meio do ciclo, exceto nos primeiros 7 dias ("período de teste").</li>
              <li>Preços podem ser reajustados com aviso prévio de 30 dias por e-mail.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">7. Cancelamento</h2>
            <p className="mb-3">O Usuário pode cancelar a assinatura a qualquer momento:</p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Pelo painel em <strong className="text-zinc-300">Configurações → Conta → Cancelar assinatura</strong>.</li>
              <li>Por e-mail para <a href="mailto:suporte@vendai.pro" className="text-violet-400 hover:text-violet-300">suporte@vendai.pro</a>.</li>
            </ul>
            <p className="mt-3 text-zinc-500">
              Após o cancelamento, o acesso é mantido até o fim do período pago. Os dados são retidos
              por 90 dias e então removidos permanentemente, conforme a Política de Privacidade.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">8. Propriedade intelectual</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>A Plataforma, seu código, design, marca e conteúdo são propriedade exclusiva da Vendai.</li>
              <li>O Usuário recebe uma licença limitada, não exclusiva e intransferível para uso pessoal/empresarial da Plataforma.</li>
              <li>Os dados e criativos gerados pelo Usuário pertencem ao Usuário.</li>
              <li>É vedada a reprodução, cópia ou distribuição da Plataforma sem autorização expressa.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">9. Disponibilidade e SLA</h2>
            <p>
              Buscamos disponibilidade de 99,5% ao mês. Manutenções programadas são comunicadas com
              antecedência. Não garantimos disponibilidade ininterrupta e não somos responsáveis por
              danos causados por indisponibilidades fora do nosso controle (falhas da Meta API, AWS,
              Supabase ou infraestrutura de terceiros).
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">10. Limitação de responsabilidade</h2>
            <p className="mb-3">
              Na máxima extensão permitida pela lei brasileira, a Vendai não será responsável por:
            </p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Danos indiretos, incidentais, especiais ou consequenciais decorrentes do uso da Plataforma.</li>
              <li>Perda de receita, dados ou negócios causada por falhas técnicas ou erros do assistente de IA.</li>
              <li>Ações ou omissões de terceiros, incluindo a Meta Platforms.</li>
            </ul>
            <p className="mt-3 text-zinc-500">
              Em qualquer caso, a responsabilidade total da Vendai fica limitada ao valor pago pelo
              Usuário nos últimos 3 meses de assinatura.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">11. Suspensão e rescisão</h2>
            <p>
              A Vendai pode suspender ou encerrar o acesso do Usuário, sem aviso prévio, em caso de:
              violação destes Termos, uso ilegal da Plataforma, fraude, ou atividade que coloque em
              risco a segurança da infraestrutura ou de outros usuários. Nesses casos, não há direito
              a reembolso.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">12. Lei aplicável e foro</h2>
            <p>
              Estes Termos são regidos pela legislação brasileira, especialmente o Código Civil,
              o Código de Defesa do Consumidor (quando aplicável), a LGPD e o Marco Civil da Internet.
              Para dirimir quaisquer controvérsias, fica eleito o foro da Comarca de São Paulo/SP,
              com renúncia a qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">13. Alterações nos termos</h2>
            <p>
              Podemos alterar estes Termos a qualquer momento. Alterações relevantes serão comunicadas
              por e-mail com 15 dias de antecedência. O uso continuado da Plataforma após esse prazo
              implica aceitação das novas condições.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">14. Contato</h2>
            <div className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06] space-y-1 text-zinc-400">
              <p><span className="text-zinc-300">Suporte:</span> <a href="mailto:suporte@vendai.pro" className="text-violet-400 hover:text-violet-300">suporte@vendai.pro</a></p>
              <p><span className="text-zinc-300">Privacidade:</span> <a href="mailto:privacidade@vendai.pro" className="text-violet-400 hover:text-violet-300">privacidade@vendai.pro</a></p>
              <p><span className="text-zinc-300">Plataforma:</span> gtpro.vendai.pro</p>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06] text-xs text-zinc-600 text-center">
          GTPRO · gtpro.vendai.pro · © {new Date().getFullYear()} Vendai Tecnologia · Todos os direitos reservados
        </div>

      </div>
    </div>
  )
}
