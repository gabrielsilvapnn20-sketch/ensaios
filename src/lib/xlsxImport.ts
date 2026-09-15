import * as XLSX from 'xlsx'
import type { Fase, FrequenciaSpec } from '@/types'
import { classificarFrequencia } from './frequencia'

// =============================================================
// Importação/parsing do checklist GOINFRA (.xlsx)
// =============================================================

export interface EnsaioParsed {
  fase: Fase
  grupo?: string
  nome: string
  unidade?: string
  norma?: string
  parametro: string
  freq: FrequenciaSpec
}

export interface MaterialParsed {
  nome: string
  normaResumo?: string
  ensaios: EnsaioParsed[]
}

export interface ImportResult {
  obraInfo: {
    contratada?: string
    objeto?: string
    contrato?: string
    medicao?: string
    mes?: string
    rodovia?: string
    trecho?: string
  }
  materiais: MaterialParsed[]
  ignoradas: string[]
  totalEnsaios: number
}

type Grid = (string | null)[][]

const norm = (v: unknown): string =>
  v == null ? '' : v.toString().replace(/\s+/g, ' ').trim()

const up = (v: unknown): string => norm(v).toUpperCase()

/** É linha de cabeçalho de norma/grupo? (ex.: "ES-PAV 003/2019 - GOINFRA") */
function ehNorma(param: string): boolean {
  return /(ES-PAV|ES-T|ES-DRE|ES-DNIT)\b/i.test(param) || /GOINFRA/i.test(param)
}

/**
 * É um título de serviço/subgrupo em MAIÚSCULAS sem frequência?
 * (ex.: "COMPACTAÇÃO 100% - ATERRO", "REGULARIZAÇÃO SUBLEITO") — esses
 * cabeçalhos aparecem sem a norma na coluna PARÂMETRO.
 */
function ehTituloGrupo(nome: string): boolean {
  if (!nome || /^\d/.test(nome)) return false
  if (!/[A-ZÀ-Ú]/.test(nome)) return false
  return nome === nome.toLocaleUpperCase('pt-BR') && nome.length >= 4
}

/** Aba é PVEGQ / relatório de efetividade (não é checklist de ensaio). */
function ehRelatorio(nome: string, grid: Grid): boolean {
  if (/PVEGQ/i.test(nome)) return true
  const cabecalho = up(grid[0]?.join(' ')) + ' ' + up(grid[1]?.join(' '))
  return /PLANO DE VERIFICA[ÇC][ÃA]O DA EFETIVIDADE/.test(cabecalho)
}

/** Localiza colunas relevantes varrendo as primeiras linhas. */
function localizarColunas(grid: Grid) {
  const cols: { ensaio?: number; param?: number; und?: number; fase?: number } = {}
  let dataStart = 0
  const limite = Math.min(grid.length, 16)
  for (let r = 0; r < limite; r++) {
    const row = grid[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const s = up(row[c])
      if (!s) continue
      if (s.includes('ENSAIOS') && s.includes('VERIFICA')) {
        cols.ensaio = c
        dataStart = Math.max(dataStart, r + 1)
      }
      if (s.includes('PARÂMETRO') || s.includes('PARAMETRO')) {
        cols.param = c
        dataStart = Math.max(dataStart, r + 1)
      }
      if (s === 'UND.' || s === 'UND') cols.und = c
      if (s === 'FASES') cols.fase = c
    }
  }
  return { cols, dataStart }
}

/** Extrai um valor de metadado procurando o rótulo e pegando a próxima célula. */
function acharMeta(grid: Grid, rotulos: string[]): string | undefined {
  for (let r = 0; r < Math.min(grid.length, 12); r++) {
    const row = grid[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const s = up(row[c])
      if (rotulos.some((rot) => s.startsWith(rot))) {
        for (let k = c + 1; k < row.length; k++) {
          const v = norm(row[k])
          if (v) return v
        }
      }
    }
  }
  return undefined
}

function normalizarFase(s: string): Fase | null {
  const u = up(s)
  if (u.startsWith('INSUMO')) return 'INSUMO'
  if (u.startsWith('PRODU') && u.includes('ÇÃO')) return 'PRODUCAO'
  if (u.startsWith('PRODUÇÃO') || u === 'PRODUCAO') return 'PRODUCAO'
  if (u.startsWith('PRODUTO')) return 'PRODUTO'
  return null
}

