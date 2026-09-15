import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getObraAtualId, setObraAtualId } from '@/db'
import type { Obra } from '@/types'

interface AppState {
  obras: Obra[] | undefined
  obra: Obra | undefined
  obraId: string | undefined
  selecionarObra: (id: string | undefined) => void
  carregando: boolean
}

const Ctx = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const obras = useLiveQuery(() => db.obras.orderBy('criadoEm').toArray(), [])
  const [obraId, setObraId] = useState<string | undefined>(undefined)
  const [pronto, setPronto] = useState(false)

  // Carrega a obra atual salva no banco na primeira renderização.
  useEffect(() => {
    getObraAtualId().then((id) => {
      setObraId(id)
      setPronto(true)
    })
  }, [])

  // Se não houver obra selecionada mas existir alguma, seleciona a primeira.
  useEffect(() => {
    if (!pronto || !obras) return
    if (obraId && obras.some((o) => o.id === obraId)) return
    const primeira = obras[0]?.id
    if (primeira !== obraId) {
      setObraId(primeira)
      setObraAtualId(primeira)
    }
  }, [obras, obraId, pronto])

  const selecionarObra = (id: string | undefined) => {
    setObraId(id)
    setObraAtualId(id)
  }

  const obra = useMemo(() => obras?.find((o) => o.id === obraId), [obras, obraId])

  const value: AppState = {
    obras,
    obra,
    obraId,
    selecionarObra,
    carregando: !pronto || obras === undefined,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useApp deve ser usado dentro de <AppProvider>')
  return v
}
