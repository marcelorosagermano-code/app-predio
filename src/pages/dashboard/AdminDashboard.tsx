import React from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Wrench,
  Megaphone,
  Activity,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Building2,
  FileText,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import { useAdminDashboard } from '../../hooks/useDashboardData';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { StatCard } from '../../components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

interface AdminDashboardProps {
  onNavigate: (tabId: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { data, isLoading, error, refresh } = useAdminDashboard();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Carregando painel administrativo">
        {/* Header skeleton */}
        <div className="flex items-center justify-between pb-2">
          <div className="h-6 w-48 bg-slate-200 rounded-md"></div>
          <div className="h-8 w-32 bg-slate-200 rounded-md"></div>
        </div>

        {/* KPI Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="h-4 w-24 bg-slate-200 rounded-sm"></div>
              <div className="h-7 w-36 bg-slate-300 rounded-md"></div>
            </div>
          ))}
        </div>

        {/* Content Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-white border border-slate-200 rounded-xl"></div>
          <div className="h-64 bg-white border border-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<AlertCircle className="w-8 h-8 text-rose-500" />}
          title="Falha ao carregar indicadores do painel"
          description={error}
          actionLabel="Tentar Novamente"
          onAction={refresh}
        />
      </div>
    );
  }

  const summary = data?.summary || {
    saldoAtual: 0,
    receitasMes: 0,
    despesasMes: 0,
    taxaInadimplencia: 0,
    totalInadimplente: 0,
    totalUnidades: 0,
    unidadesInadimplentesCount: 0,
    mesReferencia: 'Mês Atual',
  };

  const contasProximas = data?.contasProximas || [];
  const contasAtrasadas = data?.contasAtrasadas || [];
  const maintenanceSummary = data?.maintenanceSummary || {
    abertas: 0,
    emAndamento: 0,
    concluidas: 0,
    urgentes: 0,
  };
  const recentMaintenance = data?.recentMaintenance || [];
  const recentAnnouncements = data?.recentAnnouncements || [];
  const recentActivities = data?.recentActivities || [];

  return (
    <div className="space-y-6">
      {/* 1. RESUMO FINANCEIRO (KPIs Principais) */}
      <section className="space-y-3" aria-labelledby="kpis-heading">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 id="kpis-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Resumo Financeiro Consolidado
            </h3>
            <p className="text-xs text-slate-500">
              Referência: <span className="font-semibold text-slate-700">{summary.mesReferencia}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={refresh}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Atualizar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('financeiro')}
              rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
            >
              Ver Financeiro
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            id="stat-saldo-atual"
            title="Saldo Atual em Caixa"
            value={formatCurrency(summary.saldoAtual)}
            icon={<DollarSign className="w-5 h-5" />}
            iconBgColor="bg-indigo-50"
            iconColor="text-indigo-600"
            subtitle="Receitas pagas menos despesas"
            trend={{
              value: summary.saldoAtual >= 0 ? 'Saldo Positivo' : 'Saldo Negativo',
              isPositive: summary.saldoAtual >= 0,
            }}
            onClick={() => onNavigate('financeiro')}
          />

          <StatCard
            id="stat-receitas-mes"
            title="Receitas do Mês"
            value={formatCurrency(summary.receitasMes)}
            icon={<TrendingUp className="w-5 h-5" />}
            iconBgColor="bg-emerald-50"
            iconColor="text-emerald-600"
            subtitle={`Movimentação em ${summary.mesReferencia}`}
            trend={{
              value: 'Arrecadação do Mês',
              isPositive: true,
            }}
            onClick={() => onNavigate('financeiro')}
          />

          <StatCard
            id="stat-despesas-mes"
            title="Despesas do Mês"
            value={formatCurrency(summary.despesasMes)}
            icon={<TrendingDown className="w-5 h-5" />}
            iconBgColor="bg-rose-50"
            iconColor="text-rose-600"
            subtitle="Contas quitadas no período"
            trend={{
              value: 'Despesas Realizadas',
              isNeutral: true,
            }}
            onClick={() => onNavigate('financeiro')}
          />

