import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, Search, FileSpreadsheet, FileDown } from 'lucide-react'
import { useApp } from '@/state/appStore'
import { useTarefas } from '@/state/useTarefas'
import { agruparPorDia, type Tarefa } from '@/lib/engine'
import { EmptyState } from '@/components/ui'
import { DiaChecklist } from '@/components/DiaChecklist'
import { exportarTarefasXlsx, exportarTarefasCsv } from '@/lib/exportar'

const fmt = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

interface Aderencia {
  material: string
  total: number
  feitos: number
  pendentes: number
  na: number
}

function calcularAderencia(tarefas: Tarefa[]): { geral: Aderencia; porMaterial: Aderencia[] } {
  const mapa = new Map<string, Aderencia>()
  const geral: Aderencia = { material: 'Geral', total: 0, feitos: 0, pendentes: 0, na: 0 }
  for (const t of tarefas) {
    const chave = t.grupo ? `${t.materialNome} · ${t.grupo}` : t.materialNome
    if (!mapa.has(chave))
      mapa.set(chave, { material: chave, total: 0, feitos: 0, pendentes: 0, na: 0 })
    const a = mapa.get(chave)!
    const bump = (x: Aderencia) => {
      if (t.status === 'na') x.na++
      else {
        x.total++
        if (t.status === 'feito') x.feitos++
        else x.pendentes++
      }
    }
    bump(a)
    bump(geral)
  }
  return {
    geral,
    porMaterial: [...mapa.values()].sort((a, b) => b.total - a.total),
  }
}

export function Historico() {
  const { obra } = useApp()
  const { tarefas } = useTarefas()

  const [material, setMaterial] = useState('todos')
  const [status, setStatus] = useState('todos')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [estaca, setEstaca] = useState('')

  const materiais = useMemo(() => {
    const s = new Set<string>()
    for (const t of tarefas ?? []) s.add(t.materialNome)
    return [...s]
  }, [tarefas])

  const filtradas = useMemo(() => {
    const q = estaca.trim().toLowerCase()
    return (tarefas ?? []).filter(
      (t) =>
        (material === 'todos' || t.materialNome === material) &&
        (status === 'todos' || t.status === status) &&
        (!de || t.data >= de) &&
        (!ate || t.data <= ate) &&
        (!q || (t.local ?? '').toLowerCase().includes(q)),
    )
  }, [tarefas, material, status, de, ate, estaca])

  const aderencia = useMemo(() => calcularAderencia(tarefas ?? []), [tarefas])
  const dias = useMemo(() => agruparPorDia(filtradas), [filtradas])

  if (!obra) {
    return (
      <EmptyState
        icone={<History size={40} />}
        titulo="Nenhuma obra selecionada"
        acao={
          <Link to="/obras" className="btn-primary">
            Ir para Obras
          </Link>
        }
      />
    )
  }

  const semDados = (tarefas ?? []).length === 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Histórico & aderência</h1>
          <p className="mt-1 text-sm text-ink-faint">
            {obra.nome} · quanto foi exigido vs. quanto foi feito.
          </p>
        </div>
        {!semDados && (
          <div className="flex gap-2">
            <button className="btn-soft" onClick={() => exportarTarefasXlsx(obra, filtradas)}>
              <FileSpreadsheet size={15} /> Excel
            </button>
            <button className="btn-ghost" onClick={() => exportarTarefasCsv(obra, filtradas)}>
              <FileDown size={15} /> CSV
            </button>
          </div>
        )}
      </div>

      {semDados ? (
        <div className="card">
          <EmptyState
            icone={<History size={36} />}
            titulo="Ainda não há ensaios no histórico"
            descricao="Lance produção para o app calcular os ensaios e acompanhar a aderência."
            acao={
              <Link to="/produzir" className="btn-primary">
                Lançar produção
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Aderência geral */}
          <BarraAderencia a={aderencia.geral} destaque />

          {/* Aderência por material */}
          <div className="grid gap-3 sm:grid-cols-2">
            {aderencia.porMaterial.map((a) => (
              <BarraAderencia key={a.material} a={a} />
            ))}
          </div>

          {/* Filtros */}
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <label className="text-xs">
              <span className="label !mb-1">Material</span>
              <select className="input !py-2" value={material} onChange={(e) => setMaterial(e.target.value)}>
                <option value="todos">Todos</option>
                {materiais.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="label !mb-1">Status</span>
              <select className="input !py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="todos">Todos</option>
                <option value="pendente">Pendentes</option>
                <option value="feito">Feitos</option>
                <option value="na">N.A.</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="label !mb-1">De</span>
              <input type="date" className="input !py-2" value={de} onChange={(e) => setDe(e.target.value)} />
            </label>
            <label className="text-xs">
              <span className="label !mb-1">Até</span>
              <input type="date" className="input !py-2" value={ate} onChange={(e) => setAte(e.target.value)} />
            </label>
            <label className="text-xs">
              <span className="label !mb-1">Estaca</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" size={14} />
                <input
                  className="input !py-2 pl-8"
                  placeholder="806"
                  value={estaca}
                  onChange={(e) => setEstaca(e.target.value)}
                />
              </div>
            </label>
            <div className="ml-auto text-sm text-ink-faint">{filtradas.length} ensaios</div>
          </div>

          {/* Lista por dia */}
          {dias.length === 0 ? (
            <div className="card p-8 text-center text-ink-faint">Nenhum ensaio para este filtro.</div>
          ) : (
            <div className="space-y-6">
              {dias.map(({ data, itens }) => (
                <div key={data}>
                  <div className="mb-2 text-sm font-semibold text-ink-soft">{fmt(data)}</div>
                  <DiaChecklist obraId={obra.id} tarefas={itens} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function BarraAderencia({ a, destaque = false }: { a: Aderencia; destaque?: boolean }) {
  const pct = a.total > 0 ? Math.round((a.feitos / a.total) * 100) : 0
  const cor = pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className={`card p-4 ${destaque ? 'border-brand-200 bg-brand-50/40' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`font-semibold ${destaque ? 'text-brand-800' : 'text-ink'}`}>{a.material}</span>
        <span className="text-sm font-bold text-ink">{pct}%</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
        <div className={`h-full rounded-full ${cor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex gap-3 text-xs text-ink-faint">
        <span>
          <strong className="text-emerald-600">{a.feitos}</strong> feitos
        </span>
        <span>
          <strong className="text-amber-600">{a.pendentes}</strong> pendentes
        </span>
        <span>de {a.total} exigidos</span>
        {a.na > 0 && <span>· {a.na} N.A.</span>}
      </div>
    </div>
  )
}
