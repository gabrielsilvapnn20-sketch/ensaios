import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Building2, Plus, Trash2, FileSpreadsheet, CheckCircle2, Upload } from 'lucide-react'
import { db, criarObra, excluirObra } from '@/db'
import { useApp } from '@/state/appStore'
import { SectionTitle, EmptyState } from '@/components/ui'

export function Obras() {
  const { obras, obra, selecionarObra } = useApp()
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')

  const contagens = useLiveQuery(async () => {
    const map: Record<string, number> = {}
    for (const o of obras ?? []) {
      map[o.id] = await db.ensaios.where('obraId').equals(o.id).count()
    }
    return map
  }, [obras?.length])

  async function adicionar() {
    if (!nome.trim()) return
    await criarObra({ nome: nome.trim() })
    setNome('')
    setCriando(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Obras & Importação</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Cada obra tem seu próprio checklist e histórico. Reimportar o checklist de uma obra
            atualiza as regras sem apagar a produção lançada.
          </p>
        </div>
        <Link to="/importar" className="btn-primary hidden sm:inline-flex">
          <Upload size={16} /> Importar checklist
        </Link>
      </div>

      {/* Nova obra */}
      <div className="card p-5">
        <SectionTitle
          right={
            !criando && (
              <button className="btn-soft" onClick={() => setCriando(true)}>
                <Plus size={16} /> Nova obra
              </button>
            )
          }
        >
          Suas obras
        </SectionTitle>

        {criando && (
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-surface-muted p-3">
            <label className="flex-1">
              <span className="label">Nome da obra</span>
              <input
                className="input"
                autoFocus
                placeholder="Ex.: GO-319 Pontalina/Vicentinópolis"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && adicionar()}
              />
            </label>
            <button className="btn-primary" onClick={adicionar}>
              Criar
            </button>
            <button className="btn-ghost" onClick={() => setCriando(false)}>
              Cancelar
            </button>
          </div>
        )}

        {(!obras || obras.length === 0) && !criando ? (
          <EmptyState
            icone={<Building2 size={36} />}
            titulo="Nenhuma obra ainda"
            descricao="Crie sua primeira obra ou importe direto um checklist — o app cria a obra pra você."
            acao={
              <div className="flex gap-2">
                <button className="btn-soft" onClick={() => setCriando(true)}>
                  <Plus size={16} /> Nova obra
                </button>
                <Link to="/importar" className="btn-primary">
                  <Upload size={16} /> Importar checklist
                </Link>
              </div>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {obras?.map((o) => {
              const ativa = o.id === obra?.id
              return (
                <div
                  key={o.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    ativa ? 'border-brand-300 bg-brand-50/50 shadow-sm' : 'border-black/[0.06] bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink">{o.nome}</span>
                        {ativa && <CheckCircle2 size={15} className="text-brand-600" />}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-faint">
                        {o.rodovia && <span>{o.rodovia} · </span>}
                        {contagens?.[o.id] ?? 0} ensaios
                        {o.checklistImportadoEm
                          ? ` · checklist de ${new Date(o.checklistImportadoEm).toLocaleDateString('pt-BR')}`
                          : ' · sem checklist'}
                      </div>
                    </div>
                    <button
                      className="btn-ghost !px-2 text-rose-500 hover:bg-rose-50"
                      title="Excluir obra"
                      onClick={async () => {
                        if (confirm(`Excluir a obra "${o.nome}" e todo o seu histórico? Não dá pra desfazer.`))
                          await excluirObra(o.id)
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {!ativa && (
                      <button className="btn-ghost" onClick={() => selecionarObra(o.id)}>
                        Selecionar
                      </button>
                    )}
                    <Link
                      to="/importar"
                      className="btn-ghost"
                      onClick={() => selecionarObra(o.id)}
                    >
                      <FileSpreadsheet size={15} /> {o.checklistImportadoEm ? 'Atualizar' : 'Importar'} checklist
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
