import { PlusCircle } from 'lucide-react'
import { EmptyState } from '@/components/ui'

export function Produzir() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Lançar produção</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Data, material, lado e estaqueamento do que foi executado no dia.
        </p>
      </div>
      <div className="card">
        <EmptyState
          icone={<PlusCircle size={40} />}
          titulo="Etapa 2 — em construção"
          descricao="A tela de lançamento rápido (com lançamento em lote) é a próxima etapa. O checklist já está importado e pronto para alimentar o cálculo."
        />
      </div>
    </div>
  )
}
