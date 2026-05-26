import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Exclusão de Dados do Usuário — GTPRO",
  description: "Como solicitar a exclusão dos seus dados pessoais coletados pelo aplicativo GTPRO via Meta Platform.",
}

export default function ExclusaoDadosPage() {
  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-300">
      <div className="max-w-2xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12 flex items-center justify-between">
          <Image src="/logo.png" alt="Grupo Venda" width={180} height={40} className="object-contain" />
          <Link href="/privacidade" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Política de Privacidade
          </Link>
        </div>

        <h1 className="text-2xl font-semibold text-white mb-2">Exclusão de Dados do Usuário</h1>
        <p className="text-xs text-zinc-500 mb-10">
          Instrução de exclusão de dados — Meta Platform · GTPRO — gtpro.vendai.pro
        </p>

        {/* Destaque */}
        <div className="mb-10 p-4 rounded-lg border border-violet-500/20 bg-violet-500/5 text-sm text-zinc-400 leading-relaxed">
          Esta página atende ao requisito da <strong className="text-zinc-200">Meta Platforms</strong> de disponibilizar
          instruções claras para que usuários solicitem a exclusão dos dados coletados pelo aplicativo
          <strong className="text-zinc-200"> GTPRO</strong> por meio do Login com Facebook / Meta OAuth.
        </div>

        <div className="space-y-10 text-sm leading-relaxed">

          {/* O que coletamos */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide border-b border-white/10 pb-2">
              Quais dados foram coletados via Meta
            </h2>
            <p className="text-zinc-400">
              Ao conectar sua conta Meta ao GTPRO, o aplicativo coletou e armazenou:
            </p>
            <ul className="space-y-2 text-zinc-400">
              {[
                ["Token de acesso OAuth", "Usado para executar operações na sua conta de anúncios em seu nome. Armazenado criptografado (AES-256)."],
                ["ID da conta de anúncios", "Identificador da conta Meta Ads vinculada ao seu perfil na plataforma."],
                ["Dados de campanhas", "Informações de campanhas, conjuntos de anúncios e métricas lidas via Meta Marketing API."],
              ].map(([item, desc]) => (
                <li key={item} className="flex gap-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                  <span className="text-violet-400 shrink-0 mt-0.5">→</span>
                  <div>
                    <span className="text-zinc-300 font-medium">{item}: </span>
                    <span className="text-zinc-500">{desc}</span>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-zinc-500 text-xs p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              Não coletamos dados pessoais de terceiros (leads, seguidores ou usuários finais das campanhas).
              Todos os dados acima pertencem exclusivamente à sua conta de anúncios.
            </p>
          </section>

          {/* Como solicitar */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide border-b border-white/10 pb-2">
              Como solicitar a exclusão
            </h2>

            <p className="text-zinc-400">
              Você pode solicitar a exclusão completa dos seus dados de duas formas:
            </p>

            {/* Opção 1 */}
            <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-semibold flex items-center justify-center shrink-0">1</span>
                <p className="text-white font-medium text-sm">Dentro da plataforma GTPRO</p>
              </div>
              <ol className="space-y-1.5 text-zinc-400 text-xs leading-relaxed list-none">
                <li className="flex gap-2"><span className="text-zinc-600">a.</span> Acesse <strong className="text-zinc-300">gtpro.vendai.pro</strong> e faça login na sua conta.</li>
                <li className="flex gap-2"><span className="text-zinc-600">b.</span> Vá em <strong className="text-zinc-300">Configurações → Conta → Conexão Meta</strong>.</li>
                <li className="flex gap-2"><span className="text-zinc-600">c.</span> Clique em <strong className="text-zinc-300">"Desconectar conta Meta"</strong> — isso remove o token de acesso imediatamente.</li>
                <li className="flex gap-2"><span className="text-zinc-600">d.</span> Para exclusão completa da conta e todos os dados, clique em <strong className="text-zinc-300">"Cancelar conta e excluir dados"</strong>.</li>
              </ol>
            </div>

            {/* Opção 2 */}
            <div className="p-5 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-semibold flex items-center justify-center shrink-0">2</span>
                <p className="text-white font-medium text-sm">Por e-mail ao nosso Encarregado de Dados (DPO)</p>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Envie um e-mail para{" "}
                <a href="mailto:privacidade@vendai.pro" className="text-violet-400 hover:text-violet-300 font-medium">
                  privacidade@vendai.pro
                </a>{" "}
                com o assunto <strong className="text-zinc-300">"Exclusão de dados — Meta"</strong> contendo:
              </p>
              <ul className="space-y-1 text-zinc-500 text-xs list-disc list-inside">
                <li>Seu nome completo</li>
                <li>E-mail cadastrado no GTPRO</li>
                <li>ID do perfil ou conta Meta vinculada (se souber)</li>
                <li>Confirmação de que deseja excluir todos os dados</li>
              </ul>
            </div>
          </section>

          {/* Prazo e confirmação */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide border-b border-white/10 pb-2">
              Prazo e confirmação
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                ["Token Meta", "Removido imediatamente após a desconexão ou solicitação", "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"],
                ["Dados de campanhas e conta", "Excluídos em até 30 dias após a solicitação", "bg-blue-500/10 border-blue-500/20 text-blue-400"],
                ["Logs de segurança", "Retidos por até 12 meses conforme exigência legal (Marco Civil da Internet)", "bg-amber-500/10 border-amber-500/20 text-amber-400"],
              ].map(([title, desc, cls]) => (
                <div key={title} className={`p-4 rounded-lg border ${cls} bg-opacity-5`}>
                  <p className="text-xs font-medium mb-1">{title}</p>
                  <p className="text-zinc-500 text-xs">{desc}</p>
                </div>
              ))}
            </div>
            <p className="text-zinc-500 text-xs">
              Após a conclusão, você receberá confirmação por e-mail. Caso não receba em 5 dias úteis
              após a solicitação, entre em contato novamente.
            </p>
          </section>

          {/* Revogar via Meta */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide border-b border-white/10 pb-2">
              Revogar acesso diretamente pela Meta
            </h2>
            <p className="text-zinc-400">
              Você também pode revogar o acesso do app GTPRO à sua conta diretamente nas configurações
              do Facebook/Meta, sem necessidade de contato conosco:
            </p>
            <ol className="space-y-1.5 text-zinc-400 text-xs leading-relaxed list-decimal list-inside">
              <li>Acesse <strong className="text-zinc-300">facebook.com</strong> e clique em Configurações e Privacidade.</li>
              <li>Vá em <strong className="text-zinc-300">Configurações → Aplicativos e sites</strong>.</li>
              <li>Localize <strong className="text-zinc-300">GTPRO</strong> na lista e clique em <strong className="text-zinc-300">Remover</strong>.</li>
              <li>Confirme a remoção — o token de acesso será invalidado imediatamente pela Meta.</li>
            </ol>
            <p className="text-zinc-500 text-xs p-3 bg-white/[0.02] rounded-lg border border-white/[0.05]">
              A revogação na Meta invalida o token mas não exclui os dados já armazenados na plataforma GTPRO.
              Para exclusão completa, utilize um dos métodos da seção anterior.
            </p>
          </section>

          {/* Contato */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wide border-b border-white/10 pb-2">
              Dúvidas e contato
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                <p className="text-zinc-300 text-xs font-medium mb-1">Encarregado de Dados (DPO)</p>
                <a href="mailto:privacidade@vendai.pro" className="text-violet-400 hover:text-violet-300 text-xs">privacidade@vendai.pro</a>
                <p className="text-zinc-600 text-xs mt-1">Resposta em até 15 dias úteis</p>
              </div>
              <div className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
                <p className="text-zinc-300 text-xs font-medium mb-1">Autoridade Nacional (ANPD)</p>
                <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 text-xs">gov.br/anpd</a>
                <p className="text-zinc-600 text-xs mt-1">Para reclamações não resolvidas</p>
              </div>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/[0.06] flex flex-col items-center gap-4">
          <Image src="/logo.png" alt="Grupo Venda" width={120} height={28} className="object-contain opacity-40" />
          <div className="text-center text-xs text-zinc-600 space-y-1">
            <p>GTPRO · gtpro.vendai.pro · © {new Date().getFullYear()} Grupo Venda Tecnologia</p>
            <p>
              <Link href="/privacidade" className="hover:text-zinc-400 transition-colors">Política de Privacidade</Link>
              {" · "}
              <Link href="/termos" className="hover:text-zinc-400 transition-colors">Termos de Uso</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
