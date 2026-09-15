import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, ClipboardList } from 'lucide-react'
import { db } from '@/db'
import { useApp } from '@/state/appStore'
import { FreqChip, FaseBadge, EmptyState } from '@/components/ui'
import { NOMES_TIPO } from '@/lib/frequencia'
import type { Ensaio, Fase } from '@/types'

const FASES: Fase[] = ['INSUMO', 'PRODUCAO', 'PRODUTO']

export function ChecklistView() {
  const { obra } = useApp()
  const ensaios = useLiveQuery(
    () =>
      obra
        ? db.ensaios.where('obraId').equals(obra.id).sortBy('ordem')
        : Promise.resolve([] as Ensaio[]),
    [obra?.id],
  )
  const [materialSel, setMaterialSel] = useState<string>('todos')
  const [faseSel, setFaseSel] = useState<string>('todas')
  const [busca, setBusca] = useState('')

  const materiais = useMemo(() => {
    const set = new Map<string, number>()
    for (const e of ensaios ?? []) set.set(e.materialNome, (set.get(e.materialNome) ?? 0) + 1)
    return [...set.entries()]
  }, [ensaios])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return (ensaios ?? []).filter(
      (e) =>
        (materialSel === 'todos' || e.materialNome === materialSel) &&
        (faseSel === 'todas' || e.fase === faseSel) &&
        (!q || e.nome.toLowerCase().includes(q) || (e.grupo ?? '').toLowerCase().includes(q)),
    )
  }, [ensaios, materialSel, faseSel, busca])

  if (!obra) return <SemObra />
  if (ensaios && ensaios.length === 0) return <SemChecklist />

  // agrupa por material > fase
  const grupos = agrupar(filtrados)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-ink">Checklist da obra</h1>
        <p className="mt-1 text-sm text-ink-faint">
          {obra.nome} · {ensaios?.length ?? 0} ensaios · como o app entendeu cada frequência.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" size={15} />
          <input
            className="input w-56 pl-8"
            placeholder="Buscar ensaio…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={materialSel} onChange={(e) => setMaterialSel(e.target.value)}>
          <option value="todos">Todos os materiais</option>
          {materiais.map(([nome, n]) => (
            <option key={nome} value={nome}>
              {nome} ({n})
            </option>
          ))}
        </select>
        <select className="input w-auto" value={faseSel} onChange={(e) => setFaseSel(e.target.value)}>
          <option value="todas">Todas as fases</option>
          {FASES.map((f) => (
            <option key={f} value={f}>
              {f === 'PRODUCAO' ? 'Produção' : f === 'PRODUTO' ? 'Produto' : 'Insumo'}
            </option>
          ))}
        </select>
      </div>

      {filtrados.length === 0 ? (
        <div className="card p-8 text-center text-ink-faint">Nenhum ensaio para este filtro.</div>
      ) : (
        grupos.map(({ material, fases }) => (
          <div key={material} className="card overflow-hidden">
            <div className="border-b border-black/[0.06] bg-surface-muted px-5 py-3">
              <span className="font-semibold text-ink">{material}</span>
            </div>
            {fases.map(({ fase, itens }) => (
              <div key={fase}>
                <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                  <FaseBadge fase={fase} />
                  <span className="text-xs text-ink-faint">{itens.length} verificações</span>
                </div>
                <ul className="divide-y divide-black/[0.04]">
                  {itens.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-4 px-5 py-2.5">
                      <div className="min-w-0">
                        {e.grupo && <div className="text-[11px] text-ink-faint">{e.grupo}</div>}
                        <div className="text-sm text-ink">{e.nome}</div>
                        <div className="text-[11px] text-ink-faint">
                          {NOMES_TIPO[e.freq.tipo]} · orig.: “{e.freq.textoOriginal}”
                          {e.unidade ? ` · ${e.unidade}` : ''}
                        </div>
                      </div>
                      <FreqChip freq={e.freq} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}

function agrupar(ensaios: Ensaio[]) {
  const porMaterial = new Map<string, Map<string, Ensaio[]>>()
  for (const e of ensaios) {
    if (!porMaterial.has(e.materialNome)) porMaterial.set(e.materialNome, new Map())
    const fases = porMaterial.get(e.materialNome)!
    if (!fases.has(e.fase)) fases.set(e.fase, [])
    fases.get(e.fase)!.push(e)
  }
  return [...porMaterial.entries()].map(([material, fasesMap]) => ({
    material,
    fases: FASES.filter((f) => fasesMap.has(f)).map((fase) => ({ fase, itens: fasesMap.get(fase)! })),
  }))
}

function SemObra() {
  return (
    <EmptyState
      icone={<ClipboardList size={40} />}
      titulo="Nenhuma obra selecionada"
      descricao="Crie uma obra e importe o checklist para começar."
      acao={
        <Link to="/obras" className="btn-primary">
          Ir para Obras & Importação
        </Link>
      }
    />
  )
}

function SemChecklist() {
  return (
    <EmptyState
      icone={<ClipboardList size={40} />}
      titulo="Esta obra ainda não tem checklist"
      descricao="Importe a planilha .xlsx da obra para o app montar o checklist automaticamente."
      acao={
        <Link to="/importar" className="btn-primary">
          Importar checklist
        </Link>
      }
    />
  )
}
