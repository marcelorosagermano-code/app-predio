import React, { useState } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  User,
} from 'lucide-react';
import { mockManutencoes } from '../../services/mockData';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';

export const ManutencaoPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = mockManutencoes.filter((m) => {
    return statusFilter === 'ALL' || m.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Manutenções e Ocorrências
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Acompanhamento de serviços preventivos, corretivos e chamados prediais
          </p>
        </div>

        <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
          Nova Ordem de Serviço
        </Button>
      </div>

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
          Todas ({mockManutencoes.length})
        </button>
        <button
          onClick={() => setStatusFilter('ABERTA')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'ABERTA'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Abertas ({mockManutencoes.filter((m) => m.status === 'ABERTA').length})
        </button>
        <button
          onClick={() => setStatusFilter('EM_ANDAMENTO')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'EM_ANDAMENTO'
              ? 'bg-sky-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Em Andamento ({mockManutencoes.filter((m) => m.status === 'EM_ANDAMENTO').length})
        </button>
        <button
          onClick={() => setStatusFilter('CONCLUIDA')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            statusFilter === 'CONCLUIDA'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Concluídas ({mockManutencoes.filter((m) => m.status === 'CONCLUIDA').length})
        </button>
      </div>

      {/* Grid of Maintenance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <Card key={item.id} className="flex flex-col justify-between hover:shadow-xs transition-shadow">
            <CardHeader className="p-4 pb-3">
              <div className="flex items-start justify-between gap-2">
                <Badge
                  variant={
                    item.status === 'CONCLUIDA'
                      ? 'success'
                      : item.status === 'EM_ANDAMENTO'
                      ? 'info'
                      : 'warning'
                  }
                  size="sm"
                  dot
                >
                  {item.status === 'CONCLUIDA'
                    ? 'Concluída'
                    : item.status === 'EM_ANDAMENTO'
                    ? 'Em Andamento'
                    : 'Aberta'}
                </Badge>
                <span className="text-[11px] font-medium text-slate-400">
                  Prioridade: <span className="font-bold text-slate-700">{item.prioridade}</span>
                </span>
              </div>
              <h3 className="font-bold text-sm text-slate-900 mt-2 line-clamp-2">
                {item.titulo}
              </h3>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                {item.descricao}
              </p>
              <div className="p-2.5 bg-slate-50 rounded-lg text-[11px] space-y-1 text-slate-600">
                <p>📍 Local: <span className="font-medium text-slate-800">{item.local} ({item.localDescricao || 'Geral'})</span></p>
                <p>👤 Solicitante: <span className="font-medium text-slate-800">{item.solicitanteNome}</span></p>
                {item.responsavelNome && (
                  <p>🛠️ Responsável: <span className="font-medium text-slate-800">{item.responsavelNome}</span></p>
                )}
              </div>
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span>Aberto em {formatDate(item.dataAbertura)}</span>
                {item.custoEstimado && (
                  <span className="font-bold text-slate-700">
                    {formatCurrency(item.custoEstimado)}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
