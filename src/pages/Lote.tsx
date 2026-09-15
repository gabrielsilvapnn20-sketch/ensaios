import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ClipboardPaste, Wand2, CheckCircle2, ArrowRight, Trash2 } from 'lucide-react'
import { db, salvarProducao, getAliases, salvarAliases, type AliasAlvo } from '@/db'
import { useApp } from '@/state/appStore'
import { EmptyState } from '@/components/ui'
import { extensaoEntre } from '@/lib/estacas'
import { parseRelatorio, sugerirAlvo, type Alvo, type EntradaRelatorio } from '@/lib/relatorio'
import type { Ensaio, Lado } from '@/types'

const EXEMPLO = `GO.319   01/09/2026
        AVANÇO FÍSICO
BASE BGS  L D.
EST. INICIAL 806+00
   "     FINAL   838+10

SUB BASE (CORREÇÃO DE BORRACHUDOS L D.)
EST. INICIAL 824+00
   "     FINAL   864+00`

interface Linha extends EntradaRelatorio {
  _id: number
}

export function Lote() {
  const { obra } = useApp()
  const ensaios = useLiveQuery(
    () => (obra ? db.ensaios.where('obraId').equals(obra.id).toArray() : Promise.resolve([] as Ensaio[])),
    [obra?.id],
  )

  const alvos = useMemo<Alvo[]>(() => {
    const set = new Map<string, Alvo>()
    for (const e of ensaios ?? []) {
      set.set(e.materialNome, { materialNome: e.materialNome })
      if (e.grupo) set.set(`${e.materialNome}||${e.grupo}`, { materialNome: e.materialNome, grupo: e.grupo })
    }
    return [...set.values()]
  }, [ensaios])

  const materiais = useMemo(() => [...new Set(alvos.map((a) => a.materialNome))], [alvos])
  const gruposDe = (material: string) =>
    alvos.filter((a) => a.materialNome === material && a.grupo).map((a) => a.grupo!)

  const [texto, setTexto] = useState('')
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [salvo, setSalvo] = useState(0)

  async function interpretar() {
    if (!obra) return
    const aliases = await getAliases(obra.id)
    const entradas = parseRelatorio(texto)
    const mapeadas: Linha[] = entradas.map((e, i) => {
      const s = sugerirAlvo(e.servicoTexto, alvos, aliases)
      return {
        ...e,
        _id: i,
        materialNome: s?.materialNome,
        grupo: s?.grupo,
        incluir: !e.naoRealizado && !!e.estacaInicial,
      }
    })
    setLinhas(mapeadas)
    setSalvo(0)
  }

  function atualizar(id: number, patch: Partial<Linha>) {
    setLinhas((ls) => ls?.map((l) => (l._id === id ? { ...l, ...patch } : l)) ?? null)
  }

  async function lancar() {
    if (!obra || !linhas) return
    const aliases = await getAliases(obra.id)
    let n = 0
    for (const l of linhas) {
      if (!l.incluir || !l.materialNome) continue
      const ext = extensaoEntre(l.estacaInicial, l.estacaFinal, obra.metrosPorEstaca)
      await salvarProducao({
        obraId: obra.id,
        data: l.data ?? new Date().toISOString().slice(0, 10),
        materialId: '',
        materialNome: l.materialNome,
        grupo: l.grupo || undefined,
        lado: l.lado,
        estacaInicial: l.estacaInicial,
        estacaFinal: l.estacaFinal,
        extensaoM: ext ?? undefined,
        observacao: l.observacao,
      })
      // memoriza o apelido para a próxima vez
      const alvo: AliasAlvo = { materialNome: l.materialNome, grupo: l.grupo }
      aliases[l.servicoTexto.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()] = alvo
      n++
    }
    await salvarAliases(obra.id, aliases)
    setSalvo(n)
    setLinhas(null)
    setTexto('')
  }

  if (!obra) {
    return (
      <EmptyState
        icone={<ClipboardPaste size={40} />}
        titulo="Nenhuma obra selecionada"
        acao={
          <Link to="/obras" className="btn-primary">
            Ir para Obras
          </Link>
        }
      />
    )
  }

  const incluidas = linhas?.filter((l) => l.incluir && l.materialNome).length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Lançar em lote</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Cole o relatório de avanço físico do jeito que você escreve. O app separa os serviços,
          entende as estacas e calcula os ensaios de cada um.
        </p>
      </div>

      {salvo > 0 && (
        <div className="card border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 size={20} />
            <span className="font-semibold">{salvo} produções lançadas!</span>
          </div>
          <Link to="/" className="btn-primary mt-4">
            Ver ensaios do dia <ArrowRight size={16} />
          </Link>
        </div>
      )}

      {!linhas && (
        <div className="card p-5">
          <textarea
            className="input min-h-[220px] font-mono text-xs leading-relaxed"
            placeholder={EXEMPLO}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={interpretar} disabled={!texto.trim()}>
              <Wand2 size={16} /> Interpretar relatório
            </button>
            <button className="btn-ghost" onClick={() => setTexto(EXEMPLO)}>
              Usar exemplo
            </button>
          </div>
        </div>
      )}

      {linhas && (
        <>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="px-3 py-2">✓</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Serviço (relatório)</th>
                  <th className="px-3 py-2">Material</th>
                  <th className="px-3 py-2">Serviço específico</th>
                  <th className="px-3 py-2">Lado</th>
                  <th className="px-3 py-2">Est. inicial</th>
                  <th className="px-3 py-2">Est. final</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const semMapa = l.incluir && !l.materialNome
                  return (
                    <tr
                      key={l._id}
                      className={`border-t border-black/[0.05] ${l.naoRealizado ? 'opacity-50' : ''} ${
                        semMapa ? 'bg-amber-50/60' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={!!l.incluir}
                          onChange={(e) => atualizar(l._id, { incluir: e.target.checked })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="date"
                          className="input !py-1 !px-2"
                          value={l.data ?? ''}
                          onChange={(e) => atualizar(l._id, { data: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="max-w-[180px] text-ink">{l.servicoTexto}</div>
                        {l.naoRealizado && <span className="text-[11px] text-rose-500">não realizado</span>}
                        {l.herdouEstacas && <span className="text-[11px] text-ink-faint">estacas herdadas</span>}
                        {l.taxa != null && <span className="text-[11px] text-ink-faint"> · taxa {l.taxa}</span>}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className={`input !py-1 !px-2 ${semMapa ? 'border-amber-400' : ''}`}
                          value={l.materialNome ?? ''}
                          onChange={(e) => atualizar(l._id, { materialNome: e.target.value || undefined, grupo: undefined })}
                        >
                          <option value="">— escolher —</option>
                          {materiais.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        {l.materialNome && gruposDe(l.materialNome).length > 0 ? (
                          <select
                            className="input !py-1 !px-2"
                            value={l.grupo ?? ''}
                            onChange={(e) => atualizar(l._id, { grupo: e.target.value || undefined })}
                          >
                            <option value="">Todos</option>
                            {gruposDe(l.materialNome).map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="input !py-1 !px-2"
                          value={l.lado ?? ''}
                          onChange={(e) => atualizar(l._id, { lado: (e.target.value || undefined) as Lado })}
                        >
                          <option value="">—</option>
                          <option value="LD">LD</option>
                          <option value="LE">LE</option>
                          <option value="EIXO">EIXO</option>
                          <option value="UNICO">Único</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="input !py-1 !px-2 w-24"
                          value={l.estacaInicial ?? ''}
                          onChange={(e) => atualizar(l._id, { estacaInicial: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          className="input !py-1 !px-2 w-24"
                          value={l.estacaFinal ?? ''}
                          onChange={(e) => atualizar(l._id, { estacaFinal: e.target.value })}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <button
                          className="btn-ghost !px-1.5 text-rose-400 hover:bg-rose-50"
                          onClick={() => setLinhas((ls) => ls?.filter((x) => x._id !== l._id) ?? null)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={lancar} disabled={incluidas === 0}>
              <CheckCircle2 size={16} /> Lançar {incluidas} produções
            </button>
            <button className="btn-ghost" onClick={() => setLinhas(null)}>
              Voltar
            </button>
            <span className="text-sm text-ink-faint">
              Linhas em amarelo precisam que você escolha o material.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
