import type { Lado } from '@/types'

// =============================================================
// Interpretador de "relatório de avanço físico" colado como texto.
// Quebra o relatório em serviços (data, serviço, lado, estacas,
// taxa, observações) para lançamento em lote.
// =============================================================

export interface EntradaRelatorio {
  data?: string // ISO
  servicoTexto: string // texto cru do serviço (ex.: "BASE BGS")
  lado?: Lado
  estacaInicial?: string
  estacaFinal?: string
  taxa?: number // L/m² (banho de ligação / imprimação)
  observacao?: string
  naoRealizado?: boolean
  herdouEstacas?: boolean
  // preenchidos depois (mapeamento):
  materialNome?: string
  grupo?: string
  incluir?: boolean
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
const up = (s: string) => semAcento(s).toUpperCase().replace(/\s+/g, ' ').trim()

const RE_DATA = /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{2,4})/
const RE_EST = /(\d{1,4})\s*\+\s*(\d{1,3})/ // 806+00

function normalizarEstaca(linha: string): string | undefined {
  const m = linha.match(RE_EST)
  if (m) return `${parseInt(m[1], 10)}+${m[2].padStart(2, '0')}`
  const so = linha.match(/\b(\d{1,4})\b/)
  return so ? `${parseInt(so[1], 10)}+00` : undefined
}

function detectarLado(linha: string): Lado | undefined {
  const u = up(linha)
  if (/\bL\s*\.?\s*D\b/.test(u)) return 'LD'
  if (/\bL\s*\.?\s*E\b/.test(u)) return 'LE'
  if (/\bEIXO\b/.test(u)) return 'EIXO'
  return undefined
}

