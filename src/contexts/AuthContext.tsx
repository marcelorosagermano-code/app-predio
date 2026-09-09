import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
import { UserProfile, Condominio } from '../types';

const defaultEmptyCondominio: Condominio = {
  id: '',
  nome: 'Condomínio',
  endereco: '',
  cidade: '',
  estado: '',
  totalUnidades: 0,
  sindicoNome: '',
  telefoneContato: '',
  emailContato: '',
};

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
  // Legado mantido para compatibilidade estrita de interface sem dados mock
  switchProfile: (profileId: string) => void;
  availableDemoUsers: UserProfile[];
  legacyUser: UserProfile | null;
  legacyCondominio: Condominio;
  condominio: Condominio;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('LOADING');
  const [user, setUser] = useState<AuthUserProfile | null>(null);
  const [condominium, setCondominium] = useState<AuthCondominium | null>(null);
  const [permissions, setPermissions] = useState<PermissionId[]>([]);
  const [legacyUser, setLegacyUser] = useState<UserProfile | null>(null);
  const [legacyCondominio, setLegacyCondominio] = useState<Condominio>(defaultEmptyCondominio);
  const currentUserRef = useRef<AuthUserProfile | null>(null);

  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  /**
   * Constrói o estado completo a partir do ID do usuário autenticado no Supabase
   */
  const loadUserData = useCallback(async (userId: string, userEmail?: string, explicitToken?: string) => {
    try {
      const profile = await authService.getProfile(userId, explicitToken);

      if (!profile) {
        // Se for o administrador principal, aplicar fallback imediato sem travar na tela de profile_missing
        if (userEmail === 'marcelorosa.germano@gmail.com') {
          const adminProfile: AuthUserProfile = {
            id: userId,
            email: userEmail,
            fullName: 'Marcelo Rosa Germano',
            phone: null,
            avatarUrl: null,
            role: 'admin',
            condominiumId: '37893a96-91f5-4d99-93fd-aba6a9964d10',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          setUser(adminProfile);
          setLegacyUser({
            id: adminProfile.id,
            email: adminProfile.email,
            nome: adminProfile.fullName,
            role: 'admin',
            cargo: 'Administrador',
            condominioId: adminProfile.condominiumId || '',
            ativo: true,
            criadoEm: adminProfile.createdAt,
          });
          const rolePerms = await authService.getPermissionsForRole('admin');
          setPermissions(rolePerms);
          setStatus('READY');
          return;
        }

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

      // Validar vinculação com condomínio e tentar auto-cura via vínculo real em unit_residents
      if (!profile.condominiumId && isSupabaseConfigured && supabase) {
        try {
          // 1. Tentar obter condomínio real da unidade associada em unit_residents
          const { data: residentRow } = await supabase
            .from('unit_residents')
            .select('unit_id, units(condominium_id)')
            .eq('profile_id', profile.id)
            .limit(1)
            .maybeSingle();

          const unitCondoId = (residentRow?.units as any)?.condominium_id;
          if (unitCondoId) {
            profile.condominiumId = unitCondoId;
            await supabase
              .from('profiles')
              .update({ condominium_id: unitCondoId })
              .eq('id', profile.id);
          } else {
            // 2. Fallback caso não seja morador com unidade (ex: admin na inicialização)
            const { data: condoList } = await supabase
              .from('condominiums')
              .select('id')
              .order('created_at', { ascending: true })
              .limit(1);

            if (condoList && condoList.length > 0 && condoList[0]?.id) {
              const foundCondoId = condoList[0].id;
              profile.condominiumId = foundCondoId;
              await supabase
                .from('profiles')
                .update({ condominium_id: foundCondoId })
                .eq('id', profile.id);
            }
          }
        } catch (healCondoErr) {
          console.warn('Tentativa de auto-cura de condomínio pendente:', healCondoErr);
        }
      }

      // Se ainda não houver nenhum condomínio no sistema, exibir tela de onboarding/sem condomínio
      if (!profile.condominiumId) {
        setStatus('NO_CONDOMINIUM');
        return;
      }

      // Sincronizar estado do usuário com o condomínio validado
      setUser((prev) => (prev ? { ...prev, condominioId: profile.condominiumId || '' } : prev));

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
          const session = await authService.getValidSession();
          if (session?.user && isMounted) {
            await loadUserData(session.user.id, session.user.email, session.access_token);
            return;
          }
        } catch (err) {
          console.error('Erro ao verificar sessão Supabase:', err);
        }
      }

      // Se não há sessão Supabase, definir como não autenticado
      if (isMounted) {
        setStatus('UNAUTHENTICATED');
      }
    }

    initSession();

    // Renovação proativa de sessão periódica (a cada 4 minutos) para evitar expiração silenciosa
    const refreshInterval = setInterval(async () => {
      if (isSupabaseConfigured && supabase && document.visibilityState === 'visible') {
        try {
          await authService.getValidSession();
        } catch {}
      }
    }, 4 * 60 * 1000);

    const onVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isSupabaseConfigured && supabase) {
        try {
          await authService.getValidSession();
        } catch {}
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Registrar Listener de Mudança de Estado de Autenticação
    if (isSupabaseConfigured && supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (session?.user) {
            // Se o usuário logado atualmente for administrador e receber evento de outro ID (ex: usuário morador criado), não deslogar o admin
            if (
              currentUserRef.current &&
              currentUserRef.current.id !== session.user.id &&
              currentUserRef.current.role === 'admin'
            ) {
              console.warn('Proteção de sessão: ignorando evento para usuário secundário:', session.user.id);
              return;
            }
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
        clearInterval(refreshInterval);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        authListener.subscription.unsubscribe();
      };
    }

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [loadUserData]);

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
            const roleCargoMap: Record<string, string> = {
              admin: 'Administrador',
              sindico: 'Síndico',
              conselho: 'Conselheiro',
              morador: 'Morador',
            };
            setUser(data.profile);
            setLegacyUser({
              id: data.profile.id,
              email: data.profile.email,
              nome: data.profile.fullName,
              role: data.profile.role,
              cargo: roleCargoMap[data.profile.role] || 'Morador',
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
      setUser(null);
      setCondominium(null);
      setPermissions([]);
      setLegacyUser(null);
      setLegacyCondominio(defaultEmptyCondominio);
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
   * Troca de usuário mantida para compatibilidade
   */
  const switchProfile = (_profileId: string) => {
    // Modo estrito Supabase: alternância de perfis ocorre exclusivamente via autenticação real
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
        availableDemoUsers: [],
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
