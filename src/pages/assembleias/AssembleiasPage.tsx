import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Calendar, Clock, MapPin, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  assemblyService,
  AssemblyRow,
} from '../../services/supabase/assemblyService';
import { formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import { AssemblyType, AssemblyFormat } from '../../types/database';

export const AssembleiasPage: React.FC = () => {
  const { condominium, user, isAdmin } = useAuth();
  const condoId = condominium?.id || user?.condominiumId;

  const [assembleias, setAssembleias] = useState<AssemblyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Convocar Assembleia
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoTipo, setNovoTipo] = useState<AssemblyType>('ordinary');
  const [novoFormato, setNovoFormato] = useState<AssemblyFormat>('presential');
  const [novaData, setNovaData] = useState('');
  const [novoLocal, setNovoLocal] = useState('Salão de Festas');
  const [novaDescricao, setNovaDescricao] = useState('');

  const loadAssembleias = useCallback(async () => {
    if (!condoId) {
      setAssembleias([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await assemblyService.listByCondominium(condoId);
      setAssembleias(data);
    } catch (err: any) {
      console.error('Erro ao carregar assembleias do Supabase:', err);
      setError(err?.message || 'Falha ao buscar assembleias.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId]);

  useEffect(() => {
    loadAssembleias();
  }, [loadAssembleias]);

  const handleCreateAssembly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoId) return;

    if (!novoTitulo.trim() || !novaData.trim()) {
      setFormError('Título e data da assembleia são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const agendaItems = novaDescricao
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

      await assemblyService.create({
        condominium_id: condoId,
        title: novoTitulo.trim(),
        type: novoTipo,
        status: 'scheduled',
        format: novoFormato,
        date: novaData,
        location: novoLocal.trim() || 'Salão de Festas',
        agenda: agendaItems.length > 0 ? agendaItems : ['Deliberação geral'],
      });

      setNovoTitulo('');
      setNovaData('');
      setNovaDescricao('');
      setIsModalOpen(false);
      await loadAssembleias();
    } catch (err: any) {
      console.error('Erro ao convocar assembleia:', err);
      setFormError(err?.message || 'Falha ao salvar assembleia no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Assembleias & Atas
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Convocação de reuniões ordinárias, extraordinárias e histórico de deliberações (Fonte: Supabase)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadAssembleias}
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
              Convocar Assembleia
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Alert type="error" title="Erro">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs text-slate-500">Buscando assembleias no Supabase...</span>
          </div>
        </div>
      ) : assembleias.length === 0 ? (
        <EmptyState
          icon={<Users className="w-6 h-6" />}
          title="Nenhuma assembleia agendada"
          description="Nenhuma assembleia ordinária ou extraordinária foi convocada até o momento no banco de dados."
          actionLabel={isAdmin ? 'Convocar Primeira Assembleia' : undefined}
          onAction={isAdmin ? () => setIsModalOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {assembleias.map((ass) => (
            <Card key={ass.id}>
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant={ass.status === 'scheduled' ? 'indigo' : 'neutral'} size="sm">
                    {ass.type === 'ordinary' ? 'Ordinária (AGO)' : 'Extraordinária (AGE)'}
                  </Badge>
                  <Badge variant={ass.status === 'scheduled' ? 'warning' : 'success'} size="sm">
                    {ass.status === 'scheduled' ? 'Convocação Aberta' : 'Realizada'}
                  </Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-2">
                  {ass.title}
                </h3>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl space-y-1 text-slate-700">
                  <p className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <strong>Data:</strong> {formatDate(ass.date)} | <strong>Formato:</strong> {ass.format === 'presential' ? 'Presencial' : ass.format === 'virtual' ? 'Online' : 'Híbrido'}
                  </p>
                  {ass.location && (
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-500" />
                      <strong>Local / Link:</strong> {ass.location}
                    </p>
                  )}
                </div>

                {ass.agenda && ass.agenda.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">Pautas Convocadas:</h4>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                      {ass.agenda.map((pauta, idx) => (
                        <li key={idx}>{pauta}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Convocar Assembleia */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Convocar Nova Assembleia"
        description="Agende uma assembleia oficial com envio de pautas para os condôminos"
      >
        <form onSubmit={handleCreateAssembly} className="space-y-3 text-xs">
          {formError && (
            <Alert type="error" title="Atenção">
              {formError}
            </Alert>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Título da Assembleia *</label>
            <Input
              placeholder="Ex: Assembleia Geral Ordinária de Eleição de Síndico e Orçamento..."
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
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
                <option value="ordinary">Ordinária (AGO)</option>
                <option value="extraordinary">Extraordinária (AGE)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Formato *</label>
              <select
                value={novoFormato}
                onChange={(e) => setNovoFormato(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none"
              >
                <option value="presential">Presencial</option>
                <option value="virtual">Virtual / Online</option>
                <option value="hybrid">Híbrido</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Data *</label>
              <Input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Local / Link</label>
              <Input
                placeholder="Ex: Salão de festas ou link do Meet"
                value={novoLocal}
                onChange={(e) => setNovoLocal(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Ordem do Dia / Pautas *</label>
            <textarea
              rows={4}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="1. Prestação de contas&#10;2. Previsão orçamentária&#10;3. Eleição de síndico e conselho"
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
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
              {isSubmitting ? 'Convocando...' : 'Salvar e Publicar Convocação'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
