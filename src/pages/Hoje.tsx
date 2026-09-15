import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Upload, PlusCircle, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { db } from '@/db'
import { useApp } from '@/state/appStore'
import { useTarefas } from '@/state/useTarefas'
import { resumir } from '@/lib/engine'
import { EmptyState } from '@/components/ui'
import { DiaChecklist } from '@/components/DiaChecklist'

const hoje = () => new Date().toISOString().slice(0, 10)
const fmt = (iso: string) => {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}
const addDias = (iso: string, n: number) => {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function Hoje() {
  const { obra } = useApp()
  const nEnsaios = useLiveQuery(
    () => (obra ? db.ensaios.where('obraId').equals(obra.id).count() : Promise.resolve(0)),
    [obra?.id],
  )
  const { tarefas } = useTarefas()
  const [data, setData] = useState(hoje())

  const doDia = useMemo(() => (tarefas ?? []).filter((t) => t.data === data), [tarefas, data])
  const resumo = resumir(doDia)
  const diasComTarefa = useMemo(() => new Set((tarefas ?? []).map((t) => t.data)), [tarefas])

  // contagem "hoje você precisa fazer X de tal ensaio"
  const porEnsaio = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of doDia) if (t.status !== 'na') m.set(t.ensaioNome, (m.get(t.ensaioNome) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [doDia])

  if (!obra) {
    return (
      <EmptyState
        icone={<Upload size={40} />}
        titulo="Bem-vindo 👋"
        descricao="Comece importando o checklist da sua obra."
        acao={
          <Link to="/importar" className="btn-primary">
            Importar checklist
          </Link>
        }
      />
    )
  }
  if (!nEnsaios) {
    return (
      <EmptyState
        icone={<Upload size={40} />}
        titulo={`Obra "${obra.nome}" sem checklist`}
        descricao="Importe a planilha .xlsx desta obra."
        acao={
          <Link to="/importar" className="btn-primary">
            Importar checklist
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Ensaios do dia</h1>
          <p className="mt-1 text-sm text-ink-faint">{obra.nome}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-white p-1">
          <button className="btn-ghost !px-2" onClick={() => setData((d) => addDias(d, -1))}>
            <ChevronLeft size={18} />
          </button>
          <label className="relative flex items-center">
            <CalendarDays size={15} className="pointer-events-none absolute left-2.5 text-brand-500" />
            <input
              type="date"
              className="input !border-0 !py-1.5 pl-8 font-medium focus:!ring-0"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
          <button className="btn-ghost !px-2" onClick={() => setData((d) => addDias(d, 1))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {doDia.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icone={<PlusCircle size={36} />}
            titulo={`Nenhum ensaio para ${fmt(data)}`}
            descricao={
              diasComTarefa.size > 0
                ? 'Não há produção lançada neste dia. Lance a produção para gerar os ensaios.'
                : 'Ainda não há produção lançada. Comece lançando o serviço do dia.'
            }
            acao={
              <Link to="/produzir" className="btn-primary">
                <PlusCircle size={16} /> Lançar produção
              </Link>
            }
          />
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ensaios" valor={resumo.total} cor="text-brand-700 bg-brand-50" />
            <Stat label="Pendentes" valor={resumo.pendentes} cor="text-amber-700 bg-amber-50" />
            <Stat label="Feitos" valor={resumo.feitos} cor="text-emerald-700 bg-emerald-50" />
            <Stat label="N.A." valor={resumo.na} cor="text-slate-600 bg-slate-100" />
          </div>

          {/* Contagem por ensaio */}
          <div className="card p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Hoje você precisa fazer
            </div>
            <div className="flex flex-wrap gap-2">
              {porEnsaio.map(([nome, n]) => (
                <span key={nome} className="chip bg-brand-50 text-brand-700">
                  <strong>{n}</strong> {nome}
                </span>
              ))}
            </div>
          </div>

          <DiaChecklist obraId={obra.id} tarefas={doDia} />
        </>
      )}
    </div>
  )
}

function Stat({ label, valor, cor }: { label: string; valor: number; cor: string }) {
  return (
    <div className={`rounded-2xl p-4 ${cor}`}>
      <div className="text-2xl font-bold">{valor}</div>
      <div className="text-xs font-medium opacity-80">{label}</div>
    </div>
  )
}
