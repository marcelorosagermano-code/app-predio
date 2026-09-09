import React, { useState, useEffect, useCallback } from 'react';
import { Megaphone, Plus, RefreshCw, Pin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  announcementService,
  AnnouncementRow,
} from '../../services/supabase/announcementService';
import { formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import { AnnouncementCategory } from '../../types/database';

export const ComunicadosPage: React.FC = () => {
  const { condominium, user, isAdmin } = useAuth();
  const condoId = condominium?.id || user?.condominiumId;

  const [comunicados, setComunicados] = useState<AnnouncementRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Novo Comunicado
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novoConteudo, setNovoConteudo] = useState('');
  const [novaCategoria, setNovaCategoria] = useState<AnnouncementCategory>('general');
  const [isPinned, setIsPinned] = useState(false);

  const loadComunicados = useCallback(async () => {
    if (!condoId) {
      setComunicados([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await announcementService.listByCondominium(condoId);
      setComunicados(data);
    } catch (err: any) {
      console.error('Erro ao carregar comunicados do Supabase:', err);
      setError(err?.message || 'Falha ao buscar comunicados.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId]);

  useEffect(() => {
    loadComunicados();
  }, [loadComunicados]);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoId) return;

    if (!novoTitulo.trim() || !novoConteudo.trim()) {
      setFormError('Título e conteúdo são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await announcementService.create({
        condominium_id: condoId,
        title: novoTitulo.trim(),
        content: novoConteudo.trim(),
        category: novaCategoria,
        is_pinned: isPinned,
        author_id: user?.id || null,
        status: 'published',
      });

      setNovoTitulo('');
      setNovoConteudo('');
      setIsPinned(false);
      setIsModalOpen(false);
      await loadComunicados();
    } catch (err: any) {
      console.error('Erro ao publicar comunicado:', err);
      setFormError(err?.message || 'Falha ao salvar comunicado no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'emergency':
        return 'Urgente / Emergência';
      case 'maintenance':
        return 'Manutenção';
      case 'event':
        return 'Evento';
      default:
        return 'Geral';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Mural de Comunicados e Avisos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Publicações e circulares informativas aos condôminos (Fonte: Supabase)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadComunicados}
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
              Novo Comunicado
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
            <span className="text-xs text-slate-500">Buscando comunicados no Supabase...</span>
          </div>
        </div>
      ) : comunicados.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="w-6 h-6" />}
          title="Nenhum comunicado publicado"
          description="Nenhum comunicado ou aviso foi publicado para este condomínio até o momento no banco de dados."
          actionLabel={isAdmin ? 'Publicar Primeiro Comunicado' : undefined}
          onAction={isAdmin ? () => setIsModalOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {comunicados.map((comunicado) => (
            <Card key={comunicado.id} className="overflow-hidden">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={comunicado.category === 'emergency' ? 'danger' : 'indigo'}
                      size="sm"
                    >
                      {getCategoryLabel(comunicado.category)}
                    </Badge>
                    {comunicado.is_pinned && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                        <Pin className="w-3 h-3" /> Fixado
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    Publicado em {formatDate(comunicado.created_at)}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-2">
                  {comunicado.title}
                </h3>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4">
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                  {comunicado.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Novo Comunicado */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Comunicado"
        description="Publique uma circular ou comunicado oficial no mural do condomínio"
      >
        <form onSubmit={handleCreateAnnouncement} className="space-y-3 text-xs">
          {formError && (
            <Alert type="error" title="Atenção">
              {formError}
            </Alert>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Título do Comunicado *</label>
            <Input
              placeholder="Ex: Reunião sobre pintura da fachada, Manutenção de água..."
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Categoria *</label>
            <select
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value as any)}
              className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none"
            >
              <option value="general">Geral</option>
              <option value="maintenance">Manutenção / Obras</option>
              <option value="event">Evento / Convivência</option>
              <option value="emergency">Urgente / Emergência</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Conteúdo da Mensagem *</label>
            <textarea
              rows={5}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="Escreva as informações detalhadas para todos os moradores..."
              value={novoConteudo}
              onChange={(e) => setNovoConteudo(e.target.value)}
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="pin-announcement"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="pin-announcement" className="text-xs text-slate-700 font-medium">
              Fixar este comunicado no topo do mural
            </label>
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
              {isSubmitting ? 'Publicando...' : 'Publicar Comunicado'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
