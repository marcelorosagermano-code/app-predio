import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  DollarSign,
  Megaphone,
  Wrench,
  FileText,
  Users,
  Download,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { unitService, UnitWithRelations } from '../../services/supabase/unitService';
import { financialService, FinancialEntryRow } from '../../services/supabase/financialService';
import { maintenanceService, MaintenanceRow } from '../../services/supabase/maintenanceService';
import { announcementService, AnnouncementRow } from '../../services/supabase/announcementService';
import { documentService, DocumentRow } from '../../services/supabase/documentService';
import { assemblyService, AssemblyRow } from '../../services/supabase/assemblyService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';

interface MoradorAreaPageProps {
  initialSubTab?: string;
}

export const MoradorAreaPage: React.FC<MoradorAreaPageProps> = ({ initialSubTab = 'unidade' }) => {
  const { user, condominium } = useAuth();
  const condoId = condominium?.id || user?.condominiumId;

  const [subTab, setSubTab] = useState<string>(initialSubTab);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dados reais carregados do Supabase
  const [userUnit, setUserUnit] = useState<UnitWithRelations | null>(null);
  const [meusLancamentos, setMeusLancamentos] = useState<FinancialEntryRow[]>([]);
  const [minhasSolicitacoes, setMinhasSolicitacoes] = useState<MaintenanceRow[]>([]);
  const [comunicados, setComunicados] = useState<AnnouncementRow[]>([]);
  const [documentos, setDocumentos] = useState<DocumentRow[]>([]);
  const [assembleias, setAssembleias] = useState<AssemblyRow[]>([]);

  // Modal de Nova Solicitação do Morador
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [solicitacaoTitulo, setSolicitacaoTitulo] = useState('');
  const [solicitacaoDescricao, setSolicitacaoDescricao] = useState('');
  const [solicitacaoPrioridade, setSolicitacaoPrioridade] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');

  const loadData = useCallback(async () => {
    if (!condoId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. Carregar lista de unidades para encontrar a unidade do morador
      const units = await unitService.listByCondominium(condoId);
      const matched = units.find(
        (u) =>
          (user?.unitId && u.id === user.unitId) ||
          (user?.unitNumber && u.unit_number === user.unitNumber)
      ) || units[0] || null;

      setUserUnit(matched);

      // 2. Carregar dados relacionados em paralelo
      const [finData, maintData, annData, docData, assData] = await Promise.all([
        financialService.listByCondominium(condoId, matched ? { unitId: matched.id } : undefined),
        maintenanceService.listByCondominium(condoId),
        announcementService.listByCondominium(condoId),
        documentService.listByCondominium(condoId),
        assemblyService.listByCondominium(condoId),
      ]);

      setMeusLancamentos(finData);
      setMinhasSolicitacoes(maintData);
      setComunicados(annData);
      setDocumentos(docData);
      setAssembleias(assData);
    } catch (err: any) {
      console.error('Erro ao carregar dados da Área do Morador:', err);
      setError(err?.message || 'Falha ao sincronizar dados com o Supabase.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId, user?.unitId, user?.unitNumber]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateSolicitacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoId) return;

    if (!solicitacaoTitulo.trim()) {
      setFormError('Informe o título da solicitação.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await maintenanceService.create({
        condominium_id: condoId,
        unit_id: userUnit?.id || null,
        title: solicitacaoTitulo.trim(),
        description: solicitacaoDescricao.trim() || 'Sem descrição adicional',
        location: userUnit ? `Unidade ${userUnit.unit_number}` : 'Unidade Privativa',
        priority: solicitacaoPrioridade,
        status: 'open',
      });

      setSolicitacaoTitulo('');
      setSolicitacaoDescricao('');
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Erro ao abrir solicitação:', err);
      setFormError(err?.message || 'Erro ao registrar solicitação no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayUnitNumero = userUnit?.unit_number || user?.unitNumber || 'Não vinculada';
  const displayBloco = userUnit?.block || 'Principal';
  const displayArea = userUnit?.area_sqm || '—';
  const displayVagas = userUnit?.parking_spaces || '—';
  const displayProprietario = userUnit?.owner?.full_name || 'Não cadastrado';
  const displayMorador = userUnit?.resident?.full_name || user?.fullName || 'Não cadastrado';

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

      {error && (
        <Alert type="error" title="Erro de Sincronização">
          {error}
        </Alert>
      )}

      {isLoading && (
        <div className="flex items-center justify-center p-8 bg-white rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            Carregando dados do Supabase...
          </div>
        </div>
      )}

      {/* Subtab Content: Minha Unidade */}
      {!isLoading && subTab === 'unidade' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Ficha Cadastral da Unidade</CardTitle>
              <CardDescription>Dados cadastrados na administração do condomínio (Fonte: Supabase)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-slate-400 text-[11px]">Unidade / Bloco</p>
                  <p className="font-bold text-slate-800 text-base">
                    Unidade {displayUnitNumero} ({displayBloco})
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Metragem Privativa</p>
                  <p className="font-bold text-slate-800 text-base">{displayArea} m²</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px]">Vagas de Garagem</p>
                  <p className="font-bold text-slate-800 text-base">{displayVagas}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-200 rounded-xl space-y-1">
                  <p className="font-bold text-slate-900">Proprietário Titular</p>
                  <p className="text-slate-600">Nome: {displayProprietario}</p>
                  <p className="text-slate-600">Email: {userUnit?.owner?.email || '(Não informado)'}</p>
                  <p className="text-slate-600">Telefone: {userUnit?.owner?.phone || '(Não informado)'}</p>
                </div>
                <div className="p-4 border border-slate-200 rounded-xl space-y-1">
                  <p className="font-bold text-slate-900">Morador Registrado</p>
                  <p className="text-slate-600">Nome: {displayMorador}</p>
                  <p className="text-slate-600">Email: {userUnit?.resident?.email || user?.email || '(Não informado)'}</p>
                  <p className="text-slate-600">Telefone: {userUnit?.resident?.phone || user?.phone || '(Não informado)'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subtab Content: Meu Financeiro */}
      {!isLoading && subTab === 'financeiro' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Minhas Cotas Condominiais</CardTitle>
              <CardDescription>Extrato e lançamentos registrados para sua unidade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {meusLancamentos.length === 0 ? (
                <EmptyState
                  icon={<DollarSign className="w-6 h-6" />}
                  title="Nenhum lançamento financeiro"
                  description="Não há boletos ou cobranças registradas para esta unidade no momento."
                />
              ) : (
                meusLancamentos.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{item.description}</p>
                        <Badge
                          variant={
                            item.status === 'paid'
                              ? 'success'
                              : item.status === 'pending'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {item.status === 'paid' ? 'Pago' : item.status === 'pending' ? 'Pendente' : 'Em Atraso'}
                        </Badge>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-0.5">
                        Vencimento: {formatDate(item.due_date)} {item.payment_date ? `• Pago em ${formatDate(item.payment_date)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-base font-bold text-slate-900">
                        {formatCurrency(Number(item.amount))}
                      </span>
                      {item.status === 'pending' && (
                        <Button size="sm" variant="primary" leftIcon={<Download className="w-3.5 h-3.5" />}>
                          2ª Via Boleto
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subtab Content: Manutenções */}
      {!isLoading && subTab === 'manutencoes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-900">Minhas Solicitações e Chamados</h3>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setIsModalOpen(true)}
            >
              Nova Solicitação
            </Button>
          </div>
          <div className="space-y-3">
            {minhasSolicitacoes.length === 0 ? (
              <EmptyState
                icon={<Wrench className="w-6 h-6" />}
                title="Nenhum chamado aberto"
                description="Você não possui solicitações de manutenção ou reparo abertas."
                actionLabel="Abrir Chamado"
                onAction={() => setIsModalOpen(true)}
              />
            ) : (
              minhasSolicitacoes.map((sol) => (
                <Card key={sol.id} className="p-4 text-xs space-y-2">
                  <div className="flex items-start justify-between">
                    <h4 className="font-bold text-slate-900">{sol.title}</h4>
                    <Badge
                      variant={
                        sol.status === 'completed'
                          ? 'success'
                          : sol.status === 'in_progress'
                          ? 'info'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {sol.status === 'completed'
                        ? 'Concluída'
                        : sol.status === 'in_progress'
                        ? 'Em Andamento'
                        : 'Aberta'}
                    </Badge>
                  </div>
                  {sol.description && <p className="text-slate-600">{sol.description}</p>}
                  <p className="text-[11px] text-slate-400">
                    Aberto em {formatDate(sol.created_at)}
                  </p>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Subtab Content: Comunicados */}
      {!isLoading && subTab === 'comunicados' && (
        <div className="space-y-4">
          {comunicados.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="w-6 h-6" />}
              title="Nenhum comunicado disponível"
              description="Não há circulares ou avisos publicados pela administração no momento."
            />
          ) : (
            comunicados.map((com) => (
              <Card key={com.id} className="p-5 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{com.title}</h4>
                  <span className="text-[11px] text-slate-400">{formatDate(com.created_at)}</span>
                </div>
                <p className="text-slate-700 leading-relaxed whitespace-pre-line">{com.content}</p>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Subtab Content: Documentos */}
      {!isLoading && subTab === 'documentos' && (
        <div>
          {documentos.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-6 h-6" />}
              title="Nenhum documento disponível"
              description="Nenhum documento oficial ou prestação de contas foi disponibilizado no banco de dados."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documentos.map((doc) => (
                <Card key={doc.id} className="p-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div>
                      <p className="font-bold text-slate-900">{doc.title}</p>
                      <p className="text-[11px] text-slate-400">Disponibilizado em {formatDate(doc.created_at)}</p>
                    </div>
                  </div>
                  {doc.file_path && (
                    <a
                      href={doc.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      <Download className="w-3.5 h-3.5" /> Acessar
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subtab Content: Assembleias */}
      {!isLoading && subTab === 'assembleias' && (
        <div className="space-y-4">
          {assembleias.length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="Nenhuma assembleia convocada"
              description="Não há assembleias agendadas no momento para o condomínio."
            />
          ) : (
            assembleias.map((ass) => (
              <Card key={ass.id} className="p-5 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm">{ass.title}</h4>
                  <Badge variant={ass.status === 'scheduled' ? 'indigo' : 'neutral'} size="sm">
                    {ass.status === 'scheduled' ? 'Agendada' : 'Realizada'}
                  </Badge>
                </div>
                <p className="text-slate-600">
                  Data: {formatDate(ass.date)} {ass.location ? `• Local: ${ass.location}` : ''}
                </p>
                {ass.description && (
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-800">Pautas / Orientações:</p>
                    <p className="text-slate-500 whitespace-pre-line leading-relaxed">{ass.description}</p>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* Modal Nova Solicitação */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nova Solicitação / Ocorrência"
        description="Envie um chamado para a administração do condomínio"
      >
        <form onSubmit={handleCreateSolicitacao} className="space-y-3 text-xs">
          {formError && (
            <Alert type="error" title="Atenção">
              {formError}
            </Alert>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Assunto / Título *</label>
            <Input
              placeholder="Ex: Vazamento no encanamento, Lâmpada do corredor queimada..."
              value={solicitacaoTitulo}
              onChange={(e) => setSolicitacaoTitulo(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Prioridade</label>
            <select
              value={solicitacaoPrioridade}
              onChange={(e) => setSolicitacaoPrioridade(e.target.value as any)}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none"
            >
              <option value="low">Baixa</option>
              <option value="medium">Média</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descrição detalhada</label>
            <textarea
              rows={4}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="Explique o que está ocorrendo..."
              value={solicitacaoDescricao}
              onChange={(e) => setSolicitacaoDescricao(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Enviando...' : 'Enviar Solicitação'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
