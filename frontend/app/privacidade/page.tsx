import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Política de Privacidade — GTPRO",
  description: "Como o GTPRO coleta, usa e protege seus dados",
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-300">
      <div className="max-w-3xl mx-auto px-6 py-16">

        <div className="mb-12 flex items-center justify-between">
          <Image src="/logo.png" alt="Grupo Venda" width={180} height={40} className="object-contain" />
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Voltar</Link>
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2">Política de Privacidade</h1>
        <p className="text-xs text-zinc-500 mb-10">Última atualização: maio de 2026 · GTPRO — gtpro.vendai.pro</p>

        <div className="space-y-10 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-medium text-white mb-3">1. Quem somos</h2>
            <p>
              O GTPRO é uma plataforma SaaS de gestão de tráfego pago com inteligência artificial,
              operada pela Vendai Tecnologia. Esta política descreve como coletamos, usamos, armazenamos
              e protegemos os dados dos usuários que acessam a plataforma em <strong className="text-zinc-200">gtpro.vendai.pro</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">2. Dados que coletamos</h2>
            <p className="mb-3">Coletamos apenas os dados necessários para o funcionamento da plataforma:</p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300">Dados de conta:</span> nome, e-mail e senha (armazenada com hash) fornecidos no cadastro.</li>
              <li><span className="text-zinc-300">Tokens de acesso Meta:</span> tokens OAuth da Meta API, armazenados criptografados, usados exclusivamente para gerenciar as campanhas de anúncios do usuário.</li>
              <li><span className="text-zinc-300">Dados de campanhas:</span> informações de campanhas, conjuntos de anúncios, criativos e métricas de performance obtidas via Meta Marketing API em nome do usuário.</li>
              <li><span className="text-zinc-300">Dados de uso:</span> logs de acesso, endereço IP e interações com a plataforma para fins de segurança e melhoria do serviço.</li>
              <li><span className="text-zinc-300">Cookies:</span> cookies de sessão para manutenção do login e cookies de preferência (ex: aceite desta política).</li>
            </ul>
            <p className="mt-3 text-zinc-500">
              Não coletamos dados pessoais de leads ou usuários finais das campanhas gerenciadas.
              Dados de conversão e leads pertencem exclusivamente à conta Meta do usuário.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">3. Como usamos os dados</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Autenticar e identificar o usuário na plataforma.</li>
              <li>Executar operações na Meta Marketing API (criar campanhas, ler métricas, otimizar anúncios) em nome do usuário autenticado.</li>
              <li>Exibir relatórios e insights de performance das campanhas.</li>
              <li>Enviar notificações de alertas configurados pelo usuário.</li>
              <li>Melhorar a plataforma com base em métricas de uso agregadas e anonimizadas.</li>
              <li>Cumprir obrigações legais e responder a requisições de autoridades competentes.</li>
            </ul>
            <p className="mt-3 text-zinc-500">
              Não vendemos, alugamos nem compartilhamos dados de usuários com terceiros para fins
              comerciais ou publicitários.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">4. Compartilhamento de dados</h2>
            <p className="mb-3">Os dados são compartilhados somente com:</p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300">Meta Platforms (Facebook):</span> para execução das chamadas à Marketing API usando o token do próprio usuário. Os dados transitam sob os Termos de Serviço da Meta.</li>
              <li><span className="text-zinc-300">Supabase:</span> banco de dados e autenticação, hospedado em infraestrutura segura com criptografia em repouso.</li>
              <li><span className="text-zinc-300">Anthropic:</span> o assistente de IA processa contexto de campanhas para gerar recomendações. Nenhum dado de identificação pessoal é enviado.</li>
              <li><span className="text-zinc-300">Autoridades públicas:</span> quando exigido por lei, ordem judicial ou regulação aplicável.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">5. Armazenamento e segurança</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li>Tokens de acesso Meta são armazenados criptografados com AES-256. Nunca são expostos em logs ou respostas de API.</li>
              <li>Senhas são armazenadas exclusivamente como hash — não temos acesso à senha original.</li>
              <li>Todo tráfego entre cliente e servidor usa TLS 1.2 ou superior.</li>
              <li>O acesso ao banco de dados é restrito a serviços autenticados via chaves de serviço.</li>
              <li>Dados são armazenados em servidores localizados no Brasil ou na União Europeia, conforme a infraestrutura do Supabase.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">6. Retenção de dados</h2>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300">Dados de conta:</span> mantidos enquanto a conta estiver ativa e por até 90 dias após o cancelamento.</li>
              <li><span className="text-zinc-300">Tokens Meta:</span> removidos imediatamente após a desconexão da conta Meta ou cancelamento da assinatura.</li>
              <li><span className="text-zinc-300">Logs de acesso:</span> retidos por até 12 meses para fins de segurança.</li>
              <li><span className="text-zinc-300">Dados de campanhas:</span> removidos junto com a conta do usuário, conforme solicitação de exclusão.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">7. Seus direitos (LGPD — Lei 13.709/2018)</h2>
            <p className="mb-3">Como titular de dados, você tem direito a:</p>
            <ul className="space-y-2 list-disc list-inside text-zinc-400">
              <li><span className="text-zinc-300">Acesso:</span> solicitar uma cópia de todos os dados que temos sobre você.</li>
              <li><span className="text-zinc-300">Correção:</span> corrigir dados incompletos, inexatos ou desatualizados.</li>
              <li><span className="text-zinc-300">Exclusão:</span> solicitar a exclusão de seus dados pessoais, respeitados os prazos legais de retenção.</li>
              <li><span className="text-zinc-300">Portabilidade:</span> receber seus dados em formato estruturado e legível por máquina.</li>
              <li><span className="text-zinc-300">Revogação de consentimento:</span> retirar o consentimento a qualquer momento, sem prejuízo ao tratamento já realizado.</li>
              <li><span className="text-zinc-300">Oposição:</span> opor-se ao tratamento de dados em casos de descumprimento desta política.</li>
            </ul>
            <p className="mt-3">
              Para exercer qualquer direito, envie um e-mail para{" "}
              <a href="mailto:privacidade@vendai.pro" className="text-violet-400 hover:text-violet-300">
                privacidade@vendai.pro
              </a>{" "}
              com o assunto "LGPD — [seu direito]". Respondemos em até 15 dias úteis.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">8. Cancelamento e exclusão de conta</h2>
            <p className="mb-3">Para cancelar sua conta e solicitar a exclusão completa dos dados:</p>
            <ol className="space-y-2 list-decimal list-inside text-zinc-400">
              <li>Acesse <strong className="text-zinc-300">Configurações → Conta</strong> dentro da plataforma e clique em "Cancelar assinatura".</li>
              <li>Ou envie um e-mail para <a href="mailto:privacidade@vendai.pro" className="text-violet-400">privacidade@vendai.pro</a> com o assunto "Exclusão de conta".</li>
            </ol>
            <p className="mt-3 text-zinc-500">
              Após a solicitação, seus dados são removidos em até 30 dias, exceto onde a retenção
              for exigida por lei (ex: registros fiscais, conforme previsto na legislação brasileira).
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">9. Cookies</h2>
            <p className="mb-3">Utilizamos os seguintes tipos de cookies:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Tipo</th>
                    <th className="text-left py-2 pr-4 text-zinc-400 font-medium">Finalidade</th>
                    <th className="text-left py-2 text-zinc-400 font-medium">Obrigatório</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <tr>
                    <td className="py-2.5 pr-4 text-zinc-300">Sessão</td>
                    <td className="py-2.5 pr-4 text-zinc-500">Manter o usuário autenticado</td>
                    <td className="py-2.5 text-zinc-500">Sim</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-zinc-300">Preferência</td>
                    <td className="py-2.5 pr-4 text-zinc-500">Lembrar aceite desta política e configurações de interface</td>
                    <td className="py-2.5 text-zinc-500">Sim</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 pr-4 text-zinc-300">Analítico</td>
                    <td className="py-2.5 pr-4 text-zinc-500">Métricas de uso agregadas e anonimizadas (sem identificação pessoal)</td>
                    <td className="py-2.5 text-zinc-500">Não</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-zinc-500">
              Você pode gerenciar ou recusar cookies não essenciais a qualquer momento nas configurações do seu navegador.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">10. Integrações com terceiros</h2>
            <p>
              A plataforma se integra à Meta Platform através de OAuth. Ao conectar sua conta Meta,
              você autoriza o GTPRO a acessar e gerenciar sua conta de anúncios conforme os escopos
              solicitados no momento da autenticação. Esta autorização pode ser revogada a qualquer
              momento em <strong className="text-zinc-200">facebook.com/settings → Aplicativos e sites</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">11. Menores de idade</h2>
            <p>
              O GTPRO é destinado exclusivamente a pessoas jurídicas e profissionais de marketing digital
              maiores de 18 anos. Não coletamos intencionalmente dados de menores de idade.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">12. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Quando houver alterações relevantes,
              notificaremos por e-mail e/ou através de aviso na plataforma. O uso continuado após
              a notificação implica aceite das alterações.
            </p>
          </section>

          <section>
            <h2 className="text-base font-medium text-white mb-3">13. Contato e DPO</h2>
            <p>Para dúvidas, solicitações ou reclamações relacionadas a privacidade:</p>
            <div className="mt-3 p-4 bg-white/[0.03] rounded-lg border border-white/[0.06] space-y-1 text-zinc-400">
              <p><span className="text-zinc-300">E-mail:</span> <a href="mailto:privacidade@vendai.pro" className="text-violet-400 hover:text-violet-300">privacidade@vendai.pro</a></p>
              <p><span className="text-zinc-300">Plataforma:</span> gtpro.vendai.pro</p>
              <p><span className="text-zinc-300">Autoridade supervisora:</span> ANPD — <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">gov.br/anpd</a></p>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="Grupo Venda" width={120} height={28} className="object-contain opacity-40" />
          <p className="text-xs text-zinc-600 text-center">
            GTPRO · gtpro.vendai.pro · © {new Date().getFullYear()} Grupo Venda · Todos os direitos reservados
          </p>
        </div>

      </div>
    </div>
  )
}
