import * as XLSX from 'xlsx'
import type { Tarefa } from './engine'
import { NOMES_TIPO } from './frequencia'
import { db } from '@/db'
import type { Obra } from '@/types'

// =============================================================
// Exportação para Excel/CSV e backup completo do banco.
// =============================================================

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  feito: 'Feito',
  na: 'N.A.',
}

const fmtData = (iso?: string) => {
  if (!iso) return ''
  const [a, m, d] = iso.split('-')
  return d ? `${d}/${m}/${a}` : iso
}

/** Separa "806→821" em estaca inicial/final. */
function partirLocal(local?: string): { ini: string; fim: string } {
  if (!local) return { ini: '', fim: '' }
  const m = local.split('→')
  if (m.length === 2) return { ini: m[0].trim(), fim: m[1].trim() }
  return { ini: local, fim: '' }
}

/** Nome de aba válido para Excel (máx 31 chars, sem caracteres proibidos). */
function nomeAba(nome: string): string {
  return nome.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Material'
}

/**
 * Exporta as tarefas para um .xlsx com uma aba por material, no formato
 * Data | Lado | Est. Inicial | Est. Final (+ ensaio, status, resultado).
 */
export function exportarTarefasXlsx(obra: Obra, tarefas: Tarefa[], nomeArquivo?: string): void {
  const wb = XLSX.utils.book_new()
  const porMaterial = new Map<string, Tarefa[]>()
  for (const t of tarefas) {
    if (!porMaterial.has(t.materialNome)) porMaterial.set(t.materialNome, [])
    porMaterial.get(t.materialNome)!.push(t)
  }

  for (const [material, itens] of porMaterial) {
    const linhas = itens.map((t) => {
      const { ini, fim } = partirLocal(t.local)
      return {
        Data: fmtData(t.data),
        Lado: t.lado ?? '',
        'Est. Inicial': ini,
        'Est. Final': fim,
        Serviço: t.grupo ?? '',
        Fase: t.fase,
        Ensaio: t.ensaioNome,
        Frequência: NOMES_TIPO[t.tipo],
        Status: STATUS_LABEL[t.status] ?? t.status,
        Resultado: t.resultado ?? '',
        'Data execução': fmtData(t.dataExecucao),
        Observação: t.observacao ?? '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(linhas)
    ws['!cols'] = [
      { wch: 11 }, { wch: 6 }, { wch: 11 }, { wch: 11 }, { wch: 18 },
      { wch: 10 }, { wch: 40 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 24 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, nomeAba(material))
  }

  if (porMaterial.size === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['Sem ensaios para exportar']])
    XLSX.utils.book_append_sheet(wb, ws, 'Vazio')
  }

  const nome = nomeArquivo ?? `ensaios-${obra.nome}-${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(wb, nome.replace(/[\\/?*[\]:]/g, '-'))
}

/** Exporta um CSV único com todas as tarefas. */
export function exportarTarefasCsv(obra: Obra, tarefas: Tarefa[]): void {
  const linhas = tarefas.map((t) => {
    const { ini, fim } = partirLocal(t.local)
    return {
      Data: fmtData(t.data),
      Material: t.materialNome,
      Serviço: t.grupo ?? '',
      Lado: t.lado ?? '',
      'Est. Inicial': ini,
      'Est. Final': fim,
      Fase: t.fase,
      Ensaio: t.ensaioNome,
      Status: STATUS_LABEL[t.status] ?? t.status,
      Resultado: t.resultado ?? '',
      'Data execução': fmtData(t.dataExecucao),
    }
  })
  const ws = XLSX.utils.json_to_sheet(linhas)
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
  baixarTexto(csv, `ensaios-${obra.nome}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
}

function baixarTexto(conteudo: string, nome: string, tipo: string): void {
  const blob = new Blob(['﻿' + conteudo], { type: `${tipo};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

// ---- Backup / restauração completos --------------------------

export interface BackupData {
  formato: 'ensaios-pavimentacao-backup'
  versao: 1
  exportadoEm: string
  obras: unknown[]
  materiais: unknown[]
  ensaios: unknown[]
  producoes: unknown[]
  execucoes: unknown[]
  eventos: unknown[]
}

export async function exportarBackup(): Promise<void> {
  const dados: BackupData = {
    formato: 'ensaios-pavimentacao-backup',
    versao: 1,
    exportadoEm: new Date().toISOString(),
    obras: await db.obras.toArray(),
    materiais: await db.materiais.toArray(),
    ensaios: await db.ensaios.toArray(),
    producoes: await db.producoes.toArray(),
    execucoes: await db.execucoes.toArray(),
    eventos: await db.eventos.toArray(),
  }
  baixarTexto(
    JSON.stringify(dados, null, 2),
    `backup-ensaios-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json',
  )
}

export async function importarBackup(texto: string): Promise<void> {
  const dados = JSON.parse(texto) as BackupData
  if (dados.formato !== 'ensaios-pavimentacao-backup')
    throw new Error('Arquivo de backup inválido.')
  await db.transaction(
    'rw',
    [db.obras, db.materiais, db.ensaios, db.producoes, db.execucoes, db.eventos],
    async () => {
      await Promise.all([
        db.obras.bulkPut(dados.obras as never),
        db.materiais.bulkPut(dados.materiais as never),
        db.ensaios.bulkPut(dados.ensaios as never),
        db.producoes.bulkPut(dados.producoes as never),
        db.execucoes.bulkPut(dados.execucoes as never),
        db.eventos.bulkPut((dados.eventos ?? []) as never),
      ])
    },
  )
}