function parsearAba(nome: string, grid: Grid): MaterialParsed | null {
  const { cols, dataStart } = localizarColunas(grid)
  if (cols.ensaio == null || cols.param == null) return null

  const ensaios: EnsaioParsed[] = []
  let faseAtual: Fase = 'INSUMO'
  let grupoAtual: string | undefined
  let normaAtual: string | undefined
  let normaResumo: string | undefined

  for (let r = dataStart; r < grid.length; r++) {
    const row = grid[r] ?? []
    const nomeEnsaio = norm(row[cols.ensaio])
    const param = norm(row[cols.param])
    const und = cols.und != null ? norm(row[cols.und]) : ''
    const faseCell = cols.fase != null ? norm(row[cols.fase]) : ''

    if (faseCell) {
      const f = normalizarFase(faseCell)
      if (f) faseAtual = f
    }

    if (!nomeEnsaio && !param) continue
    if (/^SUBTOTAL/i.test(nomeEnsaio) || /^TOTAL$/i.test(nomeEnsaio)) continue

    // Cabeçalho de grupo/serviço: com norma, ou título em MAIÚSCULAS sem frequência.
    const cabecalhoNorma = ehNorma(param)
    const cabecalhoTitulo = !param && !und && ehTituloGrupo(nomeEnsaio)
    if (cabecalhoNorma || cabecalhoTitulo) {
      grupoAtual = nomeEnsaio || grupoAtual
      if (cabecalhoNorma) {
        normaAtual = param
        if (!normaResumo) normaResumo = param
      }
      continue
    }

    // Linha descritiva sem frequência (ex.: "Para cada 200t:")
    if (!param) continue
    if (!nomeEnsaio) continue

    ensaios.push({
      fase: faseAtual,
      grupo: grupoAtual,
      nome: nomeEnsaio,
      unidade: und || undefined,
      norma: normaAtual,
      parametro: param,
      freq: classificarFrequencia(param),
    })
  }

  if (ensaios.length === 0) return null
  return { nome: nome.trim(), normaResumo, ensaios }
}

/** Ponto de entrada: recebe o ArrayBuffer do .xlsx e devolve o resultado. */
export function importarChecklist(buffer: ArrayBuffer): ImportResult {
  const wb = XLSX.read(buffer, { type: 'array' })
  const materiais: MaterialParsed[] = []
  const ignoradas: string[] = []
  const gridsMaterial: Grid[] = []
  const gridsRelatorio: Grid[] = []

  for (const nome of wb.SheetNames) {
    const ws = wb.Sheets[nome]
    const grid = XLSX.utils.sheet_to_json<(string | null)[]>(ws, {
      header: 1,
      raw: false,
      defval: null,
      blankrows: true,
    }) as Grid

    if (ehRelatorio(nome, grid)) {
      ignoradas.push(nome.trim())
      gridsRelatorio.push(grid)
      continue
    }
    const mat = parsearAba(nome, grid)
    if (mat) {
      materiais.push(mat)
      gridsMaterial.push(grid)
    } else {
      ignoradas.push(nome.trim())
      gridsRelatorio.push(grid)
    }
  }

  // Metadados: preferimos as abas de material; PVEGQ é só complemento.
  const todos = [...gridsMaterial, ...gridsRelatorio]
  const meta = (rotulos: string[]) => {
    for (const g of todos) {
      const v = acharMeta(g, rotulos)
      if (v) return v
    }
    return undefined
  }

  const obraInfo = {
    contratada: meta(['CONTRATADA']),
    objeto: meta(['OBJETO', 'OBJ:', 'SERVIÇO', 'SERVICO']),
    contrato: meta(['CONTRATO']),
    medicao: meta(['MEDIÇÃO', 'MEDICAO']),
    mes: meta(['MÊS', 'MES']),
    rodovia: meta(['RODOVIA']),
    trecho: meta(['TRECHO']),
  }

  const totalEnsaios = materiais.reduce((s, m) => s + m.ensaios.length, 0)
  return { obraInfo, materiais, ignoradas, totalEnsaios }
}
