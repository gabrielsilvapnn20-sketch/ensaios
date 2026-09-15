import { NavLink } from 'react-router-dom'
import {
  CalendarCheck,
  ClipboardList,
  FileSpreadsheet,
  History,
  PlusCircle,
  Building2,
  ChevronDown,
} from 'lucide-react'
import { useApp } from '@/state/appStore'

const links = [
  { to: '/', label: 'Hoje', icon: CalendarCheck, end: true },
  { to: '/produzir', label: 'Lançar produção', icon: PlusCircle },
  { to: '/checklist', label: 'Checklist da obra', icon: ClipboardList },
  { to: '/historico', label: 'Histórico', icon: History },
  { to: '/obras', label: 'Obras & Importação', icon: FileSpreadsheet },
]

export function Sidebar() {
  const { obras, obra, selecionarObra } = useApp()

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-black/[0.06] bg-white/70 backdrop-blur">
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
            <ClipboardList size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-ink">Ensaios</div>
            <div className="text-[11px] text-ink-faint">Controle de pavimentação</div>
          </div>
        </div>
      </div>

      {/* Seletor de obra */}
      <div className="px-3 pb-3">
        <label className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-500">
            <Building2 size={15} />
          </span>
          <select
            className="input appearance-none pl-8 pr-8 py-2 text-sm font-medium"
            value={obra?.id ?? ''}
            onChange={(e) => selecionarObra(e.target.value || undefined)}
          >
            {(!obras || obras.length === 0) && <option value="">Nenhuma obra</option>}
            {obras?.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint">
            <ChevronDown size={15} />
          </span>
        </label>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-soft hover:bg-black/[0.04] hover:text-ink'
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-[11px] text-ink-faint">
        Dados salvos neste computador.
        <br />
        Offline · privado.
      </div>
    </aside>
  )
}
