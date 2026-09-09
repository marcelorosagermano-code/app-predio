import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  financialService,
  FinancialEntryRow,
  FinancialSummary,
} from '../../services/supabase/financialService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table';

export const FinanceiroPage: React.FC = () => {
  const { condominium, user, isAdmin } = useAuth();
  const condoId = condominium?.id || user?.condominiumId;

  const [entries, setEntries] = useState<FinancialEntryRow[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalReceitasPagas: 0,
    totalReceitasPendentes: 0,
    totalDespesasPagas: 0,
    totalDespesasPendentes: 0,
    totalInadimplencia: 0,
    saldoAtual: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'income' | 'expense'>('TODOS');
  const [statusFiltro, setStatusFiltro] = useState<string>('TODOS');

  // Modal Novo Lançamento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novoTipo, setNovoTipo] = useState<'income' | 'expense'>('income');
  const [novaCategoria, setNovaCategoria] = useState('Condomínio');
  const [novoValor, setNovoValor] = useState('');
  const [novaDataVencimento, setNovaDataVencimento] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [novoStatus, setNovoStatus] = useState<'pending' | 'paid' | 'overdue'>('pending');

  const loadFinancialData = useCallback(async () => {
    if (!condoId) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [listData, sumData] = await Promise.all([
        financialService.listByCondominium(condoId),
        financialService.getSummary(condoId),
      ]);
      setEntries(listData);
      setSummary(sumData);
    } catch (err: any) {
      console.error('Erro ao carregar dados financeiros do Supabase:', err);
      setError(err?.message || 'Falha ao buscar registros financeiros.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId]);

  useEffect(() => {
    loadFinancialData();
  }, [loadFinancialData]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoId) return;

    const val = parseFloat(novoValor.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      setFormError('Por favor informe um valor numérico válido maior que zero.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await financialService.create({
        condominium_id: condoId,
        description: novaDescricao.trim(),
        type: novoTipo,
        category: novaCategoria,
        amount: val,
        due_date: novaDataVencimento,
        status: novoStatus,
        payment_date: novoStatus === 'paid' ? novaDataVencimento : null,
      });

      // Reset
      setNovaDescricao('');
      setNovoValor('');
      setIsModalOpen(false);
      await loadFinancialData();
    } catch (err: any) {
      console.error('Erro ao salvar lançamento:', err);
      setFormError(err?.message || 'Erro ao registrar no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const lancamentosFiltrados = entries.filter((item) => {
    const matchesTipo = tipoFiltro === 'TODOS' || item.type === tipoFiltro;
    const matchesStatus = statusFiltro === 'TODOS' || item.status === statusFiltro;
    return matchesTipo && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Controle Financeiro
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão de receitas, despesas, fluxo de caixa e inadimplência (Fonte: Supabase)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadFinancialData}
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
              Novo Lançamento
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert type="error" title="Erro Financeiro">
          {error}
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Saldo Atual"
          value={formatCurrency(summary.saldoAtual)}
          icon={<DollarSign className="w-5 h-5" />}
          subtitle="Saldo em conta (Real)"
        />
        <StatCard
          title="Receitas Recebidas"
          value={formatCurrency(summary.totalReceitasPagas)}
          icon={<ArrowUpRight className="w-5 h-5" />}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          subtitle={`A receber: ${formatCurrency(summary.totalReceitasPendentes)}`}
        />
        <StatCard
          title="Despesas Pagas"
          value={formatCurrency(summary.totalDespesasPagas)}
          icon={<ArrowDownRight className="w-5 h-5" />}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
          subtitle={`A pagar: ${formatCurrency(summary.totalDespesasPendentes)}`}
        />
        <StatCard
          title="Inadimplência Registrada"
          value={formatCurrency(summary.totalInadimplencia)}
          icon={<AlertCircle className="w-5 h-5" />}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          subtitle="Valores vencidos não quitados"
        />
      </div>

      {/* Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Tipo:</span>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setTipoFiltro('TODOS')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  tipoFiltro === 'TODOS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setTipoFiltro('income')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  tipoFiltro === 'income' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                Receitas
              </button>
              <button
                onClick={() => setTipoFiltro('expense')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  tipoFiltro === 'expense' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                Despesas
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="paid">Pago / Liquidado</option>
              <option value="pending">Pendente</option>
              <option value="overdue">Atrasado</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table of Entries or Empty State */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs text-slate-500">Consultando lançamentos no Supabase...</span>
          </div>
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="w-6 h-6" />}
          title="Não há lançamentos financeiros"
          description="Nenhum lançamento foi registrado para este condomínio até o momento no banco de dados."
          actionLabel={isAdmin ? 'Criar Primeiro Lançamento' : undefined}
          onAction={isAdmin ? () => setIsModalOpen(true) : undefined}
        />
      ) : (
        <Table id="table-financeiro">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Descrição</TableHeaderCell>
              <TableHeaderCell>Categoria / Tipo</TableHeaderCell>
              <TableHeaderCell>Vencimento</TableHeaderCell>
              <TableHeaderCell>Valor</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lancamentosFiltrados.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-semibold text-slate-900 text-xs">{item.description}</p>
                </TableCell>

                <TableCell>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      item.type === 'income'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {item.category || (item.type === 'income' ? 'Receita' : 'Despesa')}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="text-xs text-slate-700">
                    {formatDate(item.due_date)}
                  </span>
                </TableCell>

                <TableCell>
                  <span
                    className={`text-xs font-bold ${
                      item.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {formatCurrency(Number(item.amount))}
                  </span>
                </TableCell>

                <TableCell>
                  <Badge
                    variant={
                      item.status === 'paid'
                        ? 'success'
                        : item.status === 'pending'
                        ? 'warning'
                        : 'danger'
                    }
                    size="sm"
                    dot
                  >
                    {item.status === 'paid'
                      ? 'Pago'
                      : item.status === 'pending'
                      ? 'Pendente'
                      : 'Atrasado'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Modal Novo Lançamento */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Lançamento Financeiro"
        description="Registre uma receita ou despesa no banco de dados do condomínio"
      >
        <form onSubmit={handleCreateEntry} className="space-y-3 text-xs">
          {formError && (
            <Alert type="error" title="Atenção">
              {formError}
            </Alert>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descrição *</label>
            <Input
              placeholder="Ex: Cota Condominial Março, Manutenção Elevador..."
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tipo *</label>
              <select
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none"
              >
                <option value="income">Receita (Entrada)</option>
                <option value="expense">Despesa (Saída)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
              <Input
                placeholder="Ex: Condomínio, Energia, Limpeza..."
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Valor (R$) *</label>
              <Input
                placeholder="0,00"
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data de Vencimento *</label>
              <Input
                type="date"
                value={novaDataVencimento}
                onChange={(e) => setNovaDataVencimento(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status Inicial *</label>
            <select
              value={novoStatus}
              onChange={(e) => setNovoStatus(e.target.value as any)}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none"
            >
              <option value="pending">Pendente</option>
              <option value="paid">Já Pago / Liquidado</option>
              <option value="overdue">Em Atraso</option>
            </select>
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
              {isSubmitting ? 'Salvando...' : 'Salvar Lançamento'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
