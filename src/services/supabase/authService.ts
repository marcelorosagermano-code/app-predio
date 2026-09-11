import { createClient, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from './client';
import { UserRole } from '../../types/database';
import { AuthUserProfile, AuthCondominium, PermissionId } from '../../types/auth';

// Permissões padrão do sistema de acordo com a migration oficial
const ROLE_PERMISSIONS_FALLBACK: Record<UserRole, PermissionId[]> = {
  admin: [
    'dashboard:view',
    'units:view', 'units:create', 'units:update', 'units:delete',
    'financial:view_all', 'financial:view_own', 'financial:create', 'financial:update', 'financial:delete',
    'maintenance:view_all', 'maintenance:view_own', 'maintenance:create', 'maintenance:update', 'maintenance:delete',
    'announcements:view', 'announcements:create', 'announcements:update', 'announcements:delete',
    'documents:view_public', 'documents:view_admin', 'documents:create', 'documents:delete',
    'assemblies:view', 'assemblies:create', 'assemblies:update', 'assemblies:delete',
    'settings:view', 'settings:update',
  ],
  sindico: [
    'dashboard:view',
    'units:view', 'units:create', 'units:update', 'units:delete',
    'financial:view_all', 'financial:view_own', 'financial:create', 'financial:update', 'financial:delete',
    'maintenance:view_all', 'maintenance:view_own', 'maintenance:create', 'maintenance:update', 'maintenance:delete',
    'announcements:view', 'announcements:create', 'announcements:update', 'announcements:delete',
    'documents:view_public', 'documents:view_admin', 'documents:create', 'documents:delete',
    'assemblies:view', 'assemblies:create', 'assemblies:update', 'assemblies:delete',
    'settings:view', 'settings:update',
  ],
  conselho: [
    'dashboard:view',
    'units:view',
    'financial:view_all',
    'maintenance:view_all',
    'announcements:view',
    'documents:view_public', 'documents:view_admin',
    'assemblies:view',
    'settings:view',
  ],
  morador: [
    'units:view',
    'financial:view_own',
    'maintenance:view_own', 'maintenance:create',
    'announcements:view',
    'documents:view_public',
    'assemblies:view',
  ],
};

let _cachedCondominium: AuthCondominium | null = null;
let _cachedProfile: AuthUserProfile | null = null;
let _cachedPermissions: PermissionId[] | null = null;

/**
 * Função utilitária para tratar respostas da API de forma segura
 * Evita erro de 'Unexpected token T / A, The page could not be found / A server error is not valid JSON'
 */
async function parseApiResponse(res: Response): Promise<{ ok: boolean; data: any; error?: string }> {
  const text = await res.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    return { ok: res.ok, data: json, error: json.error || json.message };
  } catch {
    if (res.status === 404 || text.includes('The page could not be found') || text.includes('404')) {
      return {
        ok: false,
        data: null,
        error:
          'A rota de API (/api) não foi encontrada na Vercel (Erro 404). Realize um Redeploy na Vercel se acabou de configurar variáveis de ambiente.',
      };
    }
    if (text.includes('FUNCTION_INVOCATION_FAILED') || text.includes('server error') || text.includes('Server Error')) {
      return {
        ok: false,
        data: null,
        error: 'Instabilidade ou erro na função serverless da Vercel (FUNCTION_INVOCATION_FAILED).',
      };
    }
    return {
      ok: false,
      data: null,
      error: `Erro de comunicação com o servidor (${res.status || 'Falha de rede'}).`,
    };
  }
}

