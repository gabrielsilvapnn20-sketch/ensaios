import Dexie, { type Table } from 'dexie'
import type {
  Ensaio,
  Evento,
  ExecucaoEnsaio,
  Material,
  Obra,
  Producao,
} from './types'
import type { ImportResult } from './lib/xlsxImport'
import { METROS_POR_ESTACA_PADRAO } from './lib/estacas'

// =============================================================
// Banco local (IndexedDB via Dexie). Tudo fica no navegador do
// usuário — offline, privado, persistente entre sessões.
// =============================================================

class EnsaiosDB extends Dexie {
  obras!: Table<Obra, string>
  materiais!: Table<Material, string>
  ensaios!: Table<Ensaio, string>
  producoes!: Table<Producao, string>
  execucoes!: Table<ExecucaoEnsaio, string>
  eventos!: Table<Evento, string>
  config!: Table<{ chave: string; valor: unknown }, string>

  constructor() {
    super('ensaios-pavimentacao')
    this.version(1).stores({
      obras: 'id, nome, criadoEm',
      materiais: 'id, obraId, nome, ordem',
      ensaios: 'id, obraId, materialId, fase',
      producoes: 'id, obraId, data, materialId',
      execucoes: 'id, obraId',
      eventos: 'id, obraId, tipo, materialId',
      config: 'chave',
    })
  }
}

export const db = new EnsaiosDB()

export const uid = (): string =>
  (crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`)

// ---- Config (obra atual selecionada) ------------------------

export async function getObraAtualId(): Promise<string | undefined> {
  const row = await db.config.get('obraAtual')
  return row?.valor as string | undefined
}

export async function setObraAtualId(id: string | undefined): Promise<void> {
  await db.config.put({ chave: 'obraAtual', valor: id })
}

// ---- Obras --------------------------------------------------

export async function criarObra(dados: Partial<Obra> & { nome: string }): Promise<Obra> {
  const agora = Date.now()
  const obra: Obra = {
    id: uid(),
    nome: dados.nome,
    rodovia: dados.rodovia,
    contrato: dados.contrato,
    trecho: dados.trecho,
    contratada: dados.contratada,
    metrosPorEstaca: dados.metrosPorEstaca ?? METROS_POR_ESTACA_PADRAO,
    criadoEm: agora,
    atualizadoEm: agora,
  }
  await db.obras.add(obra)
  await setObraAtualId(obra.id)
  return obra
}

export async function excluirObra(obraId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.obras, db.materiais, db.ensaios, db.producoes, db.execucoes, db.eventos],
    async () => {
      await db.ensaios.where('obraId').equals(obraId).delete()
      await db.materiais.where('obraId').equals(obraId).delete()
      await db.producoes.where('obraId').equals(obraId).delete()
      await db.execucoes.where('obraId').equals(obraId).delete()
      await db.eventos.where('obraId').equals(obraId).delete()
      await db.obras.delete(obraId)
    },
  )
  const atual = await getObraAtualId()
  if (atual === obraId) {
    const outra = await db.obras.toCollection().first()
    await setObraAtualId(outra?.id)
  }
}

// ---- Importação do checklist --------------------------------

export interface DiffChecklist {
  adicionados: number
  removidos: number
  alterados: number
  primeiraVez: boolean
}

/**
 * Grava (ou atualiza) o checklist importado de uma obra.
 * Substitui as regras de ensaio, mas **preserva** produção, execuções e
 * eventos já lançados. Retorna um resumo do que mudou.
 */
export async function salvarChecklistImportado(
  obraId: string,
  resultado: ImportResult,
  arquivo?: string,
): Promise<DiffChecklist> {
  return db.transaction('rw', [db.obras, db.materiais, db.ensaios], async () => {
    const antigos = await db.ensaios.where('obraId').equals(obraId).toArray()
    const primeiraVez = antigos.length === 0

    // chave lógica de um ensaio: material|fase|nome
    const chave = (materialNome: string, fase: string, nome: string) =>
      `${materialNome}||${fase}||${nome}`.toLowerCase()
    const antigosMap = new Map(antigos.map((e) => [chave(e.materialNome, e.fase, e.nome), e]))

    // Limpa e regrava materiais/ensaios
    await db.ensaios.where('obraId').equals(obraId).delete()
    await db.materiais.where('obraId').equals(obraId).delete()

    let adicionados = 0
    let alterados = 0
    const novasChaves = new Set<string>()

    let ordemMat = 0
    for (const mat of resultado.materiais) {
      const materialId = uid()
      await db.materiais.add({
        id: materialId,
        obraId,
        nome: mat.nome,
        normaResumo: mat.normaResumo,
        ordem: ordemMat++,
        ativo: true,
      })
      let ordemEns = 0
      for (const e of mat.ensaios) {
        const k = chave(mat.nome, e.fase, e.nome)
        novasChaves.add(k)
        const antigo = antigosMap.get(k)
        if (!antigo) adicionados++
        else if (antigo.freq.textoOriginal !== e.freq.textoOriginal) alterados++
        await db.ensaios.add({
          id: uid(),
          obraId,
          materialId,
          materialNome: mat.nome,
          fase: e.fase,
          grupo: e.grupo,
          nome: e.nome,
          unidade: e.unidade,
          norma: e.norma,
          freq: e.freq,
          ordem: ordemEns++,
          ativo: true,
        })
      }
    }

    const removidos = antigos.filter((e) => !novasChaves.has(chave(e.materialNome, e.fase, e.nome)))
      .length

    await db.obras.update(obraId, {
      checklistImportadoEm: Date.now(),
      checklistArquivo: arquivo,
      atualizadoEm: Date.now(),
    })

    return { adicionados, removidos, alterados, primeiraVez }
  })
}
