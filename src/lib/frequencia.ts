import type { FrequenciaSpec, FrequenciaTipo } from '@/types'

// =============================================================
// Classificador de frequências (coluna "PARÂMETRO DE NORMA")
// Converte o texto livre da planilha em uma especificação
// estruturada que o motor de cálculo consegue usar.
// =============================================================

const num = (s: string): number => parseFloat(s.replace(',', '.'))

/** Remove acentos para casar palavras-chave de forma robusta. */
const semAcento = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')

interface Deteccao {
  tipo: FrequenciaTipo
  intervalo?: number
  unidadeBase?: 'm' | 'm3' | 't'
  qtdPorEvento?: number
  meses?: number
}

/** Distância: "1/300 m", "a cada 300 m", "pano de 300 m", "1/5km". */
function detectDistancia(t: string): Deteccao | null {
  // km -> metros
  const km = t.match(/(\d+(?:[.,]\d+)?)\s*km\b/i)
  if (km) return { tipo: 'por_distancia', intervalo: num(km[1]) * 1000, unidadeBase: 'm' }

  // metros — o "m" precisa ser unidade (não "m³", não "mét"/"método")
  const re =
    /(?:1\s*\/\s*|a\s*cada\s*|pano\s*de\s*|cada\s*)(\d+(?:[.,]\d+)?)\s*m(?![³0-9a-zà-ú])/i
  const m = t.match(re)
  if (m) return { tipo: 'por_distancia', intervalo: num(m[1]), unidadeBase: 'm' }
  return null
}

/** Volume: "1/1000 m³", "1/1000m3". */
function detectVolume(t: string): Deteccao | null {
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*m\s*(?:³|3)(?!\d)/i)
  if (m) return { tipo: 'por_volume', intervalo: num(m[1]), unidadeBase: 'm3' }
  return null
}

/** Massa: "1 ensaio/200 t", "1 amostra / 400 t", "a cada 200 t". */
function detectMassa(t: string): Deteccao | null {
  const m = t.match(/(?:\/|cada|amostra|ensaio|de)\s*(\d+(?:[.,]\d+)?)\s*t\b/i)
  if (m) return { tipo: 'por_massa', intervalo: num(m[1]), unidadeBase: 't' }
  return null
}

/** Carregamento/carga/caminhão. */
function detectCarregamento(t: string): Deteccao | null {
  if (/\b(carga|carregamento|caminh[ãa]o)\b/i.test(t))
    return { tipo: 'por_carregamento', qtdPorEvento: 1 }
  return null
}

/** Jornada/dia: "2 determinações por dia", "8 medidas por dia", "3 cps/jorn". */
function detectJornada(t: string): Deteccao | null {
  const tem = /(por\s+dia|por\s+jornada|\/\s*jorn|jornada|determina[çc][õo]es|medidas?\s+por\s+dia|cps)/i.test(
    t,
  )
  if (!tem) return null
  const q = t.match(
    /(\d+)\s*(?:cps|medidas?|determina[çc][õo]es|ensaios?|amostras?|determina[çc][ãa]o)/i,
  )
  return { tipo: 'por_jornada', qtdPorEvento: q ? parseInt(q[1], 10) : 1 }
}

function detectMudancaFonte(t: string): Deteccao | null {
  if (/mudan[çc]a\s+de\s+fonte/i.test(t)) return { tipo: 'por_mudanca_de_fonte' }
  return null
}

function detectCertificado(t: string): Deteccao | null {
  if (/certificad/i.test(t)) {
    const m = t.match(/(\d+)\s*mes(?:es)?/i)
    return { tipo: 'periodico_certificado', meses: m ? parseInt(m[1], 10) : 12 }
  }
  const mes = t.match(/(\d+)?\s*(?:por\s+m[êe]s|\/\s*m[êe]s)/i)
  if (mes) return { tipo: 'periodico_certificado', meses: 1 }
  return null
}

/**
 * Classifica o texto da coluna PARÂMETRO DE NORMA em uma spec estruturada.
 * Função pura — usada tanto na importação quanto nos testes.
 */
