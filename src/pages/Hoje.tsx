import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarCheck, Upload, PlusCircle, Sparkles } from 'lucide-react'
import { db } from '@/db'
import { useApp } from '@/state/appStore'
import { EmptyState } from '@/components/ui'

export function Hoje() {
  const { obra } = useApp()
  const nEnsaios = useLiveQuery(
    () => (obra ? db.ensaios.where('obraId').equals(obra.id).count() : Promise.resolve(0)),
    [obra?.id],
  )

  if (!obra) {
    return (
      <EmptyState
        icone={<Upload size={40} />}
        titulo="Bem-vindo 👋"
        descricao="Comece importando o checklist da sua obra. O app lê a planilha, entende as frequências e monta tudo pra você."
        acao={
          <Link to="/importar" className="btn-primary">
            Importar checklist
          </Link>
        }
      />
    )
  }

  if (!nEnsaios) {
    return (
      <EmptyState
        icone={<Upload size={40} />}
        titulo={`Obra "${obra.nome}" sem checklist`}
        descricao="Importe a planilha .xlsx desta obra para liberar o restante do app."
        acao={
          <Link to="/importar" className="btn-primary">
            Importar checklist
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Hoje</h1>
        <p className="mt-1 text-sm text-ink-faint">
          {obra.nome} · checklist pronto com {nEnsaios} ensaios.
        </p>
      </div>

      <div className="card border-brand-100 bg-gradient-to-br from-brand-50 to-white p-6">
        <div className="flex items-center gap-2 text-brand-700">
          <Sparkles size={18} />
          <span className="font-semibold">Checklist importado com sucesso</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-ink-soft">
          O próximo passo é <strong>lançar a produção do dia</strong> (material, lado e
          estaqueamento). A partir daí o app vai calcular automaticamente quais ensaios você precisa
          fazer, quantos, e em qual estaca — inclusive os cumulativos (por tonelada, mudança de
          fonte, certificado).
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/produzir" className="btn-primary">
            <PlusCircle size={16} /> Lançar produção
          </Link>
          <Link to="/checklist" className="btn-soft">
            <CalendarCheck size={16} /> Ver checklist da obra
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-dashed border-black/10 p-5 text-sm text-ink-faint">
        <strong className="text-ink-soft">Em construção:</strong> o painel “o que fazer hoje” com a
        lista de tarefas por dia aparece aqui assim que a Etapa 3 (motor de cálculo) e a Etapa 4
        (checklist diário) estiverem prontas.
      </div>
    </div>
  )
}
