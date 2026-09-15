import type {
  Ensaio,
  ExecucaoEnsaio,
  Fase,
  FrequenciaSpec,
  FrequenciaTipo,
  Lado,
  Producao,
  StatusTarefa,
} from '@/types'
import { gerarPaineis, METROS_POR_ESTACA_PADRAO } from './estacas'

// =============================================================
// Motor de cálculo: dado o checklist + a produção lançada,
// gera a lista de ensaios exigidos (tarefas), inclusive os
// cumulativos (massa/volume) cruzados entre dias.
// =============================================================

export interface Tarefa {
  id: string // chave estável da ocorrência (sobrevive a reimport do checklist)
  data: string
  producaoId?: string
  materialNome: string
  grupo?: string
  lado?: Lado
  fase: Fase
  ensaioNome: string
  unidade?: string
  freq: FrequenciaSpec
  tipo: FrequenciaTipo
  /** Onde/qual ocorrência (ex.: "Painel 806→821", "Carga 2 de 3"). */
  local?: string
  detalhe?: string
  /** Precisa de decisão manual (tipo "outro"/combinado sem dado). */
  manual?: boolean
  // estado (mesclado das execuções salvas)
  status: StatusTarefa
  resultado?: string
  dataExecucao?: string
  observacao?: string
}

/** Chave lógica de um ensaio — estável entre reimportações do checklist. */
export function ensaioKey(materialNome: string, fase: string, nome: string): string {
  return `${materialNome}::${fase}::${nome}`.toLowerCase()
}

/** Resolve um "combinado" para a alternativa que rege, conforme os dados. */
function resolverCombinado(f: FrequenciaSpec, prod: Producao): FrequenciaSpec {
  const alts = f.alternativas ?? []
  if (alts.length === 0) return f
  const tem = (t: FrequenciaTipo): boolean => {
    if (t === 'por_distancia') return !!prod.extensaoM && prod.extensaoM > 0
    if (t === 'por_massa') return !!prod.toneladas && prod.toneladas > 0
    if (t === 'por_volume') return !!prod.volumeM3 && prod.volumeM3 > 0
    if (t === 'por_jornada') return true
    return false
  }
  const ordem: FrequenciaTipo[] = ['por_distancia', 'por_massa', 'por_volume', 'por_jornada']
  for (const t of ordem) {
    const a = alts.find((x) => x.tipo === t)
    if (a && tem(t)) return a
  }
  for (const t of ordem) {
    const a = alts.find((x) => x.tipo === t)
    if (a) return a
  }
  return alts[0]
}

export interface CalcParams {
  ensaios: Ensaio[]
  producoes: Producao[]
  execucoes: Map<string, ExecucaoEnsaio>
  metrosPorEstaca?: number
}

