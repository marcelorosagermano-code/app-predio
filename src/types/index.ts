export type UserRole = 'admin' | 'sindico' | 'conselho' | 'morador';

export interface UserProfile {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
  cargo?: string; // ex: 'Síndico', 'Administrador', 'Morador', 'Conselheiro'
  telefone?: string;
  avatarUrl?: string;
  condominioId: string;
  unidadeId?: string; // Obrigatório quando role for MORADOR
  unidadeNumero?: string; // ex: '102 - Bloco A'
  ativo: boolean;
  criadoEm: string;
}

export interface Condominio {
  id: string;
  nome: string;
  cnpj?: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep?: string;
  totalUnidades: number;
  sindicoNome: string;
  telefoneContato: string;
  emailContato: string;
  logoUrl?: string;
}

export type SituacaoUnidade = 'OCUPADA_PROPRIETARIO' | 'OCUPADA_INQUILINO' | 'DESOCUPADA' | 'EM_REFORMA';
export type SituacaoFinanceiraUnidade = 'EM_DIA' | 'PENDENTE' | 'INADIMPLENTE';

export interface Unidade {
  id: string;
  condominioId: string;
  numero: string;
  bloco?: string;
  andar?: number;
  metragem?: number;
  fracaoIdeal?: number;
  situacao: SituacaoUnidade;
  situacaoFinanceira: SituacaoFinanceiraUnidade;
  proprietarioNome: string;
  proprietarioEmail: string;
  proprietarioTelefone: string;
  moradorNome?: string;
  moradorEmail?: string;
  moradorTelefone?: string;
  vagasGaragem?: string;
  observacoes?: string;
  criadoEm: string;
  atualizadoEm: string;
}

export type TipoLancamento = 'RECEITA' | 'DESPESA';
export type StatusLancamento = 'PENDENTE' | 'PAGO' | 'ATRASADO' | 'CANCELADO';
export type CategoriaLancamento =
  | 'TAXA_CONDOMINIAL'
  | 'TAXA_EXTRA'
  | 'MANUTENCAO'
  | 'LIMPEZA_CONSERVACAO'
  | 'ENERGIA_ELETRICA'
  | 'AGUA_ESGOTO'
  | 'SEGURANCA'
  | 'PESSOAL'
  | 'ADMINISTRACAO'
  | 'SEGURO'
  | 'OUTROS';

export interface LancamentoFinanceiro {
  id: string;
  condominioId: string;
  unidadeId?: string;
  unidadeNumero?: string;
  tipo: TipoLancamento;
  categoria: CategoriaLancamento;
  descricao: string;
  valor: number;
  dataVencimento: string;
  dataPagamento?: string;
  status: StatusLancamento;
  comprovanteUrl?: string;
  observacoes?: string;
  criadoEm: string;
}

export type StatusManutencao = 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
export type PrioridadeManutencao = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';
export type LocalManutencao = 'AREA_COMUM' | 'ELEVADORES' | 'PORTARIA' | 'GARAGEM' | 'FACHADA' | 'ELETRICA_HIDRAULICA' | 'OUTROS';

export interface Manutencao {
  id: string;
  condominioId: string;
  titulo: string;
  descricao: string;
  local: LocalManutencao;
  localDescricao?: string;
  prioridade: PrioridadeManutencao;
  status: StatusManutencao;
  solicitanteId: string;
  solicitanteNome: string;
  solicitanteUnidade?: string;
  responsavelNome?: string;
  custoEstimado?: number;
  custoReal?: number;
  dataAbertura: string;
  dataPrevisao?: string;
  dataConclusao?: string;
  fotosUrls?: string[];
  historico?: {
    data: string;
    autor: string;
    mensagem: string;
  }[];
}

export type CategoriaComunicado = 'GERAL' | 'URGENTE' | 'MANUTENCAO' | 'OBRAS' | 'REUNIAO' | 'FINANCEIRO';

export interface Comunicado {
  id: string;
  condominioId: string;
  titulo: string;
  conteudo: string;
  categoria: CategoriaComunicado;
  importante: boolean;
  autorId: string;
  autorNome: string;
  dataPublicacao: string;
  dataExpiracao?: string;
  anexosUrls?: string[];
  leiturasConfirmadas?: number;
}

export type CategoriaDocumento =
  | 'CONVENCAO'
  | 'REGIMENTO_INTERNO'
  | 'ATA_ASSEMBLEIA'
  | 'PRESTACAO_CONTAS'
  | 'SEGUROS_LAUDOS'
  | 'CONTRATOS'
  | 'OUTROS';

export interface Documento {
  id: string;
  condominioId: string;
  titulo: string;
  descricao?: string;
  categoria: CategoriaDocumento;
  arquivoUrl: string;
  formato: string; // ex: 'PDF', 'DOCX', 'XLSX'
  tamanhoKb: number;
  visivelParaMoradores: boolean;
  criadoPor: string;
  criadoEm: string;
}

export type StatusAssembleia = 'AGENDADA' | 'EM_ANDAMENTO' | 'REALIZADA' | 'CANCELADA';
export type TipoAssembleia = 'AGO' | 'AGE'; // Ordinária / Extraordinária

export interface Assembleia {
  id: string;
  condominioId: string;
  titulo: string;
  tipo: TipoAssembleia;
  status: StatusAssembleia;
  dataHoraPrimeiraConvocacao: string;
  dataHoraSegundaConvocacao: string;
  local: string; // ex: 'Salão de Festas ou Link Online'
  pautas: string[];
  ataDocumentoUrl?: string;
  publicado: boolean;
  criadoEm: string;
}

export interface AtividadeRecente {
  id: string;
  condominioId: string;
  usuarioNome: string;
  acao: string;
  modulo: 'FINANCEIRO' | 'MANUTENCAO' | 'UNIDADES' | 'COMUNICADOS' | 'DOCUMENTOS' | 'ASSEMBLEIAS' | 'SISTEMA';
  detalhes: string;
  dataHora: string;
}

export interface ResumoFinanceiroDashboard {
  saldoAtual: number;
  receitasMes: number;
  despesasMes: number;
  taxaInadimplencia: number;
  totalInadimplente: number;
  contasVencendo7Dias: number;
  contasAtrasadas: number;
}

export interface ResumoManutencaoDashboard {
  abertas: number;
  emAndamento: number;
  concluidasMes: number;
  urgentes: number;
}
