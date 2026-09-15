// =============================================================
// Aritmética de estaqueamento (padrão brasileiro: 1 estaca = 20 m)
// Estaca no formato "estaca+metro", ex.: "885+10" = estaca 885 + 10 m.
// =============================================================

export interface Estaca {
  estaca: number
  metro: number
}

export const METROS_POR_ESTACA_PADRAO = 20

/** Interpreta "885+10", "885", "885+10,5". Retorna null se inválido. */
export function parseEstaca(texto: string | undefined | null): Estaca | null {
  if (texto == null) return null
  const s = texto.toString().trim().replace(',', '.')
  if (!s) return null
  const m = s.match(/^(\d+)(?:\s*\+\s*(\d+(?:\.\d+)?))?$/)
  if (!m) return null
  return { estaca: parseInt(m[1], 10), metro: m[2] ? parseFloat(m[2]) : 0 }
}

/** Posição absoluta em metros. */
export function posEmMetros(e: Estaca, mpe = METROS_POR_ESTACA_PADRAO): number {
  return e.estaca * mpe + e.metro
}

/** Converte metros absolutos de volta para estaca+metro. */
export function metrosParaEstaca(pos: number, mpe = METROS_POR_ESTACA_PADRAO): Estaca {
  const estaca = Math.floor(pos / mpe + 1e-9)
  const metro = pos - estaca * mpe
  return { estaca, metro: Math.round(metro * 100) / 100 }
}

/** Formata a estaca; omite o metro quando é zero. */
export function formatEstaca(e: Estaca): string {
  const metro = Math.round(e.metro * 100) / 100
  if (metro === 0) return String(e.estaca)
  const metroStr = Number.isInteger(metro) ? String(metro) : metro.toFixed(2).replace('.', ',')
  return `${e.estaca}+${metroStr}`
}

/** Extensão em metros entre duas estacas textuais (valor absoluto). */
export function extensaoEntre(
  inicial: string | undefined,
  final: string | undefined,
  mpe = METROS_POR_ESTACA_PADRAO,
): number | null {
  const a = parseEstaca(inicial)
  const b = parseEstaca(final)
  if (!a || !b) return null
  return Math.abs(posEmMetros(b, mpe) - posEmMetros(a, mpe))
}

/** Um painel de ensaio: trecho [de, ate] com rótulos de estaca. */
export interface Painel {
  indice: number
  deMetros: number
  ateMetros: number
  deEstaca: string
  ateEstaca: string
  comprimento: number
  /** Painel final incompleto (menor que o intervalo cheio). */
  parcial: boolean
}

/**
 * Divide um trecho [inicial, final] em painéis de tamanho `intervalo` (m).
 * Cada painel recebe rótulo de estaca inicial/final. Respeita o sentido
 * (crescente ou decrescente) do estaqueamento lançado.
 */
export function gerarPaineis(
  estacaInicial: string,
  estacaFinal: string,
  intervalo: number,
  mpe = METROS_POR_ESTACA_PADRAO,
): Painel[] {
  const a = parseEstaca(estacaInicial)
  const b = parseEstaca(estacaFinal)
  if (!a || !b || intervalo <= 0) return []
  const pa = posEmMetros(a, mpe)
  const pb = posEmMetros(b, mpe)
  const inicio = Math.min(pa, pb)
  const fim = Math.max(pa, pb)
  const total = fim - inicio
  if (total <= 0) return []

  const paineis: Painel[] = []
  let cursor = inicio
  let i = 0
  while (cursor < fim - 1e-6) {
    const proximo = Math.min(cursor + intervalo, fim)
    const comprimento = proximo - cursor
    paineis.push({
      indice: i,
      deMetros: cursor,
      ateMetros: proximo,
      deEstaca: formatEstaca(metrosParaEstaca(cursor, mpe)),
      ateEstaca: formatEstaca(metrosParaEstaca(proximo, mpe)),
      comprimento,
      parcial: comprimento < intervalo - 1e-6,
    })
    cursor = proximo
    i++
  }
  return paineis
}

/** Quantos ensaios "por distância" um trecho exige (arredonda pra cima). */
export function qtdPorDistancia(extensaoM: number, intervalo: number): number {
  if (intervalo <= 0) return 0
  return Math.ceil(extensaoM / intervalo - 1e-9)
}
