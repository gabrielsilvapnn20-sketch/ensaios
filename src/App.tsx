import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { useApp } from './state/appStore'
import { Hoje } from './pages/Hoje'
import { Produzir } from './pages/Produzir'
import { Lote } from './pages/Lote'
import { ChecklistView } from './pages/ChecklistView'
import { Historico } from './pages/Historico'
import { Obras } from './pages/Obras'
import { Importar } from './pages/Importar'

export default function App() {
  const [drawer, setDrawer] = useState(false)
  const { carregando } = useApp()
  const location = useLocation()

  return (
    <div className="flex h-full">
      {/* Sidebar desktop */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full shadow-float" onClick={() => setDrawer(false)}>
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (mobile) */}
        <header className="flex items-center gap-3 border-b border-black/[0.06] bg-white/80 px-4 py-3 backdrop-blur md:hidden">
          <button className="btn-ghost !px-2" onClick={() => setDrawer((v) => !v)}>
            {drawer ? <X size={20} /> : <Menu size={20} />}
          </button>
          <span className="font-semibold text-ink">Ensaios</span>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-5 py-6 md:px-8 md:py-8">
            {carregando ? (
              <div className="py-24 text-center text-ink-faint">Carregando…</div>
            ) : (
              <Routes key={location.pathname.split('/')[1]}>
                <Route path="/" element={<Hoje />} />
                <Route path="/produzir" element={<Produzir />} />
                <Route path="/lote" element={<Lote />} />
                <Route path="/checklist" element={<ChecklistView />} />
                <Route path="/historico" element={<Historico />} />
                <Route path="/obras" element={<Obras />} />
                <Route path="/importar" element={<Importar />} />
                <Route path="*" element={<Hoje />} />
              </Routes>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
