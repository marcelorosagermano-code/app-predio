import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase/client';
import { authService } from '../services/supabase/authService';
import { onboardingService } from '../services/supabase/onboardingService';
import { UserRole } from '../types/database';
import {
  AuthStatus,
  AuthUserProfile,
  AuthCondominium,
  PermissionId,
  OnboardingPayload,
} from '../types/auth';
import { mockCondominio, mockUsuarios } from '../services/mockData';
import { UserProfile, Condominio } from '../types';

interface AuthContextType {
  status: AuthStatus;
  user: AuthUserProfile | null;
  condominium: AuthCondominium | null;
  role: UserRole | null;
  permissions: PermissionId[];
  isAuthenticated: boolean;
  isLoading: boolean;
  isReady: boolean;
  isAdmin: boolean;
  isSindico: boolean;
  isCouncil: boolean;
  isMorador: boolean;
  hasPermission: (permission: PermissionId | string) => boolean;
  can: (permission: PermissionId | string) => boolean;
  temPermissao: (permission: PermissionId | string) => boolean;
  pode: (permission: PermissionId | string) => boolean;
  login: (identifier: string, password?: string) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  loginMorador: (unitNumber: string, password: string, block?: string) => Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }>;
  completeFirstAccess: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  refreshSession: () => Promise<void>;
  completeOnboarding: (data: OnboardingPayload) => Promise<{ success: boolean; error?: string }>;
  // Legado e suporte a testes rápidos locais
  switchProfile: (profileId: string) => void;
  availableDemoUsers: UserProfile[];
  legacyUser: UserProfile | null;
  legacyCondominio: Condominio;
  condominio: Condominio;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const STORAGE_KEY_USER_ID = 'gestao_condominial_user_id';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('LOADING');
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [condominium, setCondominium] = useState<AuthCondominium | null>(null);
  const [permissions, setPermissions] = useState<PermissionId[]>([]);
  const [legacyUser, setLegacyUser] = useState<UserProfile | null>(null);
  const [legacyCondominio, setLegacyCondominio] = useState<Condominio>(mockCondominio);

  /**
   * Constrói o estado completo a partir do ID do usuário autenticado no Supabase
   */
  const loadUserData = useCallback(async (userId: string, userEmail?: string, explicitToken?: string) => {
    try {
      const profile = await authService.getProfile(userId, explicitToken);

      if (!profile) {
        // Usuário em auth.users mas sem registro em profiles
        setUser({
          id: userId,
          email: userEmail || '',
          fullName: userEmail ? userEmail.split('@')[0] : 'Usuário',
          phone: null,
          avatarUrl: null,
          role: 'morador',
          condominiumId: null,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setStatus('PROFILE_MISSING');
        return;
      }

      setUser(profile);

      // Sincronizar objeto legacy para manter compatibilidade com componentes visuais
      setLegacyUser({
        id: profile.id,
        email: profile.email,
        nome: profile.fullName,
        role: profile.role,
        cargo: profile.role === 'admin' ? 'Administrador' : profile.role === 'sindico' ? 'Síndico' : profile.role === 'conselho' ? 'Conselho Fiscal' : 'Morador',
        telefone: profile.phone || undefined,
        condominioId: profile.condominiumId || '',
        unidadeId: profile.unitId || undefined,
        unidadeNumero: profile.unitNumber || undefined,
        ativo: profile.isActive,
        criadoEm: profile.createdAt,
      });

      // Validar status de ativação da conta
      if (!profile.isActive) {
        setStatus('INACTIVE');
        return;
      }

      // Validar vinculação com condomínio
      if (!profile.condominiumId) {
        setStatus('NO_CONDOMINIUM');
        return;
      }

      // Carregar condomínio e permissões do Role
      const [condoData, rolePerms] = await Promise.all([
        authService.getCondominium(profile.condominiumId),
        authService.getPermissionsForRole(profile.role),
      ]);

      if (condoData) {
        setCondominium(condoData);
        setLegacyCondominio({
          id: condoData.id,
          nome: condoData.name,
          cnpj: condoData.document || undefined,
          endereco: condoData.address,
          cidade: condoData.city,
          estado: condoData.state,
          cep: condoData.zipCode || undefined,
          totalUnidades: condoData.totalUnits,
          sindicoNome: profile.fullName,
          telefoneContato: condoData.phone || '',
          emailContato: condoData.email || '',
        });
      }

      setPermissions(rolePerms);

      // Se for morador com primeiro acesso pendente
      if (profile.role === 'morador' && profile.mustChangePassword) {
        setStatus('FIRST_ACCESS');
        return;
      }

      setStatus('READY');
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      setUser((current) => {
        if (!current) {
          setStatus('UNAUTHENTICATED');
        }
        return current;
      });
    }
  }, []);

  /**
   * Inicialização e listener de sessão do Supabase Auth
   */
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            await loadUserData(session.user.id, session.user.email, session.access_token);
            return;
          }
        } catch (err) {
          console.error('Erro ao verificar sessão Supabase:', err);
        }
      }

      // Se não há sessão Supabase, checar fallback de demonstração local
      if (isMounted) {
        const savedUserId = localStorage.getItem(STORAGE_KEY_USER_ID);
        if (savedUserId) {
          const found = mockUsuarios.find((u) => u.id === savedUserId);
          if (found) {
            setupMockUser(found);
            return;
          }
        }
        setStatus('UNAUTHENTICATED');
      }
    }

    initSession();

    // Registrar Listener de Mudança de Estado de Autenticação
    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            await loadUserData(session.user.id, session.user.email, session.access_token);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setCondominium(null);
          setPermissions([]);
          setLegacyUser(null);
          setStatus('UNAUTHENTICATED');
        } else if (event === 'PASSWORD_RECOVERY') {
          setStatus('AUTHENTICATED');
        }
      });

      return () => {
        isMounted = false;
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
    };
  }, [loadUserData]);

  /**
   * Configuração de usuário mock para ambiente local/demo
   */
  const setupMockUser = (mockUser: UserProfile) => {
    setLegacyUser(mockUser);
    const mockRole = mockUser.role;
    setUser({
      id: mockUser.id,
      email: mockUser.email,
      fullName: mockUser.nome,
      phone: mockUser.telefone || null,
      avatarUrl: mockUser.avatarUrl || null,
      role: mockRole,
      condominiumId: mockUser.condominioId,
      unitId: mockUser.unidadeId || null,
      unitNumber: mockUser.unidadeNumero || null,
      isActive: mockUser.ativo,
      createdAt: mockUser.criadoEm,
      updatedAt: mockUser.criadoEm,
    });
    setCondominium({
      id: mockCondominio.id,
      name: mockCondominio.nome,
      document: mockCondominio.cnpj || null,
      address: mockCondominio.endereco,
      city: mockCondominio.cidade,
      state: mockCondominio.estado,
      zipCode: mockCondominio.cep || null,
      phone: mockCondominio.telefoneContato,
      email: mockCondominio.emailContato,
      totalUnits: mockCondominio.totalUnidades,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setPermissions(
      mockRole === 'admin'
        ? [
            'dashboard:view',
            'units:view', 'units:create', 'units:update', 'units:delete',
            'financial:view_all', 'financial:view_own', 'financial:create', 'financial:update', 'financial:delete',
            'maintenance:view_all', 'maintenance:view_own', 'maintenance:create', 'maintenance:update', 'maintenance:delete',
            'announcements:view', 'announcements:create', 'announcements:update', 'announcements:delete',
            'documents:view_public', 'documents:view_admin', 'documents:create', 'documents:delete',
            'assemblies:view', 'assemblies:create', 'assemblies:update', 'assemblies:delete',
            'settings:view', 'settings:update',
          ]
        : [
            'units:view',
            'financial:view_own',
            'maintenance:view_own', 'maintenance:create',
            'announcements:view',
            'documents:view_public',
            'assemblies:view',
          ]
    );
    setStatus('READY');
  };

  /**
   * Login unificado no sistema (Apartamento ou E-mail)
   */
  const login = async (
    identifier: string,
    password?: string
  ): Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }> => {
    try {
      const cleanIdentifier = identifier.trim();
      if (!cleanIdentifier || !password) {
        return { success: false, error: 'Informe seu apartamento ou e-mail e a senha.' };
      }

      if (isSupabaseConfigured && supabase) {
        if (cleanIdentifier.includes('@')) {
          // Autenticação com E-mail via Supabase Auth diretamente (qualquer role ou email cadastrado)
          const { data, error } = await authService.signIn(cleanIdentifier, password);

          if (!error && data?.user) {
            await loadUserData(data.user.id, data.user.email, data.session?.access_token);
            return { success: true };
          }
        }

        // Autenticação de Morador (Unidade, Prefixo 'Ap', Nome) com fallback direto
        const { data, error } = await authService.signInMorador(cleanIdentifier, password);

          if (error || !data) {
            setStatus('UNAUTHENTICATED');
            return { success: false, error: error?.message || 'Credenciais inválidas. Verifique os dados informados.' };
          }

          // Se a API retornou o perfil completo, configurar imediatamente no estado
          if (data.profile) {
            setUser(data.profile);
            setLegacyUser({
              id: data.profile.id,
              email: data.profile.email,
              nome: data.profile.fullName,
              role: data.profile.role,
              cargo: 'Morador',
              telefone: data.profile.phone || undefined,
              condominioId: data.profile.condominiumId || '',
              unidadeId: data.profile.unitId || undefined,
              unidadeNumero: data.profile.unitNumber || undefined,
              ativo: data.profile.isActive,
              criadoEm: data.profile.createdAt,
            });
          }

          if (data.condominium) {
            setCondominium(data.condominium);
            setLegacyCondominio({
              id: data.condominium.id,
              nome: data.condominium.name,
              cnpj: data.condominium.document || undefined,
              endereco: data.condominium.address,
              cidade: data.condominium.city,
              estado: data.condominium.state,
              cep: data.condominium.zipCode || undefined,
              totalUnidades: data.condominium.totalUnits,
              sindicoNome: data.profile?.fullName || 'Administração',
              telefoneContato: data.condominium.phone || '',
              emailContato: data.condominium.email || '',
            });
          }

          if (data.permissions) {
            setPermissions(data.permissions);
          }

          if (data.mustChangePassword || data.profile?.mustChangePassword || password === '000000') {
            setStatus('FIRST_ACCESS');
            return { success: true, mustChangePassword: true };
          }

          setStatus('READY');
          return { success: true, mustChangePassword: false };
      }

      // Se o Supabase não estiver configurado no ambiente atual (ex: deploy na Vercel sem env vars)
      if (!isSupabaseConfigured) {
        setStatus('UNAUTHENTICATED');
        return {
          success: false,
          error: 'Banco de dados não configurado neste ambiente. Certifique-se de adicionar as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no painel da Vercel (Project Settings > Environment Variables).',
        };
      }

      setStatus('UNAUTHENTICATED');
      return { success: false, error: 'Apartamento ou credenciais não localizados no sistema.' };
    } catch (err: any) {
      setStatus('UNAUTHENTICATED');
      return { success: false, error: err?.message || 'Erro inesperado durante o login.' };
    }
  };

  /**
   * Login do Morador via Apartamento + Senha (compatibilidade)
   */
  const loginMorador = async (
    unitNumber: string,
    password: string,
    block?: string
  ): Promise<{ success: boolean; error?: string; mustChangePassword?: boolean }> => {
    return login(unitNumber, password);
  };

  /**
   * Conclusão do Primeiro Acesso com Nova Senha
   */
  const completeFirstAccess = async (newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (newPassword === '000000') {
        return { success: false, error: 'A nova senha não pode ser a senha padrão 000000.' };
      }

      if (isSupabaseConfigured) {
        const result = await authService.completeFirstAccess(newPassword);
        if (!result.success) {
          return { success: false, error: result.error || 'Falha ao redefinir a senha.' };
        }
      }

      if (user) {
        setUser({ ...user, mustChangePassword: false });
      }

      setStatus('READY');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Erro ao processar alteração de senha.' };
    }
  };

  /**
   * Cadastro de nova conta no Supabase Auth
   */
  const signup = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; error?: string }> => {
    setStatus('LOADING');
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await authService.signUp(email, password, fullName);

        if (error) {
          setStatus('UNAUTHENTICATED');
          return { success: false, error: error.message };
        }

        if (data.user) {
          await loadUserData(data.user.id, data.user.email);
          return { success: true };
        }
      }

      setStatus('UNAUTHENTICATED');
      return { success: false, error: 'Configuração do Supabase necessária para cadastro.' };
    } catch (err: any) {
      setStatus('UNAUTHENTICATED');
      return { success: false, error: err?.message || 'Erro ao realizar cadastro.' };
    }
  };

  /**
   * Logout do sistema
   */
  const logout = async (): Promise<void> => {
    setStatus('LOADING');
    try {
      if (isSupabaseConfigured && supabase) {
        await authService.signOut();
      }
      localStorage.removeItem(STORAGE_KEY_USER_ID);
      setUser(null);
      setCondominium(null);
      setPermissions([]);
      setLegacyUser(null);
      setStatus('UNAUTHENTICATED');
    } catch (err) {
      console.error('Erro ao deslogar:', err);
      setStatus('UNAUTHENTICATED');
    }
  };

  /**
   * Recuperação de senha
   */
  const requestPasswordReset = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await authService.requestPasswordReset(email);
        if (error) return { success: false, error: error.message };
        return { success: true };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao solicitar recuperação de senha.' };
    }
  };

  /**
   * Atualização de nova senha
   */
  const updatePassword = async (password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await authService.updatePassword(password);
        if (error) return { success: false, error: error.message };
        return { success: true };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao redefinir a senha.' };
    }
  };

  /**
   * Recarrega a sessão e os dados do usuário atual
   */
  const refreshSession = async (): Promise<void> => {
    if (user?.id) {
      await loadUserData(user.id, user.email);
    }
  };

  /**
   * Onboarding administrativo seguro
   */
  const completeOnboarding = async (
    payload: OnboardingPayload
  ): Promise<{ success: boolean; error?: string }> => {
    setStatus('LOADING');
    try {
      const result = await onboardingService.executeOnboarding(payload);
      if (!result.success || !result.condominium || !result.profile) {
        setStatus('NO_CONDOMINIUM');
        return { success: false, error: result.error || 'Falha ao concluir onboarding.' };
      }

      // Revalidar o perfil oficial persistido no PostgreSQL
      const persistedProfile = await authService.getProfile(result.profile.id);
      const activeProfile = persistedProfile || result.profile;

      setCondominium(result.condominium);
      setUser(activeProfile);

      const perms = await authService.getPermissionsForRole(activeProfile.role);
      setPermissions(perms);

      setLegacyUser({
        id: activeProfile.id,
        email: activeProfile.email,
        nome: activeProfile.fullName,
        role: activeProfile.role,
        cargo: 'Administrador',
        condominioId: result.condominium.id,
        ativo: true,
        criadoEm: activeProfile.createdAt,
      });

      setLegacyCondominio({
        id: result.condominium.id,
        nome: result.condominium.name,
        cnpj: result.condominium.document || undefined,
        endereco: result.condominium.address,
        cidade: result.condominium.city,
        estado: result.condominium.state,
        cep: result.condominium.zipCode || undefined,
        totalUnidades: result.condominium.totalUnits,
        sindicoNome: activeProfile.fullName,
        telefoneContato: result.condominium.phone || '',
        emailContato: result.condominium.email || '',
      });

      setStatus('READY');
      return { success: true };
    } catch (err: any) {
      setStatus('NO_CONDOMINIUM');
      return { success: false, error: err?.message || 'Erro inesperado no onboarding.' };
    }
  };

  /**
   * Troca de usuário para demonstração local
   */
  const switchProfile = (profileId: string) => {
    const target = mockUsuarios.find((u) => u.id === profileId);
    if (target) {
      setupMockUser(target);
      localStorage.setItem(STORAGE_KEY_USER_ID, target.id);
    }
  };

  /**
   * Validação de permissões granulares
   */
  const hasPermission = (permission: PermissionId | string): boolean => {
    if (!user) return false;
    if (user.role === 'admin' || user.role === 'sindico') return true;
    return permissions.includes(permission as PermissionId);
  };

  const isAdmin = user?.role === 'admin' || user?.role === 'sindico';
  const isSindico = user?.role === 'sindico';
  const isCouncil = user?.role === 'conselho';
  const isMorador = user?.role === 'morador';

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        condominium,
        role: user?.role || null,
        permissions,
        isAuthenticated: status !== 'LOADING' && status !== 'UNAUTHENTICATED' && user !== null,
        isLoading: status === 'LOADING',
        isReady: status === 'READY',
        isAdmin,
        isSindico,
        isCouncil,
        isMorador,
        hasPermission,
        can: hasPermission,
        temPermissao: hasPermission,
        pode: hasPermission,
        login,
        loginMorador,
        completeFirstAccess,
        signup,
        logout,
        requestPasswordReset,
        updatePassword,
        refreshSession,
        completeOnboarding,
        switchProfile,
        availableDemoUsers: mockUsuarios,
        legacyUser,
        legacyCondominio,
        condominio: legacyCondominio,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider');
  }
  return context;
};
