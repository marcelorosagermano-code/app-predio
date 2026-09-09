import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Users,
  Shield,
  Key,
  Database,
  CheckCircle2,
  Lock,
  RefreshCw,
  AlertTriangle,
  Server,
  Zap,
  Copy,
  Check,
  Plus,
  AlertCircle,
  Home,
  UserCheck,
  Clock,
  Pencil,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/supabase/authService';
import { isSupabaseConfigured } from '../../services/supabase/client';
import {
  runSupabaseDiagnostics,
  seedInitialDataToSupabase,
  SupabaseDiagnosticReport,
} from '../../services/supabase/diagnostics';
import { SUPABASE_STAGE_2_SQL } from '../../services/supabase/rawSchema';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';

interface CondominiumUserItem {
  id: string;
  nome: string;
  email: string;
  role: string;
  cargo: string;
  ativo: boolean;
  unidadeNumero: string | null;
  primeiroAcessoPendente: boolean;
  criadoEm: string;
}

export const ConfiguracoesPage: React.FC = () => {
  const { condominio, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'CONDOMINIO' | 'USUARIOS' | 'PERMISSOES' | 'SUPABASE'>('USUARIOS');
  
  // Estados para Gestão de Usuários e Acessos
  const [usersList, setUsersList] = useState<CondominiumUserItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState<boolean>(false);
  const [isSubmittingUser, setIsSubmittingUser] = useState<boolean>(false);
  const [addUserError, setAddUserError] = useState<string>('');
  const [unitNumber, setUnitNumber] = useState<string>('');
  const [responsibleName, setResponsibleName] = useState<string>('');
  const [createdUserSuccess, setCreatedUserSuccess] = useState<{
    unitNumber: string;
    responsibleName: string;
    initialPassword: string;
  } | null>(null);

  // Estados para Edição de Usuário
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<CondominiumUserItem | null>(null);
  const [editUnitNumber, setEditUnitNumber] = useState<string>('');
  const [editResponsibleName, setEditResponsibleName] = useState<string>('');
  const [editUserError, setEditUserError] = useState<string>('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);

  // Estados para Exclusão de Usuário
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState<boolean>(false);
  const [deletingUser, setDeletingUser] = useState<CondominiumUserItem | null>(null);
  const [deleteUserError, setDeleteUserError] = useState<string>('');
  const [isSubmittingDelete, setIsSubmittingDelete] = useState<boolean>(false);

  // Notificação de feedback de ações
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Estados para o diagnóstico em tempo real do Supabase
  const [diagnosticReport, setDiagnosticReport] = useState<SupabaseDiagnosticReport | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState<boolean>(false);
  const [isSeedingData, setIsSeedingData] = useState<boolean>(false);
  const [seedMessage, setSeedMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

  // Carregar lista de usuários reais
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const list = await authService.listCondominiumUsers();
      if (list && list.length > 0) {
        setUsersList(list);
      } else if (user) {
        setUsersList([
          {
            id: user.id,
            nome: user.fullName || user.email,
            email: user.email,
            role: user.role,
            cargo: user.role === 'admin' ? 'Administrador' : user.role === 'sindico' ? 'Síndico' : 'Morador',
            ativo: user.isActive,
            unidadeNumero: user.unitNumber || null,
            primeiroAcessoPendente: false,
            criadoEm: user.createdAt || new Date().toISOString(),
          },
        ]);
      } else {
        setUsersList([]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar lista de usuários:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'USUARIOS') {
      loadUsers();
    }
  }, [activeTab]);

  const handleCreateMoradorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUserError('');

    if (!unitNumber.trim()) {
      setAddUserError('Por favor, informe o número do apartamento/unidade.');
      return;
    }

    if (!responsibleName.trim()) {
      setAddUserError('Por favor, informe o nome do responsável pela unidade.');
      return;
    }

    setIsSubmittingUser(true);
    try {
      const res = await authService.createMoradorUser(unitNumber.trim(), responsibleName.trim());
      if (res.success) {
        setCreatedUserSuccess({
          unitNumber: res.data.unitNumber,
          responsibleName: res.data.responsibleName,
          initialPassword: res.data.initialPassword,
        });
        setIsAddUserModalOpen(false);
        setUnitNumber('');
        setResponsibleName('');
        await loadUsers();
      } else {
        setAddUserError(res.message || 'Erro ao criar usuário.');
      }
    } catch (err: any) {
      setAddUserError(err.message || 'Erro inesperado ao criar usuário.');
    } finally {
      setIsSubmittingUser(false);
    }
  };

  const handleOpenEditModal = (user: CondominiumUserItem) => {
    setEditingUser(user);
    setEditUnitNumber(user.unidadeNumero || '');
    setEditResponsibleName(user.nome || '');
    setEditUserError('');
    setIsEditUserModalOpen(true);
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditUserError('');

    if (!editUnitNumber.trim()) {
      setEditUserError('Por favor, informe o número do apartamento/unidade.');
      return;
    }

    if (!editResponsibleName.trim()) {
      setEditUserError('Por favor, informe o nome do responsável pela unidade.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const res = await authService.updateMoradorUser(
        editingUser.id,
        editUnitNumber.trim(),
        editResponsibleName.trim()
      );
      if (res.success) {
        setIsEditUserModalOpen(false);
        setEditingUser(null);
        setActionFeedback({ type: 'success', message: 'Usuário atualizado com sucesso.' });
        await loadUsers();
      } else {
        setEditUserError(res.message || 'Erro ao atualizar usuário.');
      }
    } catch (err: any) {
      setEditUserError(err.message || 'Erro inesperado ao atualizar usuário.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenDeleteModal = (user: CondominiumUserItem) => {
    setDeletingUser(user);
    setDeleteUserError('');
    setIsDeleteUserModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    setIsSubmittingDelete(true);
    setDeleteUserError('');

    try {
      const res = await authService.deleteMoradorUser(deletingUser.id);
      if (res.success) {
        setIsDeleteUserModalOpen(false);
        setDeletingUser(null);
        setActionFeedback({ type: 'success', message: 'Usuário excluído com sucesso.' });
        await loadUsers();
      } else {
        setDeleteUserError(res.message || 'Erro ao excluir usuário.');
      }
    } catch (err: any) {
      setDeleteUserError(err.message || 'Erro inesperado ao excluir usuário.');
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Executar teste de conexão ao abrir a aba
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setSeedMessage(null);
    try {
      const report = await runSupabaseDiagnostics();
      setDiagnosticReport(report);
    } catch (err: any) {
      console.error('Erro ao executar diagnóstico:', err);
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'SUPABASE') {
      handleTestConnection();
    }
  }, [activeTab]);

  const handleSeedData = async () => {
    setIsSeedingData(true);
    setSeedMessage(null);
    try {
      const res = await seedInitialDataToSupabase();
      if (res.success) {
        setSeedMessage({ type: 'success', text: res.message });
        await handleTestConnection(); // Atualizar status das tabelas
      } else {
        setSeedMessage({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setSeedMessage({ type: 'error', text: err.message || 'Erro ao sincronizar' });
    } finally {
      setIsSeedingData(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Configurações do Sistema
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Parametrização do condomínio, controle de usuários, perfis e banco de dados
        </p>
      </div>

      {/* Settings Sub-Navigation */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto text-xs">
        <button
          onClick={() => setActiveTab('CONDOMINIO')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'CONDOMINIO'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Dados do Condomínio
        </button>

        <button
          onClick={() => setActiveTab('USUARIOS')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'USUARIOS'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Users className="w-4 h-4" />
          Usuários e Acessos
        </button>

        <button
          onClick={() => setActiveTab('PERMISSOES')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'PERMISSOES'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Shield className="w-4 h-4" />
          Perfis & Permissões (RBAC)
        </button>

        <button
          onClick={() => setActiveTab('SUPABASE')}
          className={`pb-3 font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'SUPABASE'
              ? 'border-b-2 border-indigo-600 text-indigo-600'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Database className="w-4 h-4" />
          Integração Supabase
        </button>
      </div>

      {/* Subtab 1: Condomínio */}
      {activeTab === 'CONDOMINIO' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dados Cadastrais do Condomínio</CardTitle>
            <CardDescription>Informações principais utilizadas nos recibos, atas e comunicados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Razão Social / Nome Fantasia" defaultValue={condominio.nome} />
              <Input label="CNPJ" defaultValue={condominio.cnpj} />
              <Input label="Endereço Completo" defaultValue={condominio.endereco} />
              <Input label="Cidade / UF" defaultValue={`${condominio.cidade} - ${condominio.estado}`} />
              <Input label="Síndico Responsável" defaultValue={condominio.sindicoNome} />
              <Input label="Telefone / WhatsApp de Contato" defaultValue={condominio.telefoneContato} />
              <Input label="Email de Atendimento" defaultValue={condominio.emailContato} />
              <Input label="Total de Unidades" defaultValue={condominio.totalUnidades.toString()} type="number" />
            </div>
            <div className="pt-2 flex justify-end">
              <Button variant="primary" size="md">Salvar Alterações</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subtab 2: Usuários e Acessos */}
      {activeTab === 'USUARIOS' && (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5">
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold">Usuários e Acessos do Condomínio</CardTitle>
              <CardDescription className="text-xs">Contas ativas com acesso administrativo ou morador</CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={loadUsers}
                disabled={isLoadingUsers}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />}
                className="w-full sm:w-auto justify-center"
              >
                Atualizar
              </Button>
              <Button
                id="btn-add-user"
                size="sm"
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  setAddUserError('');
                  setUnitNumber('');
                  setResponsibleName('');
                  setIsAddUserModalOpen(true);
                }}
                className="w-full sm:w-auto justify-center whitespace-nowrap"
              >
                + Adicionar usuário
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {actionFeedback && (
              <div className="p-3 mx-4 my-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold truncate sm:whitespace-normal">{actionFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionFeedback(null)}
                  className="text-emerald-700 hover:text-emerald-950 text-xs font-bold shrink-0 ml-2 p-1"
                >
                  ✕
                </button>
              </div>
            )}

            {isLoadingUsers && usersList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-indigo-600" />
                Carregando usuários cadastrados...
              </div>
            ) : usersList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Nenhum usuário cadastrado no momento.
              </div>
            ) : (
              <>
                {/* DESKTOP: Exibição em Tabela (Visível apenas em telas >= md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-y border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Apartamento</th>
                        <th className="py-3 px-4">Responsável</th>
                        <th className="py-3 px-4">Função / Perfil</th>
                        <th className="py-3 px-4">Status do Acesso</th>
                        <th className="py-3 px-4">Primeiro Acesso</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {u.unidadeNumero ? (
                              <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md">
                                <Home className="w-3 h-3 text-slate-500" />
                                Ap. {u.unidadeNumero}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-normal">Geral</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-800">{u.nome}</div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge
                              variant={
                                u.role === 'admin'
                                  ? 'indigo'
                                  : u.role === 'sindico'
                                  ? 'indigo'
                                  : u.role === 'conselho'
                                  ? 'info'
                                  : 'neutral'
                              }
                              size="sm"
                            >
                              {u.cargo}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <Badge variant={u.ativo ? 'success' : 'danger'} size="sm">
                              {u.ativo ? '● Ativo' : '● Inativo'}
                            </Badge>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {u.role === 'morador' ? (
                              u.primeiroAcessoPendente ? (
                                <Badge variant="warning" size="sm" className="gap-1">
                                  <Clock className="w-3 h-3" />
                                  Pendente
                                </Badge>
                              ) : (
                                <Badge variant="success" size="sm" className="gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Concluído
                                </Badge>
                              )
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            {u.role === 'morador' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  id={`btn-edit-user-${u.id}`}
                                  type="button"
                                  onClick={() => handleOpenEditModal(u)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-md hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-2xs cursor-pointer"
                                  title="Editar morador"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Editar</span>
                                </button>
                                <button
                                  id={`btn-delete-user-${u.id}`}
                                  type="button"
                                  onClick={() => handleOpenDeleteModal(u)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-600 bg-white border border-rose-200 rounded-md hover:bg-rose-50 hover:text-rose-700 transition-colors shadow-2xs cursor-pointer"
                                  title="Excluir acesso do morador"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Excluir</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE: Exibição em Cards Verticais (Visível apenas em telas < md) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <div key={`mobile-${u.id}`} className="p-4 space-y-3 bg-white">
                      {/* Topo do Card: Unidade e Função */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {u.unidadeNumero ? (
                            <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-900 px-2.5 py-1 rounded-lg font-bold text-xs tracking-tight border border-slate-200/80">
                              <Home className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                              Ap. {u.unidadeNumero}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-medium text-xs border border-slate-200/80">
                              Geral
                            </span>
                          )}
                        </div>
                        <Badge
                          variant={
                            u.role === 'admin'
                              ? 'indigo'
                              : u.role === 'sindico'
                              ? 'indigo'
                              : u.role === 'conselho'
                              ? 'info'
                              : 'neutral'
                          }
                          size="sm"
                        >
                          {u.cargo}
                        </Badge>
                      </div>

                      {/* Dados do Responsável */}
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Responsável
                        </span>
                        <p className="font-semibold text-slate-800 text-sm break-words leading-tight">
                          {u.nome}
                        </p>
                        <p className="text-[11px] text-slate-500 break-all font-mono">
                          {u.email}
                        </p>
                      </div>

                      {/* Linha dupla de Status: Acesso e Primeiro Acesso */}
                      <div className="grid grid-cols-2 gap-2 pt-1 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Acesso
                          </span>
                          <Badge variant={u.ativo ? 'success' : 'danger'} size="sm" className="font-medium inline-flex items-center whitespace-nowrap">
                            {u.ativo ? '● Ativo' : '● Inativo'}
                          </Badge>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Primeiro Acesso
                          </span>
                          {u.role === 'morador' ? (
                            u.primeiroAcessoPendente ? (
                              <Badge variant="warning" size="sm" className="inline-flex items-center whitespace-nowrap">
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span>Pendente</span>
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm" className="inline-flex items-center whitespace-nowrap">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                <span>Concluído</span>
                              </Badge>
                            )
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </div>
                      </div>

                      {/* Botões de Ações no Mobile */}
                      {u.role === 'morador' && (
                        <div className="pt-2 border-t border-slate-100/80 flex items-center gap-2">
                          <button
                            id={`btn-mobile-edit-user-${u.id}`}
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            className="flex-1 min-h-[38px] px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-indigo-600 active:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                            title="Editar dados do morador"
                          >
                            <Pencil className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>Editar</span>
                          </button>
                          <button
                            id={`btn-mobile-delete-user-${u.id}`}
                            type="button"
                            onClick={() => handleOpenDeleteModal(u)}
                            className="flex-1 min-h-[38px] px-3 text-xs font-semibold text-rose-600 bg-white border border-rose-200 rounded-lg hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                            title="Excluir morador"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>Excluir</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subtab 3: Permissões */}
      {activeTab === 'PERMISSOES' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Matriz de Perfis e Permissões (RBAC)</CardTitle>
            <CardDescription>Regras de autorização e isolamento de escopo por papel</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-indigo-950 text-sm">Perfil: ADMINISTRAÇÃO</h4>
                  <Badge variant="indigo" size="sm">Acesso Total</Badge>
                </div>
                <p className="text-slate-600">Acesso a todos os módulos operacionais, financeiros, configurações e auditoria de todas as unidades.</p>
                <ul className="space-y-1 text-slate-700 pt-2 font-medium">
                  <li>✓ Gestão de todas as unidades e moradores</li>
                  <li>✓ Lançamentos de receitas e despesas gerais</li>
                  <li>✓ Abertura e finalização de manutenções</li>
                  <li>✓ Publicação de comunicados e atas</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-emerald-950 text-sm">Perfil: MORADOR</h4>
                  <Badge variant="success" size="sm">Escopo Isolado</Badge>
                </div>
                <p className="text-slate-600">Acesso estrito à própria unidade, boletos vinculados, comunicados gerais e abertura de chamados.</p>
                <ul className="space-y-1 text-slate-700 pt-2 font-medium">
                  <li>✓ Visualiza apenas sua unidade e seus boletos</li>
                  <li>✗ Bloqueado acesso a dados de outras unidades</li>
                  <li>✓ Visualiza comunicados, documentos e assembleias</li>
                  <li>✓ Abre solicitações de manutenção</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subtab 4: Supabase */}
      {activeTab === 'SUPABASE' && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  Diagnóstico de Conexão com o Supabase
                </CardTitle>
                <CardDescription>
                  Verificação em tempo real das variáveis de ambiente, conectividade de rede e integridade das tabelas
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />}
              >
                {isTestingConnection ? 'Testando...' : 'Testar Conexão Agora'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {/* Resumo de Status Principal */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Variáveis de Ambiente
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    {diagnosticReport?.isConfigured ? (
                      <Badge variant="success" size="sm" dot>
                        Configuradas no Ambiente
                      </Badge>
                    ) : (
                      <Badge variant="danger" size="sm" dot>
                        Não Detectadas
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono truncate">
                    URL: {diagnosticReport?.url || 'Aguardando teste...'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Comunicação com a API
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    {diagnosticReport?.canConnect ? (
                      <Badge variant="success" size="sm" dot>
                        Conexão Estabelecida
                      </Badge>
                    ) : diagnosticReport ? (
                      <Badge variant="danger" size="sm" dot>
                        Falha de Conexão
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Não Verificado
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {diagnosticReport?.latencyMs !== undefined
                      ? `Latência da API: ${diagnosticReport.latencyMs} ms`
                      : 'Executando teste...'}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Esquema de Tabelas (SQL)
                  </span>
                  <div className="flex items-center gap-2 pt-0.5">
                    {diagnosticReport?.schemaReady ? (
                      <Badge variant="success" size="sm" dot>
                        Tabelas Criadas & Prontas
                      </Badge>
                    ) : diagnosticReport?.canConnect ? (
                      <Badge variant="warning" size="sm" dot>
                        Tabelas Pendentes de Criação
                      </Badge>
                    ) : (
                      <Badge variant="neutral" size="sm">
                        Indisponível
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {diagnosticReport?.schemaReady
                      ? '9 tabelas e políticas RLS ativas'
                      : 'Execute o schema.sql no SQL Editor'}
                  </p>
                </div>
              </div>

              {/* Mensagem de Erro ou Alerta se houver */}
              {diagnosticReport?.error && (
                <Alert type="error" title="Atenção no Diagnóstico">
                  {diagnosticReport.error}
                </Alert>
              )}

              {/* Feedback de Sincronização */}
              {seedMessage && (
                <Alert type={seedMessage.type === 'success' ? 'success' : 'error'} title="Sincronização">
                  {seedMessage.text}
                </Alert>
              )}

              {/* Checklist de Tabelas */}
              {diagnosticReport?.tables && diagnosticReport.tables.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-indigo-600" />
                      Status Individual das Tabelas no Supabase:
                    </h4>
                    {diagnosticReport.schemaReady && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSeedData}
                        disabled={isSeedingData}
                        leftIcon={<Zap className="w-3 h-3 text-amber-500" />}
                      >
                        {isSeedingData ? 'Sincronizando...' : 'Popular Dados Iniciais no Supabase'}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {diagnosticReport.tables.map((t) => (
                      <div
                        key={t.table}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                          t.status === 'ok'
                            ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                            : t.status === 'empty'
                            ? 'bg-sky-50/50 border-sky-200 text-sky-950'
                            : t.status === 'missing'
                            ? 'bg-amber-50/50 border-amber-200 text-amber-950'
                            : 'bg-rose-50/50 border-rose-200 text-rose-950'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-[11px] truncate">{t.table}</p>
                          <p className="text-[10px] opacity-80 truncate">{t.message || t.status}</p>
                        </div>
                        <Badge
                          variant={
                            t.status === 'ok'
                              ? 'success'
                              : t.status === 'empty'
                              ? 'info'
                              : t.status === 'missing'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {t.status === 'ok'
                            ? 'Pronta'
                            : t.status === 'empty'
                            ? 'Criada'
                            : t.status === 'missing'
                            ? 'Pendente'
                            : 'Erro'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Informações sobre o Schema SQL e Storage Buckets */}
              <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-slate-400 border-b border-slate-800 pb-2.5 gap-2">
                  <div>
                    <span className="text-white font-semibold flex items-center gap-1.5 font-sans text-xs">
                      <Database className="w-3.5 h-3.5 text-indigo-400" />
                      Script SQL Oficial da Etapa 2 (13 Tabelas, RLS, Storage & Triggers)
                    </span>
                    <span className="text-slate-400 text-[11px] font-sans">
                      supabase/migrations/20260901000001_initial_schema.sql
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(SUPABASE_STAGE_2_SQL);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 3000);
                      } catch (e) {
                        console.error('Falha ao copiar:', e);
                      }
                    }}
                    leftIcon={copiedSql ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedSql ? 'Copiado para a Área de Transferência!' : 'Copiar Script SQL Completo'}
                  </Button>
                </div>

                <p className="text-slate-400 leading-relaxed font-sans text-xs">
                  Para aplicar a estrutura no banco, abra o <strong className="text-white font-semibold">SQL Editor</strong> no painel do seu projeto Supabase, clique em <strong className="text-indigo-300 font-semibold">"New query"</strong>, cole o script copiado e clique em <strong className="text-emerald-400 font-semibold">"Run"</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-sans text-[11px]">
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                    <p className="font-semibold text-indigo-300">📦 condominium_documents</p>
                    <p className="text-slate-400 text-[10px]">PDFs, convenções e relatórios fiscais</p>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                    <p className="font-semibold text-amber-300">📦 maintenance_attachments</p>
                    <p className="text-slate-400 text-[10px]">Fotos e laudos de chamados</p>
                  </div>
                  <div className="p-2 rounded bg-slate-800/80 border border-slate-700/60">
                    <p className="font-semibold text-emerald-300">📦 assembly_minutes</p>
                    <p className="text-slate-400 text-[10px]">Atas assinadas e convocações</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal Adicionar Usuário */}
      <Modal
        id="modal-add-user"
        isOpen={isAddUserModalOpen}
        onClose={() => {
          if (!isSubmittingUser) {
            setIsAddUserModalOpen(false);
            setAddUserError('');
          }
        }}
        title="Adicionar usuário"
        description="Cadastre o acesso do morador informando a unidade e o responsável."
        maxWidth="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 w-full">
            <Button
              id="btn-modal-cancel"
              type="button"
              variant="outline"
              size="md"
              disabled={isSubmittingUser}
              className="w-full sm:w-auto"
              onClick={() => {
                setIsAddUserModalOpen(false);
                setAddUserError('');
              }}
            >
              Cancelar
            </Button>
            <Button
              id="btn-modal-submit"
              type="submit"
              form="form-add-user"
              variant="primary"
              size="md"
              disabled={isSubmittingUser}
              className="w-full sm:w-auto"
            >
              {isSubmittingUser ? 'Criando usuário...' : 'Criar usuário'}
            </Button>
          </div>
        }
      >
        <form id="form-add-user" onSubmit={handleCreateMoradorSubmit} className="space-y-4">
          {addUserError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{addUserError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Apartamento / Unidade
            </label>
            <input
              id="input-modal-unit-number"
              type="text"
              required
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Ex: 101"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Responsável
            </label>
            <input
              id="input-modal-responsible-name"
              type="text"
              required
              value={responsibleName}
              onChange={(e) => setResponsibleName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-xs font-semibold text-slate-600 block">Senha inicial:</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-800 bg-white px-2.5 py-1 border border-slate-200 rounded-md shadow-xs">
                000000
              </span>
              <span className="text-[11px] text-slate-500">
                (Essa senha não é editável)
              </span>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal Feedback de Sucesso */}
      {createdUserSuccess && (
        <Modal
          id="modal-user-created-success"
          isOpen={true}
          onClose={() => setCreatedUserSuccess(null)}
          title="Usuário criado com sucesso."
          maxWidth="md"
          footer={
            <Button
              id="btn-close-success-modal"
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              onClick={() => setCreatedUserSuccess(null)}
            >
              Fechar
            </Button>
          }
        >
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-950">Acesso criado com sucesso!</p>
                <p className="text-xs text-emerald-800 mt-0.5">
                  Informe os dados de acesso abaixo para o morador realizar o primeiro acesso ao sistema.
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 font-medium text-slate-700">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Apartamento:</span>
                <span className="font-bold text-slate-900">{createdUserSuccess.unitNumber}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Responsável:</span>
                <span className="font-bold text-slate-900">{createdUserSuccess.responsibleName}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-200">
                <span className="text-slate-500">Senha inicial:</span>
                <span className="font-mono font-bold text-indigo-700 text-sm bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {createdUserSuccess.initialPassword}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              No primeiro acesso com a senha <strong>000000</strong>, o morador será direcionado obrigatoriamente para cadastrar sua senha pessoal definitiva de 6 números.
            </p>
          </div>
        </Modal>
      )}

      {/* Modal Editar Usuário */}
      <Modal
        id="modal-edit-user"
        isOpen={isEditUserModalOpen}
        onClose={() => {
          if (!isSubmittingEdit) {
            setIsEditUserModalOpen(false);
            setEditUserError('');
          }
        }}
        title="Editar usuário"
        description="Altere a unidade ou o nome do responsável deste morador."
        maxWidth="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 w-full">
            <Button
              id="btn-modal-edit-cancel"
              type="button"
              variant="outline"
              size="md"
              disabled={isSubmittingEdit}
              className="w-full sm:w-auto"
              onClick={() => {
                setIsEditUserModalOpen(false);
                setEditUserError('');
              }}
            >
              Cancelar
            </Button>
            <Button
              id="btn-modal-edit-submit"
              type="submit"
              form="form-edit-user"
              variant="primary"
              size="md"
              disabled={isSubmittingEdit}
              className="w-full sm:w-auto"
            >
              {isSubmittingEdit ? 'Salvando alterações...' : 'Salvar alterações'}
            </Button>
          </div>
        }
      >
        <form id="form-edit-user" onSubmit={handleUpdateUserSubmit} className="space-y-4">
          {editUserError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{editUserError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Apartamento / Unidade
            </label>
            <input
              id="input-modal-edit-unit-number"
              type="text"
              required
              value={editUnitNumber}
              onChange={(e) => setEditUnitNumber(e.target.value)}
              placeholder="Ex: 101"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Responsável
            </label>
            <input
              id="input-modal-edit-responsible-name"
              type="text"
              required
              value={editResponsibleName}
              onChange={(e) => setEditResponsibleName(e.target.value)}
              placeholder="Ex: João da Silva"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {editingUser?.email && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-xs text-slate-500 block">Identificador de login:</span>
              <span className="font-mono text-xs font-medium text-slate-700 break-all">{editingUser.email}</span>
            </div>
          )}
        </form>
      </Modal>

      {/* Modal Excluir Usuário */}
      <Modal
        id="modal-delete-user"
        isOpen={isDeleteUserModalOpen}
        onClose={() => {
          if (!isSubmittingDelete) {
            setIsDeleteUserModalOpen(false);
            setDeleteUserError('');
          }
        }}
        title="Excluir usuário?"
        description="Tem certeza que deseja excluir o acesso deste morador? O usuário perderá o acesso ao sistema."
        maxWidth="md"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 w-full">
            <Button
              id="btn-modal-delete-cancel"
              type="button"
              variant="outline"
              size="md"
              disabled={isSubmittingDelete}
              className="w-full sm:w-auto"
              onClick={() => {
                setIsDeleteUserModalOpen(false);
                setDeleteUserError('');
              }}
            >
              Cancelar
            </Button>
            <Button
              id="btn-modal-delete-confirm"
              type="button"
              variant="danger"
              size="md"
              disabled={isSubmittingDelete}
              className="w-full sm:w-auto"
              onClick={handleConfirmDelete}
            >
              {isSubmittingDelete ? 'Excluindo...' : 'Excluir usuário'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {deleteUserError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{deleteUserError}</span>
            </div>
          )}

          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-900 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Confirmação de exclusão</span>
            </div>
            <div className="text-xs text-rose-800 space-y-1">
              <div><strong>Apartamento:</strong> {deletingUser?.unidadeNumero ? `Ap. ${deletingUser.unidadeNumero}` : 'Geral'}</div>
              <div><strong>Responsável:</strong> {deletingUser?.nome}</div>
            </div>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Esta ação desativa as credenciais de acesso do morador. O histórico de lançamentos, documentos e registros do condomínio permanece preservado com total integridade.
          </p>
        </div>
      </Modal>
    </div>
  );
};
