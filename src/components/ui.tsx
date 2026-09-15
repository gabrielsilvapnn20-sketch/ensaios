import type { ReactNode } from 'react'
import type { FrequenciaSpec } from '@/types'
import { CORES_TIPO, NOMES_TIPO, rotuloFrequencia } from '@/lib/frequencia'

/** Chip colorido que representa a frequência de um ensaio. */
export function FreqChip({ freq, mostrarTipo = false }: { freq: FrequenciaSpec; mostrarTipo?: boolean }) {
  return (
    <span
      className={`chip ${CORES_TIPO[freq.tipo]}`}
      title={freq.textoOriginal}
    >
      {mostrarTipo && <span className="opacity-60">{NOMES_TIPO[freq.tipo]} ·</span>}
      {rotuloFrequencia(freq)}
      {freq.confianca !== 'alta' && (
        <span className="opacity-50" title="Classificação a confirmar">
          {freq.confianca === 'media' ? '~' : '?'}
        </span>
      )}
    </span>
  )
}

export function FaseBadge({ fase }: { fase: string }) {
  const map: Record<string, string> = {
    INSUMO: 'bg-slate-100 text-slate-600',
    PRODUCAO: 'bg-blue-50 text-blue-700',
    PRODUTO: 'bg-teal-50 text-teal-700',
  }
  const nome: Record<string, string> = { INSUMO: 'Insumo', PRODUCAO: 'Produção', PRODUTO: 'Produto' }
  return <span className={`chip ${map[fase] ?? 'bg-slate-100'}`}>{nome[fase] ?? fase}</span>
}

export function EmptyState({
  titulo,
  descricao,
  acao,
  icone,
}: {
  titulo: string
  descricao?: string
  acao?: ReactNode
  icone?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icone && <div className="mb-4 text-brand-400">{icone}</div>}
      <h3 className="text-lg font-semibold text-ink">{titulo}</h3>
      {descricao && <p className="mt-1.5 max-w-md text-sm text-ink-faint">{descricao}</p>}
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">{children}</h2>
      {right}
    </div>
  )
}
