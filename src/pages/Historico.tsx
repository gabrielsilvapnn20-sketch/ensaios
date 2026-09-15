import { History } from 'lucide-react'
import { EmptyState } from '@/components/ui'

export function Historico() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Histórico</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Tudo que foi lançado e executado, por material, período, estaca e status.
        </p>
      </div>
      <div className="card">
        <EmptyState
          icone={<History size={40} />}
          titulo="Etapa 5 — em construção"
          descricao="O histórico e o indicador de aderência (exigido vs. feito) chegam depois do motor de cálculo e do checklist diário."
        />
      </div>
    </div>
  )
}
