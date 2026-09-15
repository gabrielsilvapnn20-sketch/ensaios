import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { calcularTarefas, type Tarefa } from '@/lib/engine'
import type { Ensaio, ExecucaoEnsaio, Producao } from '@/types'
import { useApp } from './appStore'

/** Calcula todas as tarefas da obra atual, reativo às mudanças no banco. */
export function useTarefas(): { tarefas: Tarefa[] | undefined; carregando: boolean } {
  const { obra } = useApp()

  const ensaios = useLiveQuery(
    () => (obra ? db.ensaios.where('obraId').equals(obra.id).toArray() : Promise.resolve([] as Ensaio[])),
    [obra?.id],
  )
  const producoes = useLiveQuery(
    () => (obra ? db.producoes.where('obraId').equals(obra.id).toArray() : Promise.resolve([] as Producao[])),
    [obra?.id],
  )
  const execucoes = useLiveQuery(
    () =>
      obra
        ? db.execucoes.where('obraId').equals(obra.id).toArray()
        : Promise.resolve([] as ExecucaoEnsaio[]),
    [obra?.id],
  )

  const tarefas = useMemo(() => {
    if (!ensaios || !producoes || !execucoes) return undefined
    const mapa = new Map(execucoes.map((e) => [e.id, e]))
    return calcularTarefas({
      ensaios,
      producoes,
      execucoes: mapa,
      metrosPorEstaca: obra?.metrosPorEstaca,
    })
  }, [ensaios, producoes, execucoes, obra?.metrosPorEstaca])

  return { tarefas, carregando: tarefas === undefined }
}
