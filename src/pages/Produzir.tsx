import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { PlusCircle, Trash2, MapPin, ArrowRight, Layers, ClipboardPaste } from 'lucide-react'
import { db, salvarProducao, excluirProducao } from '@/db'
import { useApp } from '@/state/appStore'
import { EmptyState, SectionTitle } from '@/components/ui'
import { extensaoEntre } from '@/lib/estacas'
import type { Ensaio, Lado, Producao } from '@/types'

const hoje = () => new Date().toISOString().slice(0, 10)
const LADOS: Lado[] = ['LD', 'LE', 'EIXO', 'BORDO', 'UNICO']
const LADO_LABEL: Record<Lado, string> = {
  LD: 'Lado direito',
  LE: 'Lado esquerdo',
  EIXO: 'Eixo',
  BORDO: 'Bordo',
  UNICO: 'Único',
}

export function Produzir() {
  const { obra } = useApp()
  const ensaios = useLiveQuery(
    () => (obra ? db.ensaios.where('obraId').equals(obra.id).toArray() : Promise.resolve([] as Ensaio[])),
    [obra?.id],
  )
  const materiais = useMemo(() => {
    const s = new Set<string>()
    for (const e of ensaios ?? []) s.add(e.materialNome)
    return [...s]
  }, [ensaios])

  const [data, setData] = useState(hoje())
  const [material, setMaterial] = useState('')
  const [grupo, setGrupo] = useState('')
  const [lado, setLado] = useState<Lado>('LD')
  const [estIni, setEstIni] = useState('')
  const [estFim, setEstFim] = useState('')
  const [ton, setTon] = useState('')
  const [vol, setVol] = useState('')
  const [cargas, setCargas] = useState('')
  const [nfs, setNfs] = useState('')
  const [fonte, setFonte] = useState(false)
  const [fonteDesc, setFonteDesc] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')

  const materialAtual = material || materiais[0] || ''
  const grupos = useMemo(() => {
    const s = new Set<string>()
    for (const e of ensaios ?? []) if (e.materialNome === materialAtual && e.grupo) s.add(e.grupo)
    return [...s]
  }, [ensaios, materialAtual])

  // Campos que fazem sentido para o material/serviço selecionado
  const tipos = useMemo(() => {
    const set = new Set<string>()
    for (const e of ensaios ?? [])
      if (e.materialNome === materialAtual && (!grupo || e.grupo === grupo || !e.grupo)) {
        set.add(e.freq.tipo)
        for (const a of e.freq.alternativas ?? []) set.add(a.tipo)
      }
    return set
  }, [ensaios, materialAtual, grupo])

  const extensao = extensaoEntre(estIni, estFim, obra?.metrosPorEstaca)

  const producoesDia = useLiveQuery(
    () =>
      obra
        ? db.producoes.where('obraId').equals(obra.id).and((p) => p.data === data).toArray()
        : Promise.resolve([] as Producao[]),
    [obra?.id, data],
  )

  if (!obra) return <SemObra />
  if (ensaios && ensaios.length === 0) return <SemChecklist />

  async function lancar() {
    setErro('')
    if (!materialAtual) return setErro('Escolha o material.')
    if ((estIni || estFim) && extensao == null)
      return setErro('Estacas inválidas. Use o formato 885+10.')
    await salvarProducao({
      obraId: obra!.id,
      data,
      materialId: '',
      materialNome: materialAtual,
      grupo: grupo || undefined,
      lado,
      estacaInicial: estIni || undefined,
      estacaFinal: estFim || undefined,
      extensaoM: extensao ?? undefined,
      toneladas: ton ? parseFloat(ton.replace(',', '.')) : undefined,
      volumeM3: vol ? parseFloat(vol.replace(',', '.')) : undefined,
      carregamentos: cargas ? parseInt(cargas, 10) : undefined,
      notasFiscais: nfs ? nfs.split(/[,\n;]+/).map((x) => x.trim()).filter(Boolean) : undefined,
      mudancaFonte: fonte || undefined,
      fonteDescricao: fonte ? fonteDesc || undefined : undefined,
      observacao: obs || undefined,
    })
    // limpa campos de trecho, mantém data/material para lançamento rápido
    setEstIni('')
    setEstFim('')
    setTon('')
    setVol('')
    setCargas('')
    setNfs('')
    setFonte(false)
    setFonteDesc('')
    setObs('')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Lançar produção</h1>
          <p className="mt-1 text-sm text-ink-faint">
            Informe o que foi executado. O app calcula os ensaios automaticamente.
          </p>
        </div>
        <Link to="/lote" className="btn-ghost hidden sm:inline-flex">
          <ClipboardPaste size={16} /> Lançar em lote
        </Link>
      </div>

      <div className="card p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label>
            <span className="label">Data</span>
            <input type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} />
          </label>
          <label>
            <span className="label">Material / serviço</span>
            <select
              className="input"
              value={materialAtual}
              onChange={(e) => {
                setMaterial(e.target.value)
                setGrupo('')
              }}
            >
              {materiais.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          {grupos.length > 0 && (
            <label>
              <span className="label">
                <Layers size={11} className="mb-0.5 mr-1 inline" />
                Serviço específico
              </span>
              <select className="input" value={grupo} onChange={(e) => setGrupo(e.target.value)}>
                <option value="">Todos os serviços de {materialAtual}</option>
                {grupos.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="label">Lado</span>
            <select className="input" value={lado} onChange={(e) => setLado(e.target.value as Lado)}>
              {LADOS.map((l) => (
                <option key={l} value={l}>
                  {LADO_LABEL[l]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Estaca inicial</span>
            <input
              className="input"
              placeholder="806+00"
              value={estIni}
              onChange={(e) => setEstIni(e.target.value)}
            />
          </label>
          <label>
            <span className="label">Estaca final</span>
            <input
              className="input"
              placeholder="838+10"
              value={estFim}
              onChange={(e) => setEstFim(e.target.value)}
            />
          </label>
        </div>

        {/* extensão calculada */}
        {(estIni || estFim) && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <MapPin size={15} className="text-brand-500" />
            {extensao != null ? (
              <span className="text-ink-soft">
                Extensão: <strong className="text-ink">{Math.round(extensao)} m</strong>
              </span>
            ) : (
              <span className="text-rose-600">Estacas inválidas (use 885+10)</span>
            )}
          </div>
        )}

        {/* campos adaptativos */}
        {(tipos.has('por_massa') || tipos.has('por_volume') || tipos.has('por_carregamento')) && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {tipos.has('por_massa') && (
              <label>
                <span className="label">Toneladas (t)</span>
                <input className="input" placeholder="0" value={ton} onChange={(e) => setTon(e.target.value)} />
              </label>
            )}
            {tipos.has('por_volume') && (
              <label>
                <span className="label">Volume (m³)</span>
                <input className="input" placeholder="0" value={vol} onChange={(e) => setVol(e.target.value)} />
              </label>
            )}
            {tipos.has('por_carregamento') && (
              <>
                <label>
                  <span className="label">Nº de carregamentos</span>
                  <input
                    className="input"
                    placeholder="0"
                    value={cargas}
                    onChange={(e) => setCargas(e.target.value)}
                  />
                </label>
                <label>
                  <span className="label">Notas fiscais (opcional)</span>
                  <input
                    className="input"
                    placeholder="NF 123, NF 124"
                    value={nfs}
                    onChange={(e) => setNfs(e.target.value)}
                  />
                </label>
              </>
            )}
          </div>
        )}

        {tipos.has('por_mudanca_de_fonte') && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-rose-50/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-rose-700">
              <input type="checkbox" checked={fonte} onChange={(e) => setFonte(e.target.checked)} />
              Houve mudança de fonte de agregado/ligante
            </label>
            {fonte && (
              <input
                className="input max-w-xs"
                placeholder="Nova fonte / fornecedor"
                value={fonteDesc}
                onChange={(e) => setFonteDesc(e.target.value)}
              />
            )}
          </div>
        )}

        <label className="mt-4 block">
          <span className="label">Observação (opcional)</span>
          <input className="input" value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>

        {erro && <div className="mt-3 text-sm text-rose-600">{erro}</div>}

        <button className="btn-primary mt-5" onClick={lancar}>
          <PlusCircle size={16} /> Lançar produção
        </button>
      </div>

      {/* lançamentos do dia */}
      <div>
        <SectionTitle
          right={
            <Link to="/" className="btn-soft">
              Ver ensaios do dia <ArrowRight size={15} />
            </Link>
          }
        >
          Lançamentos de {formatarData(data)}
        </SectionTitle>
        {!producoesDia || producoesDia.length === 0 ? (
          <div className="card p-6 text-center text-sm text-ink-faint">
            Nenhum lançamento neste dia ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {producoesDia.map((p) => (
              <div key={p.id} className="card flex items-center justify-between px-4 py-3">
                <div className="min-w-0 text-sm">
                  <span className="font-semibold text-ink">{p.materialNome}</span>
                  {p.grupo && <span className="text-ink-soft"> · {p.grupo}</span>}
                  <span className="text-ink-faint">
                    {' '}
                    · {p.lado}
                    {p.estacaInicial && ` · ${p.estacaInicial}→${p.estacaFinal}`}
                    {p.extensaoM != null && ` (${Math.round(p.extensaoM)} m)`}
                    {p.toneladas != null && ` · ${p.toneladas} t`}
                    {p.volumeM3 != null && ` · ${p.volumeM3} m³`}
                    {p.carregamentos != null && ` · ${p.carregamentos} carga(s)`}
                    {p.mudancaFonte && ' · ⚠ mudança de fonte'}
                  </span>
                </div>
                <button
                  className="btn-ghost !px-2 text-rose-500 hover:bg-rose-50"
                  onClick={() => excluirProducao(p.id)}
                  title="Excluir lançamento"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatarData(iso: string): string {
  const [a, m, d] = iso.split('-')
  return d ? `${d}/${m}/${a}` : iso
}

function SemObra() {
  return (
    <EmptyState
      icone={<PlusCircle size={40} />}
      titulo="Nenhuma obra selecionada"
      descricao="Crie uma obra e importe o checklist para lançar produção."
      acao={
        <Link to="/obras" className="btn-primary">
          Ir para Obras
        </Link>
      }
    />
  )
}

function SemChecklist() {
  return (
    <EmptyState
      icone={<PlusCircle size={40} />}
      titulo="Importe o checklist primeiro"
      descricao="O lançamento de produção usa o checklist da obra para calcular os ensaios."
      acao={
        <Link to="/importar" className="btn-primary">
          Importar checklist
        </Link>
      }
    />
  )
}