export function calcularTarefas({
  ensaios,
  producoes,
  execucoes,
  metrosPorEstaca = METROS_POR_ESTACA_PADRAO,
}: CalcParams): Tarefa[] {
  // ensaios por material
  const porMaterial = new Map<string, Ensaio[]>()
  for (const e of ensaios) {
    if (!e.ativo) continue
    if (!porMaterial.has(e.materialNome)) porMaterial.set(e.materialNome, [])
    porMaterial.get(e.materialNome)!.push(e)
  }

  const prods = [...producoes].sort((a, b) =>
    a.data === b.data ? a.criadoEm - b.criadoEm : a.data < b.data ? -1 : 1,
  )

  const tarefas: Tarefa[] = []
  const acumulado = new Map<string, number>() // ensaioKey|unidade -> total corrido
  const jornadaEmitida = new Set<string>()

  const merge = (t: Omit<Tarefa, 'status' | 'resultado' | 'dataExecucao' | 'observacao'>): Tarefa => {
    const ex = execucoes.get(t.id)
    return {
      ...t,
      status: ex?.status ?? 'pendente',
      resultado: ex?.resultado,
      dataExecucao: ex?.dataExecucao,
      observacao: ex?.observacao,
    }
  }

  for (const prod of prods) {
    const lista = (porMaterial.get(prod.materialNome) ?? []).filter(
      (e) => !prod.grupo || !e.grupo || e.grupo === prod.grupo,
    )

    for (const ens of lista) {
      const k = ensaioKey(ens.materialNome, ens.fase, ens.nome)
      const freq = ens.freq.tipo === 'combinado' ? resolverCombinado(ens.freq, prod) : ens.freq
      const baseTarefa = {
        data: prod.data,
        producaoId: prod.id,
        materialNome: ens.materialNome,
        grupo: prod.grupo ?? ens.grupo,
        lado: prod.lado,
        fase: ens.fase,
        ensaioNome: ens.nome,
        unidade: ens.unidade,
        freq: ens.freq,
        tipo: freq.tipo,
      }

      switch (freq.tipo) {
        case 'por_distancia': {
          const intervalo = freq.intervalo ?? 0
          if (intervalo <= 0) break
          if (prod.estacaInicial && prod.estacaFinal) {
            const paineis = gerarPaineis(
              prod.estacaInicial,
              prod.estacaFinal,
              intervalo,
              metrosPorEstaca,
            )
            for (const p of paineis) {
              tarefas.push(
                merge({
                  ...baseTarefa,
                  id: `${prod.id}::${k}::dist::${p.indice}`,
                  local: `${p.deEstaca}→${p.ateEstaca}`,
                  detalhe: p.parcial ? `${Math.round(p.comprimento)} m (parcial)` : `${Math.round(p.comprimento)} m`,
                }),
              )
            }
          } else if (prod.extensaoM && prod.extensaoM > 0) {
            const n = Math.ceil(prod.extensaoM / intervalo - 1e-9)
            for (let i = 0; i < n; i++)
              tarefas.push(
                merge({ ...baseTarefa, id: `${prod.id}::${k}::dist::${i}`, local: `Trecho ${i + 1} de ${n}` }),
              )
          }
          break
        }
        case 'por_volume':
        case 'por_massa': {
          const intervalo = freq.intervalo ?? 0
          const qtd = freq.tipo === 'por_massa' ? prod.toneladas : prod.volumeM3
          if (intervalo <= 0 || !qtd || qtd <= 0) break
          const und = freq.tipo === 'por_massa' ? 't' : 'm³'
          const acc = `${k}::${freq.tipo}`
          const antes = acumulado.get(acc) ?? 0
          const depois = antes + qtd
          acumulado.set(acc, depois)
          const de = Math.floor(antes / intervalo + 1e-9) + 1
          const ate = Math.floor(depois / intervalo + 1e-9)
          for (let mult = de; mult <= ate; mult++) {
            tarefas.push(
              merge({
                ...baseTarefa,
                id: `${k}::${freq.tipo}::${mult}`,
                local: `${mult * intervalo} ${und} acumulados`,
                detalhe: `no dia ${formatarData(prod.data)}`,
              }),
            )
          }
          break
        }
        case 'por_carregamento': {
          const n = prod.carregamentos ?? (prod.notasFiscais?.length || 0)
          for (let i = 0; i < n; i++) {
            const nf = prod.notasFiscais?.[i]
            tarefas.push(
              merge({
                ...baseTarefa,
                id: `${prod.id}::${k}::carga::${i}`,
                local: `Carga ${i + 1} de ${n}`,
                detalhe: nf ? `NF ${nf}` : undefined,
              }),
            )
          }
          break
        }
        case 'por_jornada': {
          const qtd = freq.qtdPorEvento ?? 1
          for (let i = 0; i < qtd; i++) {
            const jk = `${prod.materialNome}::${prod.data}::${k}::${i}`
            if (jornadaEmitida.has(jk)) continue
            jornadaEmitida.add(jk)
            tarefas.push(
              merge({
                ...baseTarefa,
                id: jk,
                local: qtd > 1 ? `Determinação ${i + 1} de ${qtd}` : 'Jornada do dia',
              }),
            )
          }
          break
        }
        case 'por_mudanca_de_fonte': {
          if (!prod.mudancaFonte) break
          tarefas.push(
            merge({
              ...baseTarefa,
              id: `${prod.id}::${k}::fonte`,
              local: 'Mudança de fonte',
              detalhe: prod.fonteDescricao,
            }),
          )
          break
        }
        case 'visual_obrigatorio': {
          tarefas.push(
            merge({ ...baseTarefa, id: `${prod.id}::${k}::visual`, local: 'Verificação visual' }),
          )
          break
        }
        case 'periodico_certificado':
          // Tratado como alerta periódico, não como tarefa diária.
          break
        default: {
          // "outro": lembra o usuário, mas exige decisão manual.
          tarefas.push(
            merge({
              ...baseTarefa,
              id: `${prod.id}::${k}::outro`,
              local: 'A classificar',
              detalhe: freq.textoOriginal,
              manual: true,
            }),
          )
        }
      }
    }
  }

  return tarefas
}

function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}

/** Agrupa tarefas por data (desc) e depois por material. */
export function agruparPorDia(tarefas: Tarefa[]) {
  const porData = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    if (!porData.has(t.data)) porData.set(t.data, [])
    porData.get(t.data)!.push(t)
  }
  return [...porData.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([data, itens]) => ({ data, itens }))
}

export interface ResumoTarefas {
  total: number
  feitos: number
  pendentes: number
  na: number
}

export function resumir(tarefas: Tarefa[]): ResumoTarefas {
  let feitos = 0
  let pendentes = 0
  let na = 0
  for (const t of tarefas) {
    if (t.status === 'feito') feitos++
    else if (t.status === 'na') na++
    else pendentes++
  }
  return { total: tarefas.length, feitos, pendentes, na }
}
