import React from 'react';
import {
  Home,
  DollarSign,
  Megaphone,
  Wrench,
  FileText,
  Users,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  ChevronRight,
  PlusCircle,
  RefreshCw,
  Building2,
  Copy,
} from 'lucide-react';
import { useMoradorDashboard } from '../../hooks/useDashboardData';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/formatters';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';

interface MoradorDashboardProps {
  onNavigate: (tabId: string) => void;
}

export const MoradorDashboard: React.FC<MoradorDashboardProps> = ({ onNavigate }) => {
  const { data, isLoading, error, refresh } = useMoradorDashboard();
  const [copiedBarcode, setCopiedBarcode] = React.useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Carregando área do morador">
        <div className="h-32 bg-slate-200 rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-44 bg-white border border-slate-200 rounded-xl"></div>
          <div className="h-44 bg-white border border-slate-200 rounded-xl"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-60 bg-white border border-slate-200 rounded-xl"></div>
          <div className="h-60 bg-white border border-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<AlertCircle className="w-8 h-8 text-rose-500" />}
          title="Falha ao sincronizar dados da sua unidade"
          description={error}
          actionLabel="Tentar Novamente"
          onAction={refresh}
        />
      </div>
    );
  }

  const unit = data?.unit;
  const pendingFee = data?.pendingFee;
  const recentPayments = data?.recentPayments || [];
  const myMaintenanceRequests = data?.myMaintenanceRequests || [];
  const recentAnnouncements = data?.recentAnnouncements || [];
  const publicDocuments = data?.publicDocuments || [];
  const upcomingAssemblies = data?.upcomingAssemblies || [];

  const handleCopyBarcode = (barcode: string) => {
    navigator.clipboard?.writeText(barcode);
    setCopiedBarcode(true);
    setTimeout(() => setCopiedBarcode(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* 1. MINHA UNIDADE - Header Resumo */}
      <section aria-labelledby="unidade-heading">
        <Card className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white border-0 shadow-md">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 border border-indigo-400/40 text-indigo-200">
                    Sua Unidade Cadastrada
                  </span>
                  {unit ? (
                    <Badge
                      variant={
                        unit.situacaoFinanceira === 'EM_DIA'
                          ? 'success'
                          : unit.situacaoFinanceira === 'INADIMPLENTE'
                          ? 'danger'
                          : 'warning'
                      }
                      size="sm"
                    >
                      {unit.situacaoFinanceira === 'EM_DIA'
                        ? 'Situação: Em Dia'
                        : unit.situacaoFinanceira === 'INADIMPLENTE'
                        ? 'Cota em Atraso'
                        : 'Cota a Vencer'}
                    </Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">Cadastro em Análise</Badge>
                  )}
                </div>
                <h2 id="unidade-heading" className="text-2xl font-extrabold tracking-tight">
                  {unit
                    ? `Unidade ${unit.unitNumber}${unit.block ? ` — ${unit.block}` : ''}`
                    : 'Unidade não vinculada'}
                </h2>
                <p className="text-xs text-slate-300">
                  {unit?.ownerName ? (
                    <>
                      Titular: <span className="font-semibold text-white">{unit.ownerName}</span>
                      {unit.floor && ` • Andar: ${unit.floor}º`}
                      {unit.sqm && ` • Área: ${unit.sqm} m²`}
                    </>
                  ) : (
                    'Consulte a administração do condomínio para vincular sua unidade.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={refresh}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Atualizar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate('morador-unidade')}
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  Ver Ficha da Unidade
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. SITUAÇÃO FINANCEIRA DA UNIDADE */}
      <section className="space-y-3" aria-labelledby="financeiro-morador-heading">
        <div className="flex items-center justify-between">
          <h3 id="financeiro-morador-heading" className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            Situação Financeira da sua Unidade
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigate('morador-financeiro')}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          >
            Histórico Completo
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cota Aberta Atual */}
          <Card className="border-indigo-100/80">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase">
                  Próxima Cota Condominial
                </span>
                {pendingFee ? (
                  <Badge
                    variant={pendingFee.status === 'overdue' ? 'danger' : 'warning'}
                    size="sm"
                  >
                    {pendingFee.status === 'overdue' ? 'Em Atraso' : 'Aguardando Pagamento'}
                  </Badge>
                ) : (
                  <Badge variant="success" size="sm">Em Dia</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {pendingFee ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-xs text-slate-500">{pendingFee.description}</p>
                      <p className="text-2xl font-bold text-slate-900 mt-1 font-display">
                        {formatCurrency(pendingFee.amount)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] text-slate-500">Vencimento</p>
                      <p
                        className={`text-xs font-bold ${
                          pendingFee.status === 'overdue' ? 'text-rose-600' : 'text-indigo-700'
                        }`}
                      >
                        {formatDate(pendingFee.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="pt-2 flex items-center gap-2">
                    {pendingFee.barcode ? (
                      <Button
                        size="sm"
                        variant="primary"
                        className="w-full"
                        leftIcon={copiedBarcode ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        onClick={() => handleCopyBarcode(pendingFee.barcode!)}
                      >
                        {copiedBarcode ? 'Código de Barras Copiado!' : 'Copiar Código de Barras'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="primary"
                        className="w-full"
                        onClick={() => onNavigate('morador-financeiro')}
                      >
                        Ver Detalhes do Lançamento
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <div className="py-4 text-center space-y-1">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-sm font-bold text-slate-800">Tudo em dia!</p>
                  <p className="text-xs text-slate-500">
                    Nenhuma cota condominial em aberto ou pendente para sua unidade.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Histórico Recente de Pagamentos da Unidade */}
          <Card>
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-xs font-semibold text-slate-700 uppercase">
                Últimos Pagamentos Confirmados
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {recentPayments.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {recentPayments.map((pag) => (
                    <div
                      key={pag.id}
                      className="p-3.5 px-5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{pag.description}</p>
                        <p className="text-slate-400 text-[11px]">
                          Pago em {formatDate(pag.paymentDate || pag.dueDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-700">{formatCurrency(pag.amount)}</p>
                        <Badge variant="success" size="sm">Quitado</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  Nenhum histórico recente de pagamentos registrado.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 3. COMUNICADOS & MANUTENÇÕES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Comunicados do Condomínio */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-indigo-600" />
              <CardTitle className="text-sm">Avisos e Comunicados</CardTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('morador-comunicados')}
            >
              Ver Todos
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentAnnouncements.length > 0 ? (
              <div className="space-y-2.5">
                {recentAnnouncements.map((comunicado) => (
                  <div
                    key={comunicado.id}
                    className="p-3 rounded-lg border border-slate-200/80 hover:border-slate-300 transition-colors text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-semibold text-slate-900 truncate">{comunicado.title}</h4>
                      {comunicado.isPinned && (
                        <Badge variant="danger" size="sm">Importante</Badge>
                      )}
                    </div>
                    <p className="text-slate-600 text-[11px] line-clamp-2 leading-relaxed">
                      {comunicado.content}
                    </p>
                    <p className="text-[10px] text-slate-400 pt-1">
                      Publicado em {formatDate(comunicado.publishedAt || comunicado.createdAt)} por {comunicado.authorName}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Nenhum comunicado disponível no momento.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Minhas Solicitações de Manutenção */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-indigo-600" />
              <CardTitle className="text-sm">Manutenções & Chamados</CardTitle>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onNavigate('morador-manutencao')}
              leftIcon={<PlusCircle className="w-3.5 h-3.5" />}
            >
              Abrir Chamado
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {myMaintenanceRequests.length > 0 ? (
              <div className="space-y-2.5">
                {myMaintenanceRequests.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-slate-200/80 text-xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-slate-800 truncate">{item.title}</h4>
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
                    </div>
                    <p className="text-slate-500 text-[11px] line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                      <span>Local: {item.location}</span>
                      <span>Aberto em {formatDate(item.openedAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Você não possui nenhum chamado de manutenção em aberto.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. DOCUMENTOS & ASSEMBLEIAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documentos Públicos */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <CardTitle className="text-sm">Documentos Oficiais</CardTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('morador-documentos')}
            >
              Ver Todos
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {publicDocuments.length > 0 ? (
              publicDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="p-2.5 rounded-lg border border-slate-200/80 hover:bg-slate-50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{doc.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {doc.fileType.toUpperCase()} • {(doc.fileSize / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1 text-indigo-600"
                    onClick={() => onNavigate('morador-documentos')}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Nenhum documento disponível para download.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximas Assembleias */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              <CardTitle className="text-sm">Assembleias & Atas</CardTitle>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onNavigate('morador-assembleias')}
            >
              Ver Todas
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAssemblies.length > 0 ? (
              upcomingAssemblies.map((ass) => (
                <div
                  key={ass.id}
                  className="p-3 rounded-lg border border-slate-200/80 text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-semibold text-slate-800 truncate">{ass.title}</h4>
                    <Badge
                      variant={ass.status === 'scheduled' ? 'indigo' : 'neutral'}
                      size="sm"
                    >
                      {ass.status === 'scheduled' ? 'Convocada' : 'Realizada'}
                    </Badge>
                  </div>
                  <p className="text-slate-500 text-[11px] truncate">
                    Local / Formato: {ass.location} ({ass.format === 'presential' ? 'Presencial' : ass.format === 'virtual' ? 'Virtual' : 'Híbrida'})
                  </p>
                  <div className="text-[10px] text-indigo-600 font-medium">
                    Data: {formatDateTime(ass.date)}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Nenhuma assembleia agendada no momento.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
