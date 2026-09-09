import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Plus, Download, RefreshCw, Folder } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  documentService,
  DocumentRow,
} from '../../services/supabase/documentService';
import { formatDate } from '../../utils/formatters';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import { DocumentCategory } from '../../types/database';

export const DocumentosPage: React.FC = () => {
  const { condominium, user, isAdmin } = useAuth();
  const condoId = condominium?.id || user?.condominiumId;

  const [documentos, setDocumentos] = useState<DocumentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal Novo Documento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaDescricao, setNovaDescricao] = useState('');
  const [novaCategoria, setNovaCategoria] = useState<DocumentCategory>('regulations');
  const [novoFileUrl, setNovoFileUrl] = useState('');

  const loadDocumentos = useCallback(async () => {
    if (!condoId) {
      setDocumentos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await documentService.listByCondominium(condoId);
      setDocumentos(data);
    } catch (err: any) {
      console.error('Erro ao carregar documentos do Supabase:', err);
      setError(err?.message || 'Falha ao buscar documentos.');
    } finally {
      setIsLoading(false);
    }
  }, [condoId]);

  useEffect(() => {
    loadDocumentos();
  }, [loadDocumentos]);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condoId) return;

    if (!novoTitulo.trim() || !novoFileUrl.trim()) {
      setFormError('Título e link/URL do arquivo são obrigatórios.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await documentService.create({
        condominium_id: condoId,
        title: novoTitulo.trim(),
        description: novaDescricao.trim() || null,
        category: novaCategoria,
        file_path: novoFileUrl.trim(),
        file_name: novoTitulo.trim() + '.pdf',
        file_type: 'application/pdf',
        file_size: 102400,
        visibility: 'all',
      });

      setNovoTitulo('');
      setNovaDescricao('');
      setNovoFileUrl('');
      setIsModalOpen(false);
      await loadDocumentos();
    } catch (err: any) {
      console.error('Erro ao salvar documento:', err);
      setFormError(err?.message || 'Falha ao salvar documento no Supabase.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'regulations':
        return 'Regimento & Convenção';
      case 'minutes':
        return 'Ata de Assembleia';
      case 'financial_reports':
        return 'Prestação de Contas';
      case 'contracts':
        return 'Contrato';
      case 'notices':
        return 'Edital / Convocação';
      default:
        return 'Geral';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Central de Documentos
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Convenção, Regimento Interno, Atas e Prestações de Contas (Fonte: Supabase)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="md"
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            onClick={loadDocumentos}
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
              Novo Documento
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
            <span className="text-xs text-slate-500">Buscando documentos no Supabase...</span>
          </div>
        </div>
      ) : documentos.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6" />}
          title="Nenhum documento cadastrado"
          description="Nenhum documento oficial, ata ou convenção foi registrado para este condomínio no banco de dados."
          actionLabel={isAdmin ? 'Adicionar Primeiro Documento' : undefined}
          onAction={isAdmin ? () => setIsModalOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documentos.map((doc) => (
            <Card key={doc.id} className="flex flex-col justify-between hover:border-slate-300 transition-colors">
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <Badge variant="neutral" size="sm">{getCategoryLabel(doc.category)}</Badge>
                  <span className="text-[11px] text-slate-400">PDF / Doc</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-2 line-clamp-2">
                  {doc.title}
                </h3>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                {doc.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{doc.description}</p>
                )}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{formatDate(doc.created_at)}</span>
                  {doc.file_path && (
                    <a
                      href={doc.file_path}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      <Download className="w-3.5 h-3.5" /> Abrir
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Novo Documento */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Novo Documento Oficial"
        description="Cadastre um documento para consulta dos condôminos"
      >
        <form onSubmit={handleCreateDocument} className="space-y-3 text-xs">
          {formError && (
            <Alert type="error" title="Atenção">
              {formError}
            </Alert>
          )}

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Título do Documento *</label>
            <Input
              placeholder="Ex: Convenção Condominial 2026, Ata AGO..."
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
              <option value="regulations">Regimento & Convenção</option>
              <option value="minutes">Ata de Assembleia</option>
              <option value="financial_reports">Prestação de Contas</option>
              <option value="contracts">Contrato com Terceiros</option>
              <option value="notices">Edital / Convocação</option>
              <option value="other">Outro Documento</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Descrição</label>
            <textarea
              rows={3}
              className="w-full text-xs rounded-lg border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              placeholder="Breve resumo ou contexto do documento..."
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Link / URL do Arquivo *</label>
            <Input
              placeholder="https://..."
              value={novoFileUrl}
              onChange={(e) => setNovoFileUrl(e.target.value)}
              required
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
              {isSubmitting ? 'Salvando...' : 'Salvar Documento'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