/** Remove marcações de lado e ruído do nome do serviço. */
function limparServico(linha: string): string {
  return linha
    .replace(/\bL\s*\.?\s*D\s*\.?/gi, '')
    .replace(/\bL\s*\.?\s*E\s*\.?/gi, '')
    .replace(/[.:]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const ehDecorativa = (u: string): boolean =>
  u === '' ||
  /^GO\.?\s*\d+$/.test(u) ||
  /AVAN[ÇC]O\s+F[IÍ]SICO/.test(u) ||
  /^(SEG|TER|QUA|QUI|SEX|S[ÁA]B|DOM)/.test(u) && /FEIRA|^S[ÁA]BADO|^DOMINGO|^SEGUNDA|^TER[ÇC]A|^QUARTA|^QUINTA|^SEXTA/.test(u) ||
  /^(SEGUNDA|TER[ÇC]A|QUARTA|QUINTA|SEXTA|S[ÁA]BADO|DOMINGO)/.test(u)

const ehNota = (u: string): boolean => /^(NOTA|OBS|OBSERVA)/.test(u)
const ehNaoRealizado = (u: string): boolean => /N[ÃA]O\s+FOI|N[ÃA]O\s+REALIZAD/.test(u)

/** Converte o texto do relatório em uma lista de entradas de serviço. */
export function parseRelatorio(texto: string): EntradaRelatorio[] {
  const linhas = texto.split(/\r?\n/)
  const entradas: EntradaRelatorio[] = []
  let dataAtual: string | undefined
  let atual: EntradaRelatorio | null = null

  const fechar = () => {
    if (atual && (atual.estacaInicial || atual.taxa || atual.naoRealizado)) entradas.push(atual)
    atual = null
  }

  for (const bruta of linhas) {
    const linha = bruta.trim()
    const u = up(linha)
    if (u === '') continue

    // Data (pode vir junto com "GO.319")
    const md = linha.match(RE_DATA)
    if (md && (ehDecorativa(up(linha.replace(RE_DATA, ''))) || /GO/i.test(linha))) {
      fechar()
      let [, d, mth, y] = md
      if (y.length === 2) y = '20' + y
      dataAtual = `${y}-${mth.padStart(2, '0')}-${d.padStart(2, '0')}`
      continue
    }

    if (ehDecorativa(u)) continue

    // Est. inicial / final
    if (/INICIAL/.test(u)) {
      if (!atual) atual = { servicoTexto: '(sem nome)', data: dataAtual }
      atual.estacaInicial = normalizarEstaca(linha)
      continue
    }
    if (/FINAL/.test(u)) {
      if (!atual) atual = { servicoTexto: '(sem nome)', data: dataAtual }
      atual.estacaFinal = normalizarEstaca(linha)
      fechar()
      continue
    }

    // Taxa (banho de ligação / imprimação)
    const mt = linha.match(/TAXA\s*([\d.,]+)/i)
    if (mt) {
      const val = parseFloat(mt[1].replace(',', '.'))
      if (atual) atual.taxa = val
      else if (entradas.length) entradas[entradas.length - 1].taxa = val
      continue
    }

    // Nota / observação
    if (ehNota(u)) {
      const txt = linha.replace(/^(NOTA|OBS[.:]?|OBSERVA[ÇC][ÃA]O)[.:]?\s*/i, '').trim()
      if (atual) atual.observacao = txt
      else if (entradas.length) entradas[entradas.length - 1].observacao = txt
      continue
    }

    // Linha só com marcação de lado (ex.: "L D." isolado) — ajusta o serviço atual
    if (limparServico(linha) === '' && detectarLado(linha)) {
      if (atual) atual.lado = detectarLado(linha)
      continue
    }

    // Serviço "não realizado" na mesma linha
    if (ehNaoRealizado(u)) {
      fechar()
      entradas.push({ data: dataAtual, servicoTexto: limparServico(linha), naoRealizado: true, incluir: false })
      continue
    }

    // Caso contrário: é um novo serviço
    fechar()
    atual = {
      data: dataAtual,
      servicoTexto: limparServico(linha),
      lado: detectarLado(linha),
    }
  }
  fechar()

  // Entradas com taxa mas sem estacas herdam do serviço anterior (mesmo dia).
  for (let i = 1; i < entradas.length; i++) {
    const e = entradas[i]
    if (!e.estacaInicial && e.taxa != null) {
      const ant = entradas[i - 1]
      if (ant.data === e.data && ant.estacaInicial) {
        e.estacaInicial = ant.estacaInicial
        e.estacaFinal = ant.estacaFinal
        e.lado = e.lado ?? ant.lado
        e.herdouEstacas = true
      }
    }
  }

  return entradas
}

// ---- Mapeamento serviço -> material/grupo do checklist ------

export interface Alvo {
  materialNome: string
  grupo?: string
}

// Sinônimos do vocabulário de campo -> checklist
const SINONIMOS: Record<string, string> = {
  CBUQ: 'CAUQ',
  CAUQ: 'CAUQ',
  BANHO: 'PINTURA LIGACAO',
  IMPRIMACAO: 'IMPRIMACAO',
}

function tokens(s: string): string[] {
  let u = up(s)
  for (const [k, v] of Object.entries(SINONIMOS)) u = u.replace(new RegExp(`\\b${k}\\b`, 'g'), v)
  return u
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 2 && !['DE', 'DA', 'DO', 'C', 'COM', 'FX', 'FAIXA'].includes(t))
}

export interface OpcaoAlvo extends Alvo {
  score: number
}

/** Sugere o melhor material/grupo para um texto de serviço. */
export function sugerirAlvo(
  servicoTexto: string,
  alvos: Alvo[],
  aliases: Record<string, Alvo>,
): OpcaoAlvo | null {
  const chave = up(servicoTexto)
  if (aliases[chave]) return { ...aliases[chave], score: 1 }

  const st = new Set(tokens(servicoTexto))
  if (st.size === 0) return null
  let melhor: OpcaoAlvo | null = null
  for (const alvo of alvos) {
    const at = new Set(tokens(`${alvo.grupo ?? ''} ${alvo.materialNome}`))
    let inter = 0
    for (const t of st) if (at.has(t)) inter++
    if (inter === 0) continue
    const uniao = st.size + at.size - inter
    // Jaccard favorece o encaixe exato; pequeno bônus desempata a favor do grupo.
    const score = inter / uniao + (alvo.grupo ? inter * 0.001 : 0)
    if (!melhor || score > melhor.score) melhor = { ...alvo, score }
  }
  return melhor && melhor.score >= 0.34 ? melhor : null
}
