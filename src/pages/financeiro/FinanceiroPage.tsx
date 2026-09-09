import React, { useState } from 'react';
import {
  DollarSign,
  Plus,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  AlertCircle,
} from 'lucide-react';
import { mockLancamentosFinanceiros, mockResumoFinanceiro } from '../../services/mockData';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { StatCard } from '../../components/ui/StatCard';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table';

export const FinanceiroPage: React.FC = () => {
  const [tipoFiltro, setTipoFiltro] = useState<'TODOS' | 'RECEITA' | 'DESPESA'>('TODOS');
  const [statusFiltro, setStatusFiltro] = useState<string>('TODOS');

  const lancamentosFiltrados = mockLancamentosFinanceiros.filter((item) => {
    const matchesTipo = tipoFiltro === 'TODOS' || item.tipo === tipoFiltro;
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
            Gestão de receitas, despesas, fluxo de caixa e inadimplência
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="md" leftIcon={<Download className="w-4 h-4" />}>
            Exportar Relatório
          </Button>
          <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
            Novo Lançamento
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Saldo Atual"
          value={formatCurrency(mockResumoFinanceiro.saldoAtual)}
          icon={<DollarSign className="w-5 h-5" />}
          subtitle="Disponível em conta"
        />
        <StatCard
          title="Receitas Previstas"
          value={formatCurrency(mockResumoFinanceiro.receitasMes)}
          icon={<ArrowUpRight className="w-5 h-5" />}
          iconBgColor="bg-emerald-50"
          iconColor="text-emerald-600"
          subtitle="Mês de Março/2026"
        />
        <StatCard
          title="Despesas Previstas"
          value={formatCurrency(mockResumoFinanceiro.despesasMes)}
          icon={<ArrowDownRight className="w-5 h-5" />}
          iconBgColor="bg-rose-50"
          iconColor="text-rose-600"
          subtitle="Contas fixas e variáveis"
        />
        <StatCard
          title="Inadimplência"
          value={formatCurrency(mockResumoFinanceiro.totalInadimplente)}
          icon={<AlertCircle className="w-5 h-5" />}
          iconBgColor="bg-amber-50"
          iconColor="text-amber-600"
          subtitle={`${mockResumoFinanceiro.taxaInadimplencia}% das unidades`}
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
                onClick={() => setTipoFiltro('RECEITA')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  tipoFiltro === 'RECEITA' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                Receitas
              </button>
              <button
                onClick={() => setTipoFiltro('DESPESA')}
                className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${
                  tipoFiltro === 'DESPESA' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
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
              <option value="PAGO">Pago / Liquidado</option>
              <option value="PENDENTE">Pendente</option>
              <option value="ATRASADO">Atrasado</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Table of Entries */}
      <Table id="table-financeiro">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Descrição</TableHeaderCell>
            <TableHeaderCell>Categoria / Tipo</TableHeaderCell>
            <TableHeaderCell>Unidade Relacionada</TableHeaderCell>
            <TableHeaderCell>Vencimento</TableHeaderCell>
            <TableHeaderCell>Valor</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {lancamentosFiltrados.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                <p className="font-semibold text-slate-900 text-xs">{item.descricao}</p>
                {item.observacoes && (
                  <p className="text-[11px] text-slate-400 truncate">{item.observacoes}</p>
                )}
              </TableCell>

              <TableCell>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    item.tipo === 'RECEITA'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {item.categoria.replace('_', ' ')}
                </span>
              </TableCell>

              <TableCell>
                <span className="text-xs text-slate-600">
                  {item.unidadeNumero || 'Condomínio Geral'}
                </span>
              </TableCell>

              <TableCell>
                <span className="text-xs text-slate-700">
                  {formatDate(item.dataVencimento)}
                </span>
              </TableCell>

              <TableCell>
                <span
                  className={`text-xs font-bold ${
                    item.tipo === 'RECEITA' ? 'text-emerald-700' : 'text-slate-900'
                  }`}
                >
                  {formatCurrency(item.valor)}
                </span>
              </TableCell>

              <TableCell>
                <Badge
                  variant={
                    item.status === 'PAGO'
                      ? 'success'
                      : item.status === 'PENDENTE'
                      ? 'warning'
                      : 'danger'
                  }
                  size="sm"
                  dot
                >
                  {item.status === 'PAGO'
                    ? 'Pago'
                    : item.status === 'PENDENTE'
                    ? 'Pendente'
                    : 'Atrasado'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
