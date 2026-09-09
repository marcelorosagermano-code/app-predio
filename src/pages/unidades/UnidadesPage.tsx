import React, { useState } from 'react';
import {
  Building2,
  Search,
  Plus,
  Filter,
  User,
  Phone,
  Mail,
  Car,
  MoreVertical,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Edit2,
} from 'lucide-react';
import { mockUnidades } from '../../services/mockData';
import { Unidade, SituacaoUnidade } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table';

export const UnidadesPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const filteredUnidades = mockUnidades.filter((u) => {
    const matchesSearch =
      u.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.bloco && u.bloco.toLowerCase().includes(searchTerm.toLowerCase())) ||
      u.proprietarioNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.moradorNome && u.moradorNome.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'EM_DIA' && u.situacaoFinanceira === 'EM_DIA') ||
      (statusFilter === 'PENDENTE' && u.situacaoFinanceira === 'PENDENTE') ||
      (statusFilter === 'INADIMPLENTE' && u.situacaoFinanceira === 'INADIMPLENTE');

    return matchesSearch && matchesStatus;
  });

  const getSituacaoLabel = (situacao: SituacaoUnidade) => {
    switch (situacao) {
      case 'OCUPADA_PROPRIETARIO':
        return 'Ocupada (Proprietário)';
      case 'OCUPADA_INQUILINO':
        return 'Ocupada (Inquilino)';
      case 'DESOCUPADA':
        return 'Desocupada';
      case 'EM_REFORMA':
        return 'Em Reforma';
    }
  };

  const handleOpenDetail = (unidade: Unidade) => {
    setSelectedUnidade(unidade);
    setIsDetailModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Cadastro e Gestão de Unidades
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Total de {mockUnidades.length} unidades cadastradas no condomínio
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={() => {}}
        >
          Nova Unidade
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              id="search-unidades"
              placeholder="Buscar por número, bloco, proprietário ou morador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
              Filtrar Situação:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            >
              <option value="ALL">Todas as situações</option>
              <option value="EM_DIA">Financeiro: Em Dia</option>
              <option value="PENDENTE">Financeiro: Pendente</option>
              <option value="INADIMPLENTE">Financeiro: Inadimplente</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Units Table */}
      <Table id="table-unidades">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Unidade</TableHeaderCell>
            <TableHeaderCell>Proprietário</TableHeaderCell>
            <TableHeaderCell>Morador / Contato</TableHeaderCell>
            <TableHeaderCell>Ocupação</TableHeaderCell>
            <TableHeaderCell>Situação Financeira</TableHeaderCell>
            <TableHeaderCell className="text-right">Ações</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredUnidades.map((unidade) => (
            <TableRow key={unidade.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100 shrink-0">
                    {unidade.numero}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-xs">
                      Apto {unidade.numero}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {unidade.bloco || 'Principal'} • {unidade.metragem} m²
                    </p>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <p className="font-semibold text-slate-800 text-xs">{unidade.proprietarioNome}</p>
                <p className="text-[11px] text-slate-400">{unidade.proprietarioEmail}</p>
              </TableCell>

              <TableCell>
                <p className="text-slate-700 text-xs font-medium">
                  {unidade.moradorNome || unidade.proprietarioNome}
                </p>
                <p className="text-[11px] text-slate-400">{unidade.moradorTelefone || unidade.proprietarioTelefone}</p>
              </TableCell>

              <TableCell>
                <span className="text-xs text-slate-600">
                  {getSituacaoLabel(unidade.situacao)}
                </span>
              </TableCell>

              <TableCell>
                <Badge
                  variant={
                    unidade.situacaoFinanceira === 'EM_DIA'
                      ? 'success'
                      : unidade.situacaoFinanceira === 'PENDENTE'
                      ? 'warning'
                      : 'danger'
                  }
                  size="sm"
                  dot
                >
                  {unidade.situacaoFinanceira === 'EM_DIA'
                    ? 'Em Dia'
                    : unidade.situacaoFinanceira === 'PENDENTE'
                    ? 'Pendente'
                    : 'Inadimplente'}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenDetail(unidade)}
                    className="p-1.5 text-slate-500 hover:text-indigo-600"
                    title="Ver detalhes da unidade"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Detail Modal */}
      {selectedUnidade && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Detalhes da Unidade ${selectedUnidade.numero} - ${selectedUnidade.bloco || ''}`}
          description="Informações cadastrais, proprietário, morador e contatos"
          maxWidth="lg"
          footer={
            <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
              Fechar
            </Button>
          }
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="text-slate-400 text-[11px]">Número / Bloco</p>
                <p className="font-bold text-slate-800 text-sm">
                  {selectedUnidade.numero} ({selectedUnidade.bloco})
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Metragem / Fração Ideal</p>
                <p className="font-bold text-slate-800 text-sm">
                  {selectedUnidade.metragem} m² ({selectedUnidade.fracaoIdeal})
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Vaga de Garagem</p>
                <p className="font-semibold text-slate-700">{selectedUnidade.vagasGaragem || 'Não vinculada'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Situação Financeira</p>
                <Badge
                  variant={
                    selectedUnidade.situacaoFinanceira === 'EM_DIA'
                      ? 'success'
                      : selectedUnidade.situacaoFinanceira === 'PENDENTE'
                      ? 'warning'
                      : 'danger'
                  }
                  size="sm"
                >
                  {selectedUnidade.situacaoFinanceira}
                </Badge>
              </div>
            </div>

            {/* Proprietário */}
            <div className="p-3 border border-slate-200 rounded-xl space-y-1.5">
              <h4 className="font-bold text-slate-900 text-xs">Dados do Proprietário</h4>
              <p className="text-slate-700">Nome: <span className="font-medium">{selectedUnidade.proprietarioNome}</span></p>
              <p className="text-slate-700">Email: <span className="font-medium">{selectedUnidade.proprietarioEmail}</span></p>
              <p className="text-slate-700">Telefone: <span className="font-medium">{selectedUnidade.proprietarioTelefone}</span></p>
            </div>

            {/* Morador */}
            {selectedUnidade.moradorNome && (
              <div className="p-3 border border-slate-200 rounded-xl space-y-1.5">
                <h4 className="font-bold text-slate-900 text-xs">Dados do Morador Atual</h4>
                <p className="text-slate-700">Nome: <span className="font-medium">{selectedUnidade.moradorNome}</span></p>
                <p className="text-slate-700">Email: <span className="font-medium">{selectedUnidade.moradorEmail || '-'}</span></p>
                <p className="text-slate-700">Telefone: <span className="font-medium">{selectedUnidade.moradorTelefone || '-'}</span></p>
              </div>
            )}

            {selectedUnidade.observacoes && (
              <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                <p className="font-semibold text-amber-900 text-[11px]">Observações Cadastrais:</p>
                <p className="text-amber-800 text-xs mt-0.5">{selectedUnidade.observacoes}</p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
