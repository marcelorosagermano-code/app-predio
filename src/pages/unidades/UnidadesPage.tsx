import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Search,
  Plus,
  User,
  Phone,
  Mail,
  Eye,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { unitService, UnitWithRelations } from '../../services/supabase/unitService';
import { SituacaoUnidade, SituacaoFinanceiraUnidade } from '../../types';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/Alert';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../components/ui/Table';

interface DisplayUnidade {
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

export const UnidadesPage: React.FC = () => {
  const { condominium, user, isAdmin } = useAuth();
  const condoId = condominium?.id || user?.condominiumId;

  const [unidades, setUnidades] = useState<DisplayUnidade[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedUnidade, setSelectedUnidade] = useState<DisplayUnidade | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Formulário de Nova Unidade
  const [novoNumero, setNovoNumero] = useState('');
  const [novoBloco, setNovoBloco] = useState('Bloco A');
  const [novoAndar, setNovoAndar] = useState('1');
  const [novaMetragem, setNovaMetragem] = useState('65');
  const [novoProprietarioNome, setNovoProprietarioNome] = useState('');
  const [novoProprietarioEmail, setNovoProprietarioEmail] = useState('');
  const [novoProprietarioTelefone, setNovoProprietarioTelefone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const mapUnitToDisplay = (u: UnitWithRelations): DisplayUnidade => {
    const primaryOwner = u.owners?.find((o) => o.is_primary) || u.owners?.[0];
    const primaryResident = u.residents?.find((r) => r.is_primary) || u.residents?.[0];

    const sit: SituacaoUnidade =
      u.status === 'vacant'
        ? 'DESOCUPADA'
        : u.status === 'under_renovation'
        ? 'EM_REFORMA'
        : primaryResident
        ? 'OCUPADA_INQUILINO'
        : 'OCUPADA_PROPRIETARIO';

    return {
      id: u.id,
      condominioId: u.condominium_id,
      numero: u.unit_number,
      bloco: u.block || undefined,
      andar: u.floor || undefined,
      metragem: u.sqm || undefined,
      fracaoIdeal: u.ideal_fraction || undefined,
      situacao: sit,
      situacaoFinanceira: 'EM_DIA',
      proprietarioNome: primaryOwner?.name || 'Não informado',
      proprietarioEmail: primaryOwner?.email || '-',
      proprietarioTelefone: primaryOwner?.phone || '-',
      moradorNome: primaryResident?.name,
      moradorEmail: primaryResident?.email,
      moradorTelefone: primaryResident?.phone,
      vagasGaragem: 'Conforme convenção',
      criadoEm: u.created_at,
      atualizadoEm: u.updated_at,
    };
  };

  const loadUnidades = useCallback(async () => {
    if (!condoId) {
      setUnidades([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await unitService.listByCondominium(condoId);
      setUnidades(data.map(mapUnitToDisplay));
    } catch (err: any) {
      console.error('Erro ao buscar unidades do Supabase:', err);
      setError(err?.message || 'Não foi possível carregar as unidades do banco de dados.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId]);

  useEffect(() => {
    loadUnidades();
  }, [loadUnidades]);

  const handleCreateUnidade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoId) return;

    if (!novoNumero.trim()) {
      setFormError('Número da unidade é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const created = await unitService.create({
        condominium_id: condoId,
        unit_number: novoNumero.trim(),
        block: novoBloco.trim() || null,
        floor: parseInt(novoAndar, 10) || 1,
        sqm: parseFloat(novaMetragem) || 50,
        ideal_fraction: 0.025,
        status: 'occupied',
      });

      if (novoProprietarioNome.trim()) {
        await unitService.addOwner({
          unit_id: created.id,
          name: novoProprietarioNome.trim(),
          email: novoProprietarioEmail.trim() || null,
          phone: novoProprietarioTelefone.trim() || null,
          is_primary: true,
        });
      }

      // Reset form
      setNovoNumero('');
      setNovoProprietarioNome('');
      setNovoProprietarioEmail('');
      setNovoProprietarioTelefone('');
      setIsCreateModalOpen(false);
      await loadUnidades();
    } catch (err: any) {
      console.error('Erro ao cadastrar unidade:', err);
      setFormError(err?.message || 'Falha ao salvar unidade no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUnidades = unidades.filter((u) => {
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

  const handleOpenDetail = (unidade: DisplayUnidade) => {
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
            Total de {unidades.length} unidades cadastradas no condomínio (Fonte: Supabase)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadUnidades}
            disabled={isLoading}
          >
            Atualizar
          </Button>

          {isAdmin && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Nova Unidade
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert type="error" title="Erro de Comunicação">
          {error}
        </Alert>
      )}

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

      {/* Table or Loading or Empty State */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs text-slate-500">Carregando unidades do Supabase...</span>
          </div>
        </div>
      ) : unidades.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="Nenhuma unidade cadastrada"
          description="Cadastre as unidades do condomínio para gerenciar moradores, proprietários e lançamentos financeiros."
          actionLabel={isAdmin ? 'Cadastrar Primeira Unidade' : undefined}
          onAction={isAdmin ? () => setIsCreateModalOpen(true) : undefined}
        />
      ) : (
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
                        {unidade.bloco || 'Principal'} • {unidade.metragem || 0} m²
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
      )}

      {/* Modal Nova Unidade */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Cadastrar Nova Unidade"
        description="Adicione uma nova unidade residencial ao condomínio"
      >
        <form onSubmit={handleCreateUnidade} className="space-y-3 text-xs">
          {formError && (
            <Alert type="error" title="Atenção">
              {formError}
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Número / Identificador *</label>
              <Input
                placeholder="Ex: 101, 204"
                value={novoNumero}
                onChange={(e) => setNovoNumero(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Bloco / Torre</label>
              <Input
                placeholder="Ex: Bloco A"
                value={novoBloco}
                onChange={(e) => setNovoBloco(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Andar</label>
              <Input
                type="number"
                placeholder="1"
                value={novoAndar}
                onChange={(e) => setNovoAndar(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Metragem (m²)</label>
              <Input
                type="number"
                placeholder="65"
                value={novaMetragem}
                onChange={(e) => setNovaMetragem(e.target.value)}
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2">
            <h4 className="font-bold text-slate-800">Proprietário (Opcional)</h4>
            <div>
              <label className="block text-slate-600 mb-0.5">Nome Completo</label>
              <Input
                placeholder="Nome do proprietário"
                value={novoProprietarioNome}
                onChange={(e) => setNovoProprietarioNome(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-600 mb-0.5">E-mail</label>
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={novoProprietarioEmail}
                  onChange={(e) => setNovoProprietarioEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-0.5">Telefone</label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={novoProprietarioTelefone}
                  onChange={(e) => setNovoProprietarioTelefone(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
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
              {isSubmitting ? 'Salvando...' : 'Salvar Unidade'}
            </Button>
          </div>
        </form>
      </Modal>

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
                  {selectedUnidade.numero} ({selectedUnidade.bloco || 'Principal'})
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-[11px]">Metragem / Fração Ideal</p>
                <p className="font-bold text-slate-800 text-sm">
                  {selectedUnidade.metragem || 0} m² ({selectedUnidade.fracaoIdeal || '-'})
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
          </div>
        </Modal>
      )}
    </div>
  );
};