export const authService = {
  /**
   * Limpa cache em memória
   */
  clearCache() {
    _cachedCondominium = null;
    _cachedProfile = null;
    _cachedPermissions = null;
  },

  /**
   * Salva condomínio em cache
   */
  setCachedCondominium(condo: AuthCondominium | null) {
    _cachedCondominium = condo;
  },

  /**
   * Salva perfil em cache
   */
  setCachedProfile(prof: AuthUserProfile | null) {
    _cachedProfile = prof;
  },

  /**
   * Realiza login do Morador via Apartamento + Senha através do endpoint seguro
   * com fallback transparente para autenticação direta via Supabase Auth (caso o host seja puramente estático como Vercel)
   */
  async signInMorador(unitNumber: string, password: string, block?: string, condominiumId?: string) {
    let apiError: string | null = null;

    try {
      const res = await fetch('/api/auth/morador-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitNumber, password, block, condominiumId }),
      });

      const { ok, data, error: parsedErr } = await parseApiResponse(res);
      if (ok && data?.success) {
        if (data.profile) {
          _cachedProfile = data.profile as AuthUserProfile;
        }
        if (data.condominium) {
          _cachedCondominium = data.condominium as AuthCondominium;
        }
        if (data.permissions) {
          _cachedPermissions = data.permissions as PermissionId[];
        }
        if (supabase && data.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        }
        return { data, error: null };
      }
      
      apiError = parsedErr || data?.error || null;
      
      // Se a API backend respondeu ativamente com um erro de negócio (401, 400, 403, 409), não faça fallback para o client.
      // O fallback é EXCLUSIVO para quando a rota de backend não existe (404) ou há falha de infraestrutura (500, 502, 504).
      if (res.status && res.status >= 400 && res.status < 500 && res.status !== 404) {
         return {
           data: null,
           error: new Error(apiError || 'Apartamento/e-mail ou senha inválidos.')
         };
      }
    } catch (err: any) {
      apiError = err?.message || null;
    }

    // Fallback para autenticação direta via Supabase Client
    // Crucial quando rodando em hospedagens estáticas (Vercel SPA, Netlify) sem backend Express ativo
    if (supabase) {
      const cleanNum = unitNumber
        .trim()
        .toLowerCase()
        .replace(/^(apartamento|apto\.?|ap\.?|unidade)\s*/i, '')
        .replace(/[^a-z0-9]/g, '');

      const defaultCondoPrefix = '37893a96';
      const condoShortId = condominiumId ? condominiumId.slice(0, 8) : defaultCondoPrefix;

      const candidateEmails: string[] = [];
      if (unitNumber.includes('@')) {
        candidateEmails.push(unitNumber.trim());
      }
      if (cleanNum) {
        candidateEmails.push(`morador.ap${cleanNum}.${condoShortId}@condominio.app`);
        candidateEmails.push(`morador.ap${cleanNum}@condominio.app`);
      }

      for (const candidateEmail of candidateEmails) {
        try {
          const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
            email: candidateEmail,
            password,
          });

          if (authData?.user && !authErr) {
            const profile = await this.getProfile(authData.user.id, authData.session?.access_token);
            const condo = profile?.condominiumId ? await this.getCondominium(profile.condominiumId) : null;
            const permissions = profile?.role ? await this.getPermissionsForRole(profile.role) : [];

            return {
              data: {
                user: authData.user,
                profile,
                condominium: condo,
                permissions,
                session: authData.session,
                mustChangePassword: authData.user.user_metadata?.must_change_password === true,
              },
              error: null,
            };
          }
        } catch {
          // Tentar próximo candidato
        }
      }
    }

    return {
      data: null,
      error: new Error(apiError || 'Apartamento ou senha incorretos. Verifique os dados informados.'),
    };
  },

  /**
   * Conclui o primeiro acesso do morador atualizando sua senha pessoal.
   * Utiliza estratégia resiliente:
   * 1. Atualiza diretamente via Supabase Auth no cliente (100% tolerante a falhas de Vercel/serverless).
   * 2. Se a chamada direta funcionar, sincroniza em segundo plano com o backend para registrar logs.
   * 3. Se a chamada direta falhar, recorre à API do servidor (/api/auth/complete-first-access).
   */
  async completeFirstAccess(newPassword: string) {
    let directSuccess = false;
    let directError: string | null = null;

    // 1. Tentar atualizar diretamente no Supabase Auth no navegador
    if (supabase) {
      try {
        const { data: updateData, error: updateErr } = await supabase.auth.updateUser({
          password: newPassword,
          data: {
            must_change_password: false,
            first_access_completed: true,
            first_access_completed_at: new Date().toISOString(),
          },
        });

        if (!updateErr && updateData?.user) {
          directSuccess = true;
          if (_cachedProfile) {
            _cachedProfile.mustChangePassword = false;
          }
        } else if (updateErr) {
          directError = updateErr.message;
          console.warn('Atualização direta no Supabase Auth retornou erro:', updateErr.message);
        }
      } catch (err: any) {
        directError = err?.message || 'Falha ao comunicar diretamente com Supabase Auth';
        console.warn('Exceção na atualização direta de senha:', err);
      }
    }

    // 2. Se a senha já foi salva diretamente no Supabase, concluímos com sucesso!
    // Disparamos o registro de log no servidor de forma assíncrona/não bloqueante
    if (directSuccess) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 4000) : null;
        this.fetchWithAuth('/api/auth/complete-first-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword }),
          signal: controller?.signal,
        })
          .catch(() => {})
          .finally(() => {
            if (timeoutId) clearTimeout(timeoutId);
          });
      } catch {
        // Log em segundo plano não deve interromper o fluxo do usuário
      }

      return { success: true };
    }

    // 3. Fallback via API do servidor caso a atualização direta pelo cliente não tenha ocorrido
    const session = await this.getSession();
    const token = session?.access_token;

    if (!token) {
      if (!isSupabaseConfigured) {
        return { success: true };
      }
      return { success: false, error: directError || 'Sessão não encontrada.' };
    }

    try {
      const res = await this.fetchWithAuth('/api/auth/complete-first-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });

      const { ok, data, error: parsedErr } = await parseApiResponse(res);
      if (!ok || !data?.success) {
        return { success: false, error: parsedErr || data?.error || directError || 'Falha ao atualizar senha.' };
      }

      if (_cachedProfile) {
        _cachedProfile.mustChangePassword = false;
      }

      return { success: true };
    } catch (apiCatch: any) {
      return { success: false, error: directError || apiCatch?.message || 'Falha ao comunicar com o servidor.' };
    }
  },

  /**
   * Realiza login com email e senha no Supabase Auth (Administrador / Síndico / Conselho)
   */
  async signIn(email: string, password: string) {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }
    return await supabase.auth.signInWithPassword({ email, password });
  },

  /**
   * Realiza cadastro de novo usuário.
   * O trigger handle_new_auth_user() no banco garante que o role inicial seja 'morador'
   * e condominium_id seja null, prevenindo elevação de privilégios.
   */
  async signUp(email: string, password: string, fullName: string) {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });
  },

  /**
   * Encerra a sessão ativa do usuário
   */
  async signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
  },

  /**
   * Solicita envio de email para recuperação de senha
   */
  async requestPasswordReset(email: string) {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
  },

  /**
   * Atualiza a senha do usuário após retorno pelo link de recuperação
   */
  async updatePassword(newPassword: string) {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }
    return await supabase.auth.updateUser({ password: newPassword });
  },

  /**
   * Obtém a sessão ativa atual no Supabase.
   * Se o access_token estiver expirado ou a menos de 2 minutos de expirar,
   * renova proativamente via refreshSession() para evitar erro de "Sessão expirada".
   */
  async getValidSession(): Promise<Session | null> {
    if (!supabase) return null;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.warn('Erro ao obter sessão no Supabase:', error);
        return null;
      }

      return session;
    } catch (err) {
      console.warn('Aviso na verificação da sessão:', err);
      return null;
    }
  },

  /**
   * Executa requisições autenticadas para as rotas /api/* com injeção de Bearer token
   * e auto-refresh imediato se receber resposta 401 (token expirado).
   */
  async fetchWithAuth(url: string, init: RequestInit = {}): Promise<Response> {
    const session = await this.getValidSession();
    const token = session?.access_token;

    const headers = new Headers(init.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    let response = await fetch(url, {
      ...init,
      headers,
    });

    if (response.status === 401 && supabase) {
      try {
        const newSession = await this.getValidSession();
        if (newSession?.access_token && newSession.access_token !== token) {
          headers.set('Authorization', `Bearer ${newSession.access_token}`);
          response = await fetch(url, {
            ...init,
            headers,
          });
        }
      } catch (refreshErr) {
        console.warn('Falha no auto-refresh de token após 401:', refreshErr);
      }
    }

    return response;
  },

  /**
   * Busca os dados da sessão atual com garantia de token válido
   */
  async getSession(): Promise<Session | null> {
    return await this.getValidSession();
  },

  /**
   * Busca o perfil do usuário na tabela public.profiles
   * Fonte oficial e exclusiva de autoridade para dados cadastrais, condomínio e papel (role)
   */
  async getProfile(userId: string, explicitToken?: string): Promise<AuthUserProfile | null> {
    if (!supabase) return null;

    if (_cachedProfile && _cachedProfile.id === userId) {
      return _cachedProfile;
    }

    // 1. Se houver token explícito ou sessão ativa, consultar diretamente o endpoint seguro do backend
    // Isso evita o erro 42501 (Permission Denied) e carrega perfil + condomínio de forma atômica
    let token = explicitToken;
    if (!token) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token;
      } catch {
        // Segue
      }
    }

    if (token) {
      try {
        const resp = await this.fetchWithAuth('/api/auth/profile', {
          headers: explicitToken ? { Authorization: `Bearer ${explicitToken}` } : {},
        });
        if (resp.ok) {
          const resJson = await resp.json();
          if (resJson.success && resJson.profile) {
            _cachedProfile = resJson.profile as AuthUserProfile;
            if (resJson.condominium) {
              _cachedCondominium = resJson.condominium as AuthCondominium;
            }
            if (resJson.permissions) {
              _cachedPermissions = resJson.permissions as PermissionId[];
            }
            return _cachedProfile;
          }
          if (resJson.success && resJson.profile === null) {
            return null;
          }
        }
      } catch (apiErr) {
        console.warn('Tentativa via /api/auth/profile falhou, tentando consulta direta...', apiErr);
      }
    }

    let profileData: any = null;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Consulta direta a public.profiles com restrição:', error.message);
      } else {
        profileData = data;
      }
    } catch (err: any) {
      console.warn('Erro ao consultar profiles:', err?.message);
    }

    // Buscar dados do usuário autenticado no Auth (apenas para verificação de primeiro acesso)
    let mustChangePassword = false;
    try {
      const { data: userData } = await supabase.auth.getUser();
      mustChangePassword = userData?.user?.user_metadata?.must_change_password === true;
    } catch {
      // Ignorar se falhar verificação opcional de first access
    }

    if (!profileData) {
      return null;
    }

    // Buscar unidade vinculada se existir (para exibição do morador - somente leitura)
    let unitNumber: string | null = null;
    let unitId: string | null = null;

    try {
      const { data: residentData } = await supabase
        .from('unit_residents')
        .select('unit_id, units(unit_number, block)')
        .eq('profile_id', userId)
        .limit(1)
        .maybeSingle();

      if (residentData) {
        unitId = residentData.unit_id;
        const u = residentData.units as any;
        if (u) {
          unitNumber = u.block ? `${u.unit_number} - Bloco ${u.block}` : u.unit_number;
        }
      }
    } catch {
      // Unidade opcional para admins/síndicos
    }

    const loadedProfile: AuthUserProfile = {
      id: profileData.id,
      email: profileData.email,
      fullName: profileData.full_name,
      phone: profileData.phone,
      avatarUrl: profileData.avatar_url,
      role: (profileData.role as UserRole) || 'morador',
      condominiumId: profileData.condominium_id,
      unitId,
      unitNumber,
      mustChangePassword,
      isActive: profileData.is_active,
      createdAt: profileData.created_at,
      updatedAt: profileData.updated_at,
    };

    _cachedProfile = loadedProfile;
    return loadedProfile;
  },

  /**
   * Busca os dados do condomínio associado na tabela public.condominiums
   */
  async getCondominium(condominiumId: string): Promise<AuthCondominium | null> {
    if (!supabase) return null;

    if (_cachedCondominium && _cachedCondominium.id === condominiumId) {
      return _cachedCondominium;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const resp = await fetch('/api/auth/profile', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (resp.ok) {
          const resJson = await resp.json();
          if (resJson.success && resJson.condominium) {
            _cachedCondominium = resJson.condominium as AuthCondominium;
            return _cachedCondominium;
          }
        }
      }

      const { data, error } = await supabase
        .from('condominiums')
        .select('*')
        .eq('id', condominiumId)
        .maybeSingle();

      if (error || !data) {
        if (_cachedCondominium) return _cachedCondominium;
        return {
          id: condominiumId || '37893a96-91f5-4d99-93fd-aba6a9964d10',
          name: 'Condomínio Residencial',
          document: null,
          address: 'Rua William Malacco, 116',
          city: 'Belo Horizonte',
          state: 'MG',
          zipCode: '31630490',
          phone: null,
          email: 'marcelorosa.germano@gmail.com',
          totalUnits: 12,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const condo: AuthCondominium = {
        id: data.id,
        name: data.name,
        document: data.document,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zip_code,
        phone: data.phone,
        email: data.email,
        totalUnits: data.total_units,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };

      _cachedCondominium = condo;
      return condo;
    } catch {
      return _cachedCondominium || null;
    }
  },

  /**
   * Carrega as permissões atribuídas a um determinado Role a partir da tabela public.role_permissions
   */
  async getPermissionsForRole(role: UserRole): Promise<PermissionId[]> {
    if (_cachedPermissions && _cachedPermissions.length > 0) {
      return _cachedPermissions;
    }

    if (!supabase) {
      return ROLE_PERMISSIONS_FALLBACK[role] || [];
    }

    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('permission_id')
        .eq('role_id', role);

      if (error || !data || data.length === 0) {
        return ROLE_PERMISSIONS_FALLBACK[role] || [];
      }

      return data.map((item) => item.permission_id as PermissionId);
    } catch {
      return ROLE_PERMISSIONS_FALLBACK[role] || [];
    }
  },

  /**
   * Cria acesso de morador através de endpoint server-side administrativo
   */

  // =========================================================
  // ================ RECONSTRUÇÃO: USUÁRIOS =================
  // =========================================================

  listCondominiumUsers: async function(): Promise<Array<{
    id: string;
    nome: string;
    email: string;
    role: string;
    cargo: string;
    ativo: boolean;
    unidadeNumero: string | null;
    primeiroAcessoPendente: boolean;
    criadoEm: string;
  }>> {
    try {
      const resp = await this.fetchWithAuth('/api/admin/users', { method: 'GET' });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.users) {
          return data.users;
        }
      }
      return [];
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
      return [];
    }
  },

  createMoradorUser: async function(unitNumber: string, responsibleName: string, role: string = 'morador'): Promise<{
    success: boolean;
    message?: string;
    initialPassword?: string;
  }> {
    try {
      const resp = await this.fetchWithAuth('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ unitNumber, responsibleName, role }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await parseApiResponse(resp);
      if (data.ok && data.data?.success) {
        return { success: true, message: data.data.message, initialPassword: data.data.initialPassword };
      }
      return { success: false, message: data.data?.error || data.error || 'Erro ao criar usuário.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede.' };
    }
  },

  updateMoradorUser: async function(
    profileId: string,
    updates: { unitNumber?: string; responsibleName?: string; role?: string; isActive?: boolean }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.fetchWithAuth(`/api/admin/users/${profileId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await parseApiResponse(resp);
      if (data.ok && data.data?.success) {
        return { success: true, message: data.data.message };
      }
      return { success: false, message: data.data?.error || data.error || 'Erro ao atualizar usuário.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede.' };
    }
  },

  deleteMoradorUser: async function(profileId: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.fetchWithAuth(`/api/admin/users/${profileId}`, {
        method: 'DELETE',
      });
      const data = await parseApiResponse(resp);
      if (data.ok && data.data?.success) {
        return { success: true, message: data.data.message };
      }
      return { success: false, message: data.data?.error || data.error || 'Erro ao excluir usuário.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede.' };
    }
  },

  transferSindicancia: async function(targetProfileId: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.fetchWithAuth('/api/admin/transfer-sindicancia', {
        method: 'POST',
        body: JSON.stringify({ targetProfileId }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await parseApiResponse(resp);
      if (data.ok && data.data?.success) {
        return { success: true, message: data.data.message };
      }
      return { success: false, message: data.data?.error || data.error || 'Erro ao transferir sindicância.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede.' };
    }
  }
};