export function classificarFrequencia(textoOriginal: string): FrequenciaSpec {
  const original = (textoOriginal ?? '').toString().replace(/\s+/g, ' ').trim()
  const base: FrequenciaSpec = { tipo: 'outro', textoOriginal: original, confianca: 'baixa' }

  if (!original || original === '-') return base

  const t = semAcento(original)
  const porFaixa = /por\s+faixa|por\s+pano|faixas?\s+de\s+trafego|ld\s+e\s+le/i.test(t)
  const condicional = /se\s+previsto\s+em\s+projeto|quando\s+previsto|sob\s+demanda|criterio\s+da\s+fiscaliza/i.test(
    t,
  )
  const naoAplica = /nao\s+se\s+aplica/i.test(t)

  if (naoAplica) {
    return { ...base, tipo: 'outro', observacao: 'Não se aplica', confianca: 'alta' }
  }

  // Dimensões computáveis (podem combinar em "combinado")
  const computaveis = [detectDistancia(t), detectVolume(t), detectMassa(t), detectJornada(t)].filter(
    (d): d is Deteccao => d != null,
  )

  const naoDimensional =
    detectMudancaFonte(t) ?? detectCertificado(t) ?? detectCarregamento(t)

  const construir = (d: Deteccao, confianca: FrequenciaSpec['confianca']): FrequenciaSpec => ({
    tipo: d.tipo,
    intervalo: d.intervalo,
    unidadeBase: d.unidadeBase,
    qtdPorEvento: d.qtdPorEvento,
    meses: d.meses,
    porFaixa: porFaixa || undefined,
    textoOriginal: original,
    observacao: condicional ? 'Condicional (ver texto original)' : undefined,
    confianca,
  })

  // Combinado: "1/300 m OU por jornada", "2/dia OU a cada 200t"
  if (computaveis.length >= 2 && /\bou\b/i.test(t)) {
    const alternativas = computaveis.map((d) => construir(d, 'media'))
    return {
      tipo: 'combinado',
      alternativas,
      porFaixa: porFaixa || undefined,
      textoOriginal: original,
      observacao: 'Dois critérios possíveis — escolha qual rege.',
      confianca: 'media',
    }
  }

  if (computaveis.length >= 1) {
    return construir(computaveis[0], condicional ? 'media' : 'alta')
  }

  if (naoDimensional) {
    return construir(naoDimensional, 'alta')
  }

  if (/visual|qualitativo/i.test(t)) {
    return { ...base, tipo: 'visual_obrigatorio', confianca: 'alta' }
  }

  // Sobrou texto não classificado
  return {
    ...base,
    tipo: 'outro',
    observacao: condicional ? 'Condicional (ver texto original)' : undefined,
    porFaixa: porFaixa || undefined,
    confianca: 'baixa',
  }
}

/** Rótulo curto e amigável para exibir a frequência na interface. */
export function rotuloFrequencia(f: FrequenciaSpec): string {
  switch (f.tipo) {
    case 'por_distancia':
      return `1 a cada ${f.intervalo} m${f.porFaixa ? ' · por faixa' : ''}`
    case 'por_volume':
      return `1 a cada ${f.intervalo} m³`
    case 'por_massa':
      return `1 a cada ${f.intervalo} t`
    case 'por_carregamento':
      return `1 por carregamento`
    case 'por_jornada':
      return `${f.qtdPorEvento ?? 1}× por jornada`
    case 'por_mudanca_de_fonte':
      return `A cada mudança de fonte`
    case 'periodico_certificado': {
      const m = f.meses ?? 12
      return `Certificado / ${m} ${m === 1 ? 'mês' : 'meses'}`
    }
    case 'visual_obrigatorio':
      return `Verificação visual`
    case 'combinado':
      return (f.alternativas ?? []).map(rotuloFrequencia).join('  ou  ')
    default:
      return f.textoOriginal || 'Não classificado'
  }
}

/** Cor/tom do "chip" por tipo, para a interface. */
export const CORES_TIPO: Record<FrequenciaTipo, string> = {
  por_distancia: 'bg-brand-50 text-brand-700',
  por_volume: 'bg-indigo-50 text-indigo-700',
  por_massa: 'bg-amber-50 text-amber-700',
  por_carregamento: 'bg-emerald-50 text-emerald-700',
  por_jornada: 'bg-sky-50 text-sky-700',
  por_mudanca_de_fonte: 'bg-rose-50 text-rose-700',
  periodico_certificado: 'bg-violet-50 text-violet-700',
  visual_obrigatorio: 'bg-slate-100 text-slate-700',
  combinado: 'bg-fuchsia-50 text-fuchsia-700',
  outro: 'bg-slate-100 text-slate-500',
}

export const NOMES_TIPO: Record<FrequenciaTipo, string> = {
  por_distancia: 'Por distância',
  por_volume: 'Por volume',
  por_massa: 'Por massa',
  por_carregamento: 'Por carregamento',
  por_jornada: 'Por jornada',
  por_mudanca_de_fonte: 'Mudança de fonte',
  periodico_certificado: 'Certificado',
  visual_obrigatorio: 'Visual',
  combinado: 'Combinado',
  outro: 'Outro',
}
