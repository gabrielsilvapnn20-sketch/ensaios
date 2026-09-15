import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'
import { importarChecklist, type ImportResult } from '@/lib/xlsxImport'
import { NOMES_TIPO } from '@/lib/frequencia'
import { FreqChip, FaseBadge, SectionTitle } from '@/components/ui'
import { criarObra, salvarChecklistImportado, type DiffChecklist } from '@/db'
import { useApp } from '@/state/appStore'

export function Importar() {
  const { obra, obras, selecionarObra } = useApp()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [resultado, setResultado] = useState<ImportResult | null>(null)
  const [arquivo, setArquivo] = useState<string>('')
  const [erro, setErro] = useState<string>('')
  const [salvando, setSalvando] = useState(false)
  const [diff, setDiff] = useState<DiffChecklist | null>(null)
  const [novaObra, setNovaObra] = useState(false)
  const [nomeObra, setNomeObra] = useState('')

  async function processarArquivo(file: File) {
    setErro('')
    setDiff(null)
    try {
      const buf = await file.arrayBuffer()
      const res = importarChecklist(buf)
      if (res.materiais.length === 0) {
        setErro('Não encontrei nenhuma aba de material com ensaios neste arquivo.')
        return
      }
      setResultado(res)
      setArquivo(file.name)
      if (!obra) {
        setNovaObra(true)
        setNomeObra(res.obraInfo.rodovia || res.obraInfo.objeto || 'Minha obra')
      }
    } catch (e) {
      setErro('Não consegui ler o arquivo. Confirme que é um .xlsx válido. (' + (e as Error).message + ')')
    }
  }

  async function salvar() {
    if (!resultado) return
    setSalvando(true)
    try {
      let obraId = obra?.id
      if (novaObra || !obraId) {
        const o = await criarObra({
          nome: nomeObra || 'Minha obra',
          rodovia: resultado.obraInfo.rodovia,
          contrato: resultado.obraInfo.contrato,
          trecho: resultado.obraInfo.trecho,
          contratada: resultado.obraInfo.contratada,
        })
        obraId = o.id
        selecionarObra(o.id)
      }
      const d = await salvarChecklistImportado(obraId!, resultado, arquivo)
      setDiff(d)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Importar checklist</h1>
        <p className="mt-1 text-sm text-ink-faint">
          Envie a planilha GOINFRA (.xlsx). O app lê cada aba, entende as frequências e monta o
          checklist da obra. As colunas <em>Qtd. Apres</em> e <em>Qtd. de Norma</em> são ignoradas.
        </p>
      </div>

      {/* Área de upload */}
      <div
        className="card cursor-pointer border-2 border-dashed border-brand-200 bg-brand-50/40 p-8 text-center transition-colors hover:bg-brand-50"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files?.[0]
          if (f) processarArquivo(f)
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) processarArquivo(f)
          }}
        />
        <UploadCloud className="mx-auto text-brand-500" size={40} />
        <div className="mt-3 font-semibold text-ink">Clique ou arraste o arquivo .xlsx</div>
        <div className="text-sm text-ink-faint">Checklist de ensaios no formato da supervisora</div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      {diff && <ResumoSalvo diff={diff} onIr={() => navigate('/checklist')} />}

      {resultado && !diff && (
        <>
          {/* Metadados detectados */}
          <div className="card p-5">
            <SectionTitle>Detectado no arquivo</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              <Info k="Contratada" v={resultado.obraInfo.contratada} />
              <Info k="Rodovia" v={resultado.obraInfo.rodovia} />
              <Info k="Contrato" v={resultado.obraInfo.contrato} />
              <Info k="Medição" v={resultado.obraInfo.medicao} />
              <Info k="Trecho" v={resultado.obraInfo.trecho} />
              <Info k="Objeto" v={resultado.obraInfo.objeto} />
            </div>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <span className="chip bg-brand-50 text-brand-700">
                {resultado.materiais.length} materiais
              </span>
              <span className="chip bg-emerald-50 text-emerald-700">
                {resultado.totalEnsaios} ensaios
              </span>
              {resultado.ignoradas.length > 0 && (
                <span className="chip bg-slate-100 text-slate-500">
                  Ignoradas: {resultado.ignoradas.join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Onde salvar */}
          <div className="card p-5">
            <SectionTitle>Salvar em</SectionTitle>
            {obras && obras.length > 0 && (
              <label className="mb-3 flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={!novaObra}
                  onChange={() => setNovaObra(false)}
                />
                Obra atual: <strong>{obra?.nome ?? '—'}</strong>
                <span className="text-ink-faint">(mantém o histórico já lançado)</span>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={novaObra} onChange={() => setNovaObra(true)} />
              Criar nova obra:
              <input
                className="input max-w-xs"
                placeholder="Nome da obra"
                value={nomeObra}
                onChange={(e) => setNomeObra(e.target.value)}
                onFocus={() => setNovaObra(true)}
              />
            </label>
            <button className="btn-primary mt-4" onClick={salvar} disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar checklist'}
              <ArrowRight size={16} />
            </button>
          </div>

          {/* Prévia por material */}
          <div className="space-y-4">
            <SectionTitle>Prévia da interpretação</SectionTitle>
            {resultado.materiais.map((m) => (
              <PreviaMaterial key={m.nome} material={m} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Info({ k, v }: { k: string; v?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{k}</div>
      <div className="text-ink">{v || '—'}</div>
    </div>
  )
}

function PreviaMaterial({ material }: { material: ImportResult['materiais'][number] }) {
  const [aberto, setAberto] = useState(false)
  const tipos = new Map<string, number>()
  for (const e of material.ensaios) tipos.set(e.freq.tipo, (tipos.get(e.freq.tipo) ?? 0) + 1)

  return (
    <div className="card overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-black/[0.02]"
        onClick={() => setAberto((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="text-brand-500" size={18} />
          <span className="font-semibold text-ink">{material.nome}</span>
          <span className="text-sm text-ink-faint">{material.ensaios.length} ensaios</span>
        </div>
        <div className="hidden flex-wrap justify-end gap-1.5 sm:flex">
          {[...tipos.entries()].map(([t, n]) => (
            <span key={t} className="chip bg-slate-100 text-slate-600">
              {NOMES_TIPO[t as keyof typeof NOMES_TIPO]} {n}
            </span>
          ))}
        </div>
      </button>
      {aberto && (
        <div className="border-t border-black/[0.06]">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-5 py-2 font-semibold">Fase</th>
                <th className="px-3 py-2 font-semibold">Ensaio / Verificação</th>
                <th className="px-3 py-2 font-semibold">Und</th>
                <th className="px-3 py-2 font-semibold">Frequência</th>
              </tr>
            </thead>
            <tbody>
              {material.ensaios.map((e, i) => (
                <tr key={i} className="border-t border-black/[0.04]">
                  <td className="px-5 py-2 align-top">
                    <FaseBadge fase={e.fase} />
                  </td>
                  <td className="px-3 py-2 align-top">
                    {e.grupo && <div className="text-[11px] text-ink-faint">{e.grupo}</div>}
                    <div className="text-ink">{e.nome}</div>
                  </td>
                  <td className="px-3 py-2 align-top text-ink-faint">{e.unidade || '—'}</td>
                  <td className="px-3 py-2 align-top">
                    <FreqChip freq={e.freq} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ResumoSalvo({ diff, onIr }: { diff: DiffChecklist; onIr: () => void }) {
  return (
    <div className="card border-emerald-200 bg-emerald-50/50 p-5">
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 size={20} />
        <span className="font-semibold">
          {diff.primeiraVez ? 'Checklist importado com sucesso!' : 'Checklist atualizado!'}
        </span>
      </div>
      {!diff.primeiraVez && (
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <span className="chip bg-emerald-100 text-emerald-700">{diff.adicionados} adicionados</span>
          <span className="chip bg-amber-100 text-amber-700">{diff.alterados} alterados</span>
          <span className="chip bg-rose-100 text-rose-700">{diff.removidos} removidos</span>
          <span className="text-ink-faint">Histórico de produção preservado.</span>
        </div>
      )}
      <button className="btn-primary mt-4" onClick={onIr}>
        Ver checklist da obra
        <ArrowRight size={16} />
      </button>
    </div>
  )
}
