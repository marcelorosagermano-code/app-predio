import React, { useState } from 'react';
import {
  Home,
  DollarSign,
  Megaphone,
  Wrench,
  FileText,
  Users,
  Download,
  Plus,
  CheckCircle2,
  AlertCircle,
  Building,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  mockUnidades,
  mockLancamentosFinanceiros,
  mockComunicados,
  mockManutencoes,
  mockDocumentos,
  mockAssembleias,
} from '../../services/mockData';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

interface MoradorAreaPageProps {
  initialSubTab?: string;
}

export const MoradorAreaPage: React.FC<MoradorAreaPageProps> = ({ initialSubTab = 'unidade' }) => {
  const { user } = useAuth();
  const [subTab, setSubTab] = useState<string>(initialSubTab);

  // Buscar a unidade do morador logado (seja pelo unitId ou pelo número da unidade)
  const matchedUnit = mockUnidades.find(
    (u) => (user?.unitId && u.id === user.unitId) || (user?.unitNumber && u.numero === user.unitNumber)
  );

  const displayUnitNumero = user?.unitNumber || matchedUnit?.numero || '201';
  const displayBloco = matchedUnit?.bloco || 'Bloco Principal';
  const displayMetragem = matchedUnit?.metragem || 75.0;
  const displayVaga = matchedUnit?.vagasGaragem || 'Conforme convenção';
  const displayMoradorNome = user?.fullName || matchedUnit?.moradorNome || 'Morador';
  const displayMoradorEmail = user?.email || matchedUnit?.moradorEmail || '';
  const displayMoradorTelefone = user?.phone || matchedUnit?.moradorTelefone || '(Não informado)';
  const displayProprietarioNome = matchedUnit?.proprietarioNome || displayMoradorNome;

  const meusLancamentos = matchedUnit
    ? mockLancamentosFinanceiros.filter((l) => l.unidadeId === matchedUnit.id)
    : mockLancamentosFinanceiros.slice(0, 2);

  const minhasSolicitacoes = mockManutencoes.filter(
    (m) => m.solicitanteId === user?.id || m.local === 'AREA_COMUM'
  );

  return (
    <div className="space-y-6">
      {/* Sub-tab navigation for Morador Area */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto text-xs">
        <button
          onClick={() => setSubTab('unidade')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'unidade'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Home className="w-4 h-4" />
          Minha Unidade
        </button>

        <button
          onClick={() => setSubTab('financeiro')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'financeiro'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Meu Financeiro & Boletos
        </button>

        <button
          onClick={() => setSubTab('manutencoes')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'manutencoes'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Minhas Solicitações
        </button>

        <button
          onClick={() => setSubTab('comunicados')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'comunicados'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          Comunicados
        </button>

        <button
          onClick={() => setSubTab('documentos')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'documentos'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          Documentos
        </button>

        <button
          onClick={() => setSubTab('assembleias')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            subTab === 'assembleias'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Assembleias
        </button>
      </div>

      {/* Subtab Content: Minha Unidade */}
      {subTab === 'unidade' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ficha Cadastral da Unidade</CardTitle>
              <CardDescription>Dados cadastrados na administração do condomínio</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-slate-400 text-[11px]">Unidade / Bloco</p>
                  <p className="font-bold text-slate-800 text-base">
                    Apto {displayUnitNumero} ({displayBloco})
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Metragem Privativa</p>
                  <p className="font-bold text-slate-800 text-base">{displayMetragem} m²</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Vaga de Garagem</p>
                  <p className="font-bold text-slate-800 text-base">{displayVaga}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl space-y-1">
                  <p className="font-bold text-slate-900">Proprietário Titular</p>
                  <p className="text-slate-600">Nome: {displayProprietarioNome}</p>
                  <p className="text-slate-600">Email: {displayMoradorEmail || '(Não informado)'}</p>
                  <p className="text-slate-600">Telefone: {displayMoradorTelefone}</p>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl space-y-1">
                  <p className="font-bold text-slate-900">Morador Registrado</p>
                  <p className="text-slate-600">Nome: {displayMoradorNome}</p>
                  <p className="text-slate-600">Email: {displayMoradorEmail || '(Não informado)'}</p>
                  <p className="text-slate-600">Telefone: {displayMoradorTelefone}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subtab Content: Meu Financeiro */}
      {subTab === 'financeiro' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Minhas Cotas Condominiais</CardTitle>
              <CardDescription>Extrato e segunda via de boletos da sua unidade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {meusLancamentos.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{item.descricao}</p>
                      <Badge
                        variant={
                          item.status === 'PAGO'
                            ? 'success'
                            : item.status === 'PENDENTE'
                            ? 'warning'
                            : 'danger'
                        }
                        size="sm"
                      >
                        {item.status === 'PAGO' ? 'Pago' : item.status === 'PENDENTE' ? 'Pendente' : 'Em Atraso'}
                      </Badge>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-0.5">
                      Vencimento: {formatDate(item.dataVencimento)} {item.dataPagamento ? `• Pago em ${formatDate(item.dataPagamento)}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-base font-bold text-slate-900">
                      {formatCurrency(item.valor)}
                    </span>
                    {item.status === 'PENDENTE' && (
                      <Button size="sm" variant="primary" leftIcon={<Download className="w-3.5 h-3.5" />}>
                        2ª Via Boleto
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subtab Content: Manutenções */}
      {subTab === 'manutencoes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Minhas Solicitações e Ocorrências</h3>
            <Button size="sm" variant="primary" leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Nova Solicitação
            </Button>
          </div>
          <div className="space-y-3">
            {minhasSolicitacoes.map((sol) => (
              <Card key={sol.id} className="p-4 text-xs space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-slate-900">{sol.titulo}</h4>
                  <Badge variant={sol.status === 'CONCLUIDA' ? 'success' : 'info'} size="sm">
                    {sol.status}
                  </Badge>
                </div>
                <p className="text-slate-600">{sol.descricao}</p>
                <p className="text-[11px] text-slate-400">Local: {sol.local} • Aberto em {formatDate(sol.dataAbertura)}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Subtab Content: Comunicados */}
      {subTab === 'comunicados' && (
        <div className="space-y-4">
          {mockComunicados.map((com) => (
            <Card key={com.id} className="p-5 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">{com.titulo}</h4>
                <span className="text-[11px] text-slate-400">{formatDate(com.dataPublicacao)}</span>
              </div>
              <p className="text-slate-700 leading-relaxed">{com.conteudo}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Subtab Content: Documentos */}
      {subTab === 'documentos' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mockDocumentos.filter((d) => d.visivelParaMoradores).map((doc) => (
            <Card key={doc.id} className="p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="font-bold text-slate-900">{doc.titulo}</p>
                  <p className="text-[11px] text-slate-400">{doc.formato} • {doc.tamanhoKb} KB</p>
                </div>
              </div>
              <Button size="sm" variant="outline" leftIcon={<Download className="w-3.5 h-3.5" />}>
                Baixar
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* Subtab Content: Assembleias */}
      {subTab === 'assembleias' && (
        <div className="space-y-4">
          {mockAssembleias.map((ass) => (
            <Card key={ass.id} className="p-5 text-xs space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm">{ass.titulo}</h4>
                <Badge variant="indigo" size="sm">{ass.status}</Badge>
              </div>
              <p className="text-slate-600">Local: {ass.local}</p>
              <div className="space-y-1">
                <p className="font-semibold text-slate-800">Pautas convocadas:</p>
                {ass.pautas.map((p, i) => (
                  <p key={i} className="text-slate-500 pl-2">• {p}</p>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
