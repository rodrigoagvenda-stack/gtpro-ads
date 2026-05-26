import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Status da Exclusão de Dados — GTPRO",
}

export default function StatusPage({ searchParams }: { searchParams: { code?: string } }) {
  const code = searchParams.code

  return (
    <div className="min-h-screen bg-[#08080a] text-zinc-300 flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6 py-16 text-center">

        <div className="mb-10 flex justify-center">
          <Image src="/logo.png" alt="Grupo Venda" width={160} height={36} className="object-contain" />
        </div>

        {code ? (
          <>
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-3">Solicitação de exclusão registrada</h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              Recebemos sua solicitação de exclusão de dados. Os dados vinculados à sua conta Meta
              serão removidos em até <strong className="text-zinc-200">30 dias</strong>.
            </p>
            <div className="p-4 bg-white/[0.03] rounded-lg border border-white/[0.06] text-left mb-6">
              <p className="text-xs text-zinc-500 mb-1">Código de confirmação</p>
              <p className="text-xs font-mono text-zinc-300 break-all">{code}</p>
            </div>
            <p className="text-xs text-zinc-500">
              Guarde este código para acompanhamento. Em caso de dúvidas:{" "}
              <a href="mailto:privacidade@vendai.pro" className="text-violet-400 hover:text-violet-300">
                privacidade@vendai.pro
              </a>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-white mb-3">Código não encontrado</h1>
            <p className="text-sm text-zinc-400 leading-relaxed mb-6">
              Nenhum código de exclusão foi fornecido. Para solicitar a exclusão dos seus dados,
              acesse as instruções abaixo.
            </p>
            <Link
              href="/exclusao-de-dados"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Ver instruções de exclusão
            </Link>
          </>
        )}

        <div className="mt-12 pt-6 border-t border-white/[0.06] text-xs text-zinc-600">
          <Link href="/privacidade" className="hover:text-zinc-400 transition-colors">Política de Privacidade</Link>
          {" · "}
          <Link href="/exclusao-de-dados" className="hover:text-zinc-400 transition-colors">Exclusão de Dados</Link>
        </div>

      </div>
    </div>
  )
}
