// =============================================================
// Modelo de dados do app de controle de ensaios de pavimentação
// =============================================================

/** Fase da verificação dentro da aba do material (padrão GOINFRA). */
export type Fase = 'INSUMO' | 'PRODUCAO' | 'PRODUTO'

/** Lado da pista onde o serviço foi executado. */
export type Lado = 'LD' | 'LE' | 'EIXO' | 'BORDO' | 'UNICO'

/** Tipos estruturados de frequência de ensaio. */
export type FrequenciaTipo =
  | 'por_distancia' //  1/300 m, 1/40 m ...
  | 'por_volume' //     1/1000 m³
  | 'por_massa' //      1 ensaio/200 t
  | 'por_carregamento' //1 ensaio/carga, 1 por carregamento
  | 'por_jornada' //    1 por jornada, 2 determinações por dia, 8 medidas/dia
  | 'por_mudanca_de_fonte' // ocorrer mudança de fonte de agregado
  | 'periodico_certificado' // certificado 12 meses, 1 por mês
  | 'visual_obrigatorio' // verificação visual obrigatória
  | 'combinado' //      "1/300 m OU por jornada"
  | 'outro' //          não classificável — guardar texto e classificar à mão

export type UnidadeBase = 'm' | 'm3' | 't'

/** Especificação estruturada da frequência de um ensaio. */
export interface FrequenciaSpec {
  tipo: FrequenciaTipo
  /** Intervalo na unidade base (ex.: 300 para "1/300 m", 200 para "200 t"). */
  intervalo?: number
  unidadeBase?: UnidadeBase
  /** Ocorrências por evento (ex.: "2 determinações por dia" => 2; "8 medidas" => 8). */
  qtdPorEvento?: number
  /** Periodicidade em meses (certificado 12 meses, "1 por mês" => 1). */
  meses?: number
  /** Multiplica por faixa/pano/lado (ex.: "por faixa de aplicação", "por pano LD e LE"). */
  porFaixa?: boolean
  /** Alternativas quando o tipo é "combinado". */
  alternativas?: FrequenciaSpec[]
  /** Texto original exato da coluna PARÂMETRO DE NORMA. */
  textoOriginal: string
  /** Notas extraídas do texto ("se previsto em projeto", "por faixa", etc.). */
  observacao?: string
  /** Confiança da classificação automática. */
  confianca: 'alta' | 'media' | 'baixa'
}

/** Obra / trecho. Cada obra tem seu próprio checklist e histórico. */
export interface Obra {
  id: string
  nome: string
  rodovia?: string
  contrato?: string
  trecho?: string
  contratada?: string
  /** Metros por estaca (padrão brasileiro = 20 m). Configurável por segurança. */
  metrosPorEstaca: number
  criadoEm: number
  atualizadoEm: number
  checklistImportadoEm?: number
  checklistArquivo?: string
}

/** Material / serviço (uma aba do checklist). */
export interface Material {
  id: string
  obraId: string
  nome: string
  normaResumo?: string
  ordem: number
  ativo: boolean
}

/** Item de ensaio/verificação do checklist. */
export interface Ensaio {
  id: string
  obraId: string
  materialId: string
  materialNome: string
  fase: Fase
  /** Subgrupo dentro da fase (ex.: "AGREGADOS", "LIGANTES", "BASE BGS"). */
  grupo?: string
  nome: string
  unidade?: string
  norma?: string
  freq: FrequenciaSpec
  ordem: number
  ativo: boolean
}

/** Lançamento de produção de um dia. */
export interface Producao {
  id: string
  obraId: string
  data: string // ISO yyyy-mm-dd
  materialId: string
  materialNome: string
  lado?: Lado
  /** Estaca inicial no formato "estaca+metro" (ex.: "885+10"). */
  estacaInicial?: string
  estacaFinal?: string
  /** Extensão em metros (calculada das estacas ou informada). */
  extensaoM?: number
  toneladas?: number
  volumeM3?: number
  /** Nº de carregamentos/notas fiscais recebidos (insumos por carga). */
  carregamentos?: number
  notasFiscais?: string[]
  /** Marca que houve troca de fonte de agregado/ligante neste lançamento. */
  mudancaFonte?: boolean
  fonteDescricao?: string
  observacao?: string
  criadoEm: number
}

export type StatusTarefa = 'pendente' | 'feito' | 'na'

/**
 * Status de execução de uma ocorrência de ensaio exigida.
 * A ocorrência é derivada pelo motor de cálculo; aqui guardamos apenas
 * o estado marcado pelo usuário, com chave estável.
 */
export interface ExecucaoEnsaio {
  /** Chave estável da ocorrência (ver engine.gerarChaveOcorrencia). */
  id: string
  obraId: string
  status: StatusTarefa
  resultado?: string
  dataExecucao?: string // ISO yyyy-mm-dd
  observacao?: string
  atualizadoEm: number
}

/** Eventos cumulativos: mudança de fonte, emissão/renovação de certificado. */
export interface Evento {
  id: string
  obraId: string
  tipo: 'mudanca_fonte' | 'certificado'
  materialId?: string
  ensaioId?: string
  data: string // ISO
  descricao?: string
  criadoEm: number
}