          <StatCard
            id="stat-inadimplencia"
            title="Taxa de Inadimplência"
            value={`${summary.taxaInadimplencia}%`}
            icon={<AlertTriangle className="w-5 h-5" />}
            iconBgColor="bg-amber-50"
            iconColor="text-amber-600"
            subtitle={`Total pendente: ${formatCurrency(summary.totalInadimplente)}`}
            trend={{
              value: `${summary.unidadesInadimplentesCount} un. em atraso`,
              isPositive: summary.unidadesInadimplentesCount === 0,
            }}
            onClick={() => onNavigate('financeiro')}
          />
        </div>
      </section>

      {/* 2. BLOCO DE ATENÇÃO & PENDÊNCIAS CRÍTICAS */}
      <section aria-labelledby="atencao-heading">
        <Card className="border-amber-200/80 bg-amber-50/20 shadow-2xs">
          <CardHeader className="bg-amber-50/50 border-b border-amber-100/80 flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <CardTitle id="atencao-heading" className="text-amber-950 text-sm font-bold">
                  Atenção: Contas Próximas & Pendências
                </CardTitle>
                <CardDescription className="text-amber-800/80 text-xs">
                  Vencimentos nos próximos 7 dias e cotas com pagamento pendente ou atrasado
                </CardDescription>
              </div>
            </div>
            <Badge variant="warning" size="sm">
              {contasProximas.length + contasAtrasadas.length} pendências
            </Badge>
          </CardHeader>
          <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contas a Pagar / Receber Próximas */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Vencendo nos Próximos 7 Dias
              </span>
              {contasProximas.length > 0 ? (
                <div className="space-y-2">
                  {contasProximas.slice(0, 4).map((conta) => (
                    <div
                      key={conta.id}
                      className="p-3 bg-white rounded-lg border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">{conta.description}</p>
                        <p className="text-slate-500 text-[11px]">
                          Vencimento: {formatDate(conta.dueDate)}
                          {conta.unitNumber && ` • ${conta.unitNumber}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-slate-900">{formatCurrency(conta.amount)}</p>
                        <Badge variant={conta.type === 'expense' ? 'neutral' : 'info'} size="sm">
                          {conta.type === 'expense' ? 'A Pagar' : 'A Receber'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-white/70 rounded-lg border border-slate-200/60 text-center text-xs text-slate-500">
                  Nenhum vencimento previsto para os próximos 7 dias.
                </div>
              )}
            </div>

            {/* Contas em Atraso / Inadimplências */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                Lançamentos em Atraso
              </span>
              {contasAtrasadas.length > 0 ? (
                <div className="space-y-2">
                  {contasAtrasadas.slice(0, 4).map((conta) => (
                    <div
                      key={conta.id}
                      className="p-3 bg-white rounded-lg border border-rose-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-slate-800 truncate">
                          {conta.unitNumber || conta.description}
                        </p>
                        <p className="text-rose-600 text-[11px] font-medium">
                          Venceu em: {formatDate(conta.dueDate)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-rose-700">{formatCurrency(conta.amount)}</p>
                        <Badge variant="danger" size="sm">Em Atraso</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-white/70 rounded-lg border border-emerald-200/60 text-center text-xs text-emerald-700 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Nenhum débito em atraso no momento.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. MANUTENÇÕES & COMUNICADOS RECENTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bloco de Manutenções */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Ordens de Serviço & Manutenção
              </CardTitle>
              <CardDescription>
                Acompanhamento das ocorrências prediais do condomínio
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate('manutencao')}
            >
              Ver Todas
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Status Counters */}
            <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-100 text-center">
              <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
                <span className="text-xs text-amber-700 block font-medium">Abertas</span>
                <span className="text-lg font-bold text-amber-900">
                  {maintenanceSummary.abertas}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-sky-50 border border-sky-100">
                <span className="text-xs text-sky-700 block font-medium">Em Andamento</span>
                <span className="text-lg font-bold text-sky-900">
                  {maintenanceSummary.emAndamento}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <span className="text-xs text-emerald-700 block font-medium">Concluídas</span>
                <span className="text-lg font-bold text-emerald-900">
                  {maintenanceSummary.concluidas}
                </span>
              </div>
            </div>

            {/* List of Recent Maintenance Items */}
            {recentMaintenance.length > 0 ? (
              <div className="space-y-2.5">
                {recentMaintenance.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-300 transition-colors text-xs flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{item.title}</p>
                      <p className="text-slate-500 text-[11px] line-clamp-1">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Local: {item.location}</span>
                        <span>•</span>
                        <span>Aberto em {formatDate(item.openedAt)}</span>
                        {item.unitNumber && <span>• {item.unitNumber}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge
                        variant={
                          item.status === 'completed'
                            ? 'success'
                            : item.status === 'in_progress'
                            ? 'info'
                            : item.status === 'cancelled'
                            ? 'neutral'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {item.status === 'completed'
                          ? 'Concluída'
                          : item.status === 'in_progress'
                          ? 'Em Andamento'
                          : item.status === 'cancelled'
                          ? 'Cancelada'
                          : 'Aberta'}
                      </Badge>
                      {item.priority === 'urgent' && (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-sm">
                          Urgente
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Nenhuma solicitação de manutenção registrada.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bloco de Comunicados Recentes */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-indigo-600" />
                Últimos Comunicados Publicados
              </CardTitle>
              <CardDescription>
                Avisos e informativos emitidos aos moradores
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate('comunicados')}
            >
              Gerenciar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAnnouncements.length > 0 ? (
              <div className="space-y-2.5">
                {recentAnnouncements.map((comunicado) => (
                  <div
                    key={comunicado.id}
                    className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-300 transition-colors text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-slate-900 leading-snug truncate">
                        {comunicado.title}
                      </h4>
                      {comunicado.isPinned && (
                        <Badge variant="danger" size="sm">Fixado</Badge>
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px] line-clamp-2 leading-relaxed">
                      {comunicado.content}
                    </p>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                      <span>Publicado em {formatDate(comunicado.publishedAt || comunicado.createdAt)}</span>
                      <span>Por: {comunicado.authorName}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Nenhum comunicado publicado no momento.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. ATIVIDADES RECENTES (Auditoria e Histórico) */}
      <section aria-labelledby="audit-heading">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              <div>
                <CardTitle id="audit-heading" className="text-sm">
                  Atividades & Movimentações Recentes
                </CardTitle>
                <CardDescription>
                  Registro cronológico de ações registradas no condomínio
                </CardDescription>
              </div>
            </div>
            <span className="text-xs text-slate-400">Trilha de Auditoria</span>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivities.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {recentActivities.map((atv) => (
                  <div
                    key={atv.id}
                    className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        {atv.entityType === 'financial' && <DollarSign className="w-4 h-4 text-emerald-600" />}
                        {atv.entityType === 'maintenance' && <Wrench className="w-4 h-4 text-sky-600" />}
                        {atv.entityType === 'announcements' && <Megaphone className="w-4 h-4 text-indigo-600" />}
                        {atv.entityType === 'documents' && <FileText className="w-4 h-4 text-amber-600" />}
                        {atv.entityType !== 'financial' &&
                          atv.entityType !== 'maintenance' &&
                          atv.entityType !== 'announcements' &&
                          atv.entityType !== 'documents' && (
                            <Activity className="w-4 h-4 text-slate-600" />
                          )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {atv.userName} — <span className="font-normal text-slate-600">{atv.action}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{atv.description}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-4">
                      {formatDateTime(atv.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500">
                Nenhum registro de atividade recente no histórico.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};
