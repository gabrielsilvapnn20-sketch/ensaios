import { useState } from 'react'
import { Check, Circle, MinusCircle, ChevronDown } from 'lucide-react'
import type { Tarefa } from '@/lib/engine'
import { NOMES_TIPO } from '@/lib/frequencia'
import { setStatusTarefa } from '@/db'
import { FaseBadge } from './ui'
import type { StatusTarefa } from '@/types'

const diasAtraso = (dataISO: string): number => {
  const d = new Date(dataISO + 'T00:00:00')
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.floor((hoje.getTime() - d.getTime()) / 86400000)
}

/** Cor da borda por atraso do que está pendente. */
function corAtraso(t: Tarefa): string {
  if (t.status === 'feito') return 'border-l-emerald-400'
  if (t.status === 'na') return 'border-l-slate-300'
  const dias = diasAtraso(t.data)
  if (dias >= 7) return 'border-l-rose-500'
  if (dias >= 3) return 'border-l-amber-500'
  if (dias >= 1) return 'border-l-amber-300'
  return 'border-l-brand-300'
}

interface Grupo {
  chave: string
  materialNome: string
  grupo?: string
  ensaios: { chave: string; nome: string; fase: string; itens: Tarefa[] }[]
}

function agrupar(tarefas: Tarefa[]): Grupo[] {
  const mats = new Map<string, Grupo>()
  for (const t of tarefas) {
    const mchave = `${t.materialNome}||${t.grupo ?? ''}`
    if (!mats.has(mchave))
      mats.set(mchave, { chave: mchave, materialNome: t.materialNome, grupo: t.grupo, ensaios: [] })
    const g = mats.get(mchave)!
    const echave = `${t.fase}||${t.ensaioNome}`
    let ens = g.ensaios.find((e) => e.chave === echave)
    if (!ens) {
      ens = { chave: echave, nome: t.ensaioNome, fase: t.fase, itens: [] }
      g.ensaios.push(ens)
    }
    ens.itens.push(t)
  }
  return [...mats.values()]
}

export function DiaChecklist({ obraId, tarefas }: { obraId: string; tarefas: Tarefa[] }) {
  const grupos = agrupar(tarefas)
  return (
    <div className="space-y-4">
      {grupos.map((g) => (
        <div key={g.chave} className="card overflow-hidden">
          <div className="border-b border-black/[0.06] bg-surface-muted px-5 py-3">
            <span className="font-semibold text-ink">{g.materialNome}</span>
            {g.grupo && <span className="text-sm text-ink-soft"> · {g.grupo}</span>}
          </div>
          <div className="divide-y divide-black/[0.05]">
            {g.ensaios.map((ens) => (
              <div key={ens.chave} className="px-5 py-3">
                <div className="mb-2 flex items-center gap-2">
                  <FaseBadge fase={ens.fase} />
                  <span className="text-sm font-semibold text-ink">{ens.nome}</span>
                  <span className="text-xs text-ink-faint">
                    {ens.itens.length}× · {NOMES_TIPO[ens.itens[0].tipo]}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {ens.itens.map((t) => (
                    <TarefaRow key={t.id} obraId={obraId} tarefa={t} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TarefaRow({ obraId, tarefa }: { obraId: string; tarefa: Tarefa }) {
  const [aberto, setAberto] = useState(false)
  const [resultado, setResultado] = useState(tarefa.resultado ?? '')
  const [obs, setObs] = useState(tarefa.observacao ?? '')
  const [dataExec, setDataExec] = useState(tarefa.dataExecucao ?? new Date().toISOString().slice(0, 10))

  const mudarStatus = (status: StatusTarefa) => {
    setStatusTarefa(obraId, tarefa.id, {
      status,
      dataExecucao: status === 'feito' ? dataExec : undefined,
    })
  }

  const toggle = () => mudarStatus(tarefa.status === 'feito' ? 'pendente' : 'feito')

  return (
    <div className={`rounded-lg border border-black/[0.05] border-l-[3px] ${corAtraso(tarefa)} bg-white`}>
      <div className="flex items-center gap-2.5 px-2.5 py-1.5">
        <button
          onClick={toggle}
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition-colors ${
            tarefa.status === 'feito'
              ? 'border-emerald-500 bg-emerald-500 text-white'
              : tarefa.status === 'na'
                ? 'border-slate-300 bg-slate-100 text-slate-400'
                : 'border-black/15 text-transparent hover:border-brand-400'
          }`}
          title={tarefa.status === 'feito' ? 'Feito' : 'Marcar como feito'}
        >
          {tarefa.status === 'feito' ? <Check size={14} /> : tarefa.status === 'na' ? <MinusCircle size={13} /> : <Circle size={8} />}
        </button>

        <div className="min-w-0 flex-1">
          <div
            className={`text-sm ${tarefa.status === 'feito' ? 'text-ink-faint line-through' : 'text-ink'}`}
          >
            {tarefa.local}
            {tarefa.detalhe && <span className="text-ink-faint"> · {tarefa.detalhe}</span>}
            {tarefa.manual && (
              <span className="chip ml-2 bg-amber-50 text-amber-700">definir manualmente</span>
            )}
          </div>
        </div>

        {tarefa.resultado && !aberto && (
          <span className="hidden text-xs text-ink-faint sm:inline">= {tarefa.resultado}</span>
        )}
        <button
          className={`chip ${tarefa.status === 'na' ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          onClick={() => mudarStatus(tarefa.status === 'na' ? 'pendente' : 'na')}
          title="Não se aplica"
        >
          N.A.
        </button>
        <button className="btn-ghost !px-1.5 !py-1" onClick={() => setAberto((v) => !v)}>
          <ChevronDown size={16} className={aberto ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {aberto && (
        <div className="grid gap-2 border-t border-black/[0.05] px-3 py-2.5 sm:grid-cols-[1fr_1fr_auto]">
          <label className="text-xs">
            <span className="label !mb-1">Resultado / valor</span>
            <input
              className="input !py-1.5"
              value={resultado}
              placeholder="ex.: GC 101%"
              onChange={(e) => setResultado(e.target.value)}
              onBlur={() => setStatusTarefa(obraId, tarefa.id, { resultado })}
            />
          </label>
          <label className="text-xs">
            <span className="label !mb-1">Observação</span>
            <input
              className="input !py-1.5"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              onBlur={() => setStatusTarefa(obraId, tarefa.id, { observacao: obs })}
            />
          </label>
          <label className="text-xs">
            <span className="label !mb-1">Data de execução</span>
            <input
              type="date"
              className="input !py-1.5"
              value={dataExec}
              onChange={(e) => {
                setDataExec(e.target.value)
                setStatusTarefa(obraId, tarefa.id, { dataExecucao: e.target.value })
              }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
