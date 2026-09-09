import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  maintenanceService,
  MaintenanceRow,
} from '../../services/supabase/maintenanceService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';

export const ManutencaoPage: React.FC = () => {
  const { condominium, user, isAdmin } = useAuth();
  const condoId = condominium?.id || user?.condominiumId;

  const [manutencoes, setManutencoes] = useState<MaintenanceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal Nova Ordem de Serviço
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoLocal, setNovoLocal] = useState('Área Comum');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaPrioridade, setNovaPrioridade] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [novoCusto, setNovoCusto] = useState('');
  const [novoResponsavel, setNovoResponsavel] = useState('');

  const loadManutencoes = useCallback(async () => {
    if (!condoId) {
      setManutencoes([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await maintenanceService.listByCondominium(condoId);
      setManutencoes(data);
    } catch (err: any) {
      console.error('Erro ao carregar manutenções do Supabase:', err);
      setError(err?.message || 'Falha ao buscar ordens de serviço.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId]);

  useEffect(() => {
    loadManutencoes();
  }, [loadManutencoes]);

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoId) return;

    if (!novoTitulo.trim()) {
      setFormError('Título da ordem de serviço é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const custoNum = novoCusto ? parseFloat(novoCusto.replace(',', '.')) : null;

      await maintenanceService.create({
        condominium_id: condoId,
        title: novoTitulo.trim(),
        description: novaDescricao.trim() || 'Sem descrição adicional',
        location: novoLocal.trim() || 'Área Comum',
        priority: novaPrioridade,
        status: 'open',
        estimated_cost: isNaN(custoNum as number) ? null : custoNum,
        assigned_to: novoResponsavel.trim() || null,
      });

      setNovoTitulo('');
      setNovoLocal('Área Comum');
      setNovaDescricao('');
      setNovoCusto('');
      setNovoResponsavel('');
      setIsModalOpen(false);
      await loadManutencoes();
    } catch (err: any) {
      console.error('Erro ao registrar ordem de serviço:', err);
      setFormError(err?.message || 'Falha ao salvar no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: 'in_progress' | 'completed') => {
    try {
      await maintenanceService.updateStatus(id, newStatus);
      await loadManutencoes();
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
    }
  };

  const filtered = manutencoes.filter((m) => {
    return statusFilter === 'ALL' || m.status === statusFilter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success" size="sm" dot>Concluída</Badge>;
      case 'in_progress':
        return <Badge variant="info" size="sm" dot>Em Andamento</Badge>;
      case 'cancelled':
        return <Badge variant="neutral" size="sm" dot>Cancelada</Badge>;
      default:
        return <Badge variant="warning" size="sm" dot>Aberta</Badge>;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <span className="font-bold text-rose-600">Urgente</span>;
      case 'high':
        return <span className="font-bold text-amber-600">Alta</span>;
      case 'low':
        return <span className="font-medium text-slate-500">Baixa</span>;
      default:
        return <span className="font-medium text-slate-700">Média</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Manutenções e Ocorrências
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento de serviços preventivos, corretivos e chamados prediais (Fonte: Supabase)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadManutencoes}
            disabled={isLoading}
          >
            Atualizar
          </Button>

          {isAdmin && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsModalOpen(true)}
            >
              Nova Ordem de Serviço
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert type="error" title="Erro de Comunicação">
          {error}
        </Alert>
      )}

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'ALL'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Todas ({manutencoes.length})
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'pending'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Abertas ({manutencoes.filter((m) => m.status === 'pending').length})
        </button>
        <button
          onClick={() => setStatusFilter('in_progress')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'in_progress'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Em Andamento ({manutencoes.filter((m) => m.status === 'in_progress').length})
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'completed'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Concluídas ({manutencoes.filter((m) => m.status === 'completed').length})
        </button>
      </div>

      {/* Grid of Maintenance Cards or Loading or Empty State */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs text-slate-500">Consultando ordens de serviço no Supabase...</span>
          </div>
        </div>
      ) : manutencoes.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-6 h-6" />}
          title="Nenhuma manutenção registrada"
          description="Nenhuma ordem de serviço preventiva ou corretiva foi cadastrada no banco de dados."
          actionLabel={isAdmin ? 'Criar Primeira Manutenção' : undefined}
          onAction={isAdmin ? () => setIsModalOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <Card key={item.id} className="flex flex-col justify-between hover:shadow-xs transition-shadow">
              <CardHeader className="p-4 pb-3">
                <div className="flex items-start justify-between gap-2">
                  {getStatusBadge(item.status)}
                  <span className="text-[11px] font-medium text-slate-400">
                    Prioridade: {getPriorityLabel(item.priority)}
                  </span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-2 line-clamp-2">
                  {item.title}
                </h3>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {item.description && (
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>
                )}
                <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] space-y-1 text-slate-600">
                  {item.assigned_to && (
                    <p>🛠️ Responsável: <span className="font-medium text-slate-800">{item.assigned_to}</span></p>
                  )}
                  <p>📅 Registrado em: <span className="font-medium text-slate-800">{formatDate(item.created_at)}</span></p>
                  {item.completed_at && (
                    <p>✅ Concluído em: <span className="font-medium text-slate-800">{formatDate(item.completed_at)}</span></p>
                  )}
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>
                    {item.estimated_cost
                      ? `Estimativa: ${formatCurrency(Number(item.estimated_cost))}`
                      : 'Sem custo estimado'}
                  </span>

                  {isAdmin && item.status !== 'completed' && (
                    <div className="flex items-center gap-1">
                      {item.status === 'pending' && (
                        <button
                          onClick={() => handleUpdateStatus(item.id, 'in_progress')}
                          className="px-2 py-1 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded text-[10px] font-semibold"
                        >
                          Iniciar
                        </button>
                      )}
                      <button
                        onClick={() => handleUpdateStatus(item.id, 'completed')}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded text-[10px] font-semibold"
                      >
                        Concluir
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Nova Ordem de Serviço */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nova Ordem de Serviço / Manutenção"
        description="Abra uma solicitação de reparo ou manutenção no banco de dados"
      >
        <form onSubmit={handleCreateMaintenance} className="space-y-3 text-xs">
          {formError && (
            <Alert type="error" title="Atenção">
              {formError}
            </Alert>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Título do Chamado *</label>
            <Input
              placeholder="Ex: Troca de lâmpadas do hall, Revisão do portão..."
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Local / Instalação</label>
            <Input
              placeholder="Ex: Hall do 3º andar, Garagem G1, Elevador Social..."
              value={novoLocal}
              onChange={(e) => setNovoLocal(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descrição detalhada</label>
            <textarea
              rows={3}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="Descreva o problema e orientações necessárias..."
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Prioridade *</label>
              <select
                value={novaPrioridade}
                onChange={(e) => setNovaPrioridade(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none"
              >
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Custo Estimado (R$)</label>
              <Input
                placeholder="0,00"
                value={novoCusto}
                onChange={(e) => setNovoCusto(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Responsável / Prestador</label>
            <Input
              placeholder="Ex: Eletricista João, Empresa Elevadores XYZ..."
              value={novoResponsavel}
              onChange={(e) => setNovoResponsavel(e.target.value)}
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
              {isSubmitting ? 'Salvando...' : 'Salvar Ordem de Serviço'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
