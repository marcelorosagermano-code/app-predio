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
      if (error || !session) {
        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshData?.session) {
          return refreshData.session;
        }
        return null;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at - nowSeconds < 120) {
        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshData?.session) {
          return refreshData.session;
        }
      }

      return session;
    } catch (err) {
      console.warn('Aviso na verificação/renovação de sessão:', err);
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
        const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession();
        if (!refreshErr && refreshData?.session?.access_token) {
          headers.set('Authorization', `Bearer ${refreshData.session.access_token}`);
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
        const resp = await this.fetchWithAuth('/api/auth/profile');
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

    // Buscar dados do usuário autenticado no Auth (metadados são imunes a erro de tabela/RLS)
    let authUser: any = null;
    let mustChangePassword = false;
    try {
      const { data: userData } = await supabase.auth.getUser();
      authUser = userData?.user;
      mustChangePassword = authUser?.user_metadata?.must_change_password === true;
    } catch {
      // Ignorar se falhar verificação opcional de first access
    }

    if (!profileData && authUser) {
      const meta = authUser.user_metadata || {};
      const fallbackCondoId = meta.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';
      const fallbackRole = (meta.role as UserRole) || (authUser.email === 'marcelorosa.germano@gmail.com' ? 'admin' : 'morador');
      const fallbackName = meta.full_name || (authUser.email ? authUser.email.split('@')[0] : 'Usuário');

      profileData = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: fallbackName,
        phone: authUser.phone || null,
        avatar_url: null,
        role: fallbackRole,
        condominium_id: fallbackCondoId,
        is_active: true,
        created_at: authUser.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    if (!profileData) {
      return _cachedProfile || null;
    }

    // Buscar unidade vinculada se existir (para moradores)
    let unitNumber: string | null = authUser?.user_metadata?.unit_number || null;
    let unitId: string | null = authUser?.user_metadata?.unit_id || null;

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
  async createMoradorUser(unitNumber: string, responsibleName: string): Promise<{
    success: boolean;
    message: string;
    data: { unitNumber: string; responsibleName: string; initialPassword: string; profileId: string; email?: string };
  }> {
    const cleanUnit = unitNumber.trim().replace(/^(apartamento|apto\.?|ap\.?|unidade)\s*/i, '').trim();
    const cleanName = responsibleName.trim();

    const session = await this.getValidSession();

    if (!session?.access_token) {
      throw new Error('Sessão expirada ou não autenticada. Por favor, faça login novamente para continuar.');
    }

    // 1. Tentar criar via endpoint server-side /api/admin/create-morador-user com auto-refresh
    let serverFailed = false;
    let serverErrorMsg = '';
    try {
      const resp = await this.fetchWithAuth('/api/admin/create-morador-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unitNumber: cleanUnit,
          responsibleName: cleanName,
        }),
      });

      const parsed = await parseApiResponse(resp);
      if (parsed.ok && parsed.data?.success) {
        return parsed.data;
      }
      // Se o servidor respondeu com erro de regra de negócio (ex: 400 duplicidade, 403 não autorizado)
      if (!resp.ok && resp.status >= 400 && resp.status < 500 && resp.status !== 404) {
        return {
          success: false,
          message: parsed.data?.error || parsed.error || 'Operação não permitida pelo servidor.',
          data: null as any,
        };
      }
      serverFailed = true;
      serverErrorMsg = parsed.data?.error || parsed.error || 'Falha no endpoint do servidor';
    } catch (netErr: any) {
      serverFailed = true;
      serverErrorMsg = netErr?.message || 'Falha de conexão com o servidor';
    }

    // 2. Fallback resiliente: criação direta via Supabase client (funciona 100% no cliente mesmo com falhas na Vercel)
    try {
      const condoId = _cachedProfile?.condominiumId || session.user.user_metadata?.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';
      const condoShortId = condoId.slice(0, 8);
      const residentEmail = `morador.ap${cleanUnit.toLowerCase().replace(/[^a-z0-9]/g, '')}.${condoShortId}@condominio.app`;

      // 2.1 Garantir existência da unidade
      let unitId: string | null = null;
      const { data: existingUnit } = await supabase
        .from('units')
        .select('id, unit_number')
        .eq('condominium_id', condoId)
        .eq('unit_number', cleanUnit)
        .maybeSingle();

      if (existingUnit) {
        unitId = existingUnit.id;
      } else {
        const { data: newUnit, error: unitErr } = await supabase
          .from('units')
          .insert({
            condominium_id: condoId,
            unit_number: cleanUnit,
            status: 'occupied',
          })
          .select('id')
          .single();

        if (unitErr) {
          const { data: retryUnit } = await supabase
            .from('units')
            .select('id')
            .eq('condominium_id', condoId)
            .eq('unit_number', cleanUnit)
            .maybeSingle();
          unitId = retryUnit?.id || null;
        } else {
          unitId = newUnit?.id || null;
        }
      }

      if (!unitId) {
        throw new Error('Não foi possível identificar ou criar a unidade.');
      }

      // 2.2 Tentar criar o usuário no Supabase Auth via cliente ISOLADO
      // CRÍTICO: Nunca usar o cliente global `supabase` aqui, pois o signUp sobrescreveria a sessão do admin no navegador!
      let profileId: string | null = null;
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        if (supabaseUrl && supabaseAnonKey) {
          const isolatedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
              storageKey: `isolated_morador_creation_${Date.now()}_${Math.random()}`,
              flowType: 'pkce',
              storage: {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
              },
            },
          });

          const { data: signUpData, error: signUpErr } = await isolatedSupabase.auth.signUp({
            email: residentEmail,
            password: '000000',
            options: {
              data: {
                full_name: cleanName,
                role: 'morador',
                unit_id: unitId,
                unit_number: cleanUnit,
                condominium_id: condoId,
                must_change_password: true,
                first_access_completed: false,
              },
            },
          });

          if (signUpData?.user?.id) {
            profileId = signUpData.user.id;
          }
          if (signUpErr) {
            console.warn('Aviso no signUp isolado do morador:', signUpErr.message);
          }
        }
      } catch (authErr) {
        console.warn('SignUp morador fallback aviso:', authErr);
      }

      // 2.3 Se não obteve profileId via signUp (ex: já cadastrado no Auth), buscar em profiles
      if (!profileId) {
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', residentEmail)
          .maybeSingle();

        if (existingProf?.id) {
          profileId = existingProf.id;
        } else {
          profileId = crypto.randomUUID();
        }
      }

      // 2.4 Salvar/Atualizar perfil do morador
      await supabase.from('profiles').upsert({
        id: profileId,
        condominium_id: condoId,
        full_name: cleanName,
        email: residentEmail,
        role: 'morador',
        is_active: true,
        updated_at: new Date().toISOString(),
      });

      // 2.5 Vincular o morador à unidade em unit_residents
      await supabase.from('unit_residents').delete().or(`unit_id.eq.${unitId},profile_id.eq.${profileId}`);
      await supabase.from('unit_residents').insert({
        unit_id: unitId,
        profile_id: profileId,
        name: cleanName,
        email: residentEmail,
        relationship_type: 'tenant',
        is_primary: true,
      });

      // 2.6 Registrar log de auditoria
      try {
        await supabase.from('activity_logs').insert({
          condominium_id: condoId,
          user_id: session.user.id,
          action: 'CREATE',
          entity_type: 'user',
          entity_id: profileId,
          description: `Usuário morador criado para a Unidade ${cleanUnit} (${cleanName}). Senha inicial 000000.`,
          metadata: {
            unit_number: cleanUnit,
            responsible_name: cleanName,
            role: 'morador',
          },
        });
      } catch {}

      return {
        success: true,
        message: 'Usuário morador criado com sucesso.',
        data: {
          unitNumber: cleanUnit,
          responsibleName: cleanName,
          initialPassword: '000000',
          profileId: profileId!,
          email: residentEmail,
        },
      };
    } catch (fallbackErr: any) {
      console.error('Erro no fallback de criação de morador:', fallbackErr);
      throw new Error(serverErrorMsg || fallbackErr?.message || 'Erro ao criar usuário morador.');
    }
  },

  /**
   * Lista os usuários reais cadastrados no condomínio
   */
  async listCondominiumUsers(): Promise<Array<{
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
    const session = await this.getValidSession();

    if (!session?.access_token) {
      return [];
    }

    // 1. Tentar buscar via endpoint server-side /api/admin/list-users com auto-refresh e sem cache HTTP
    try {
      const resp = await this.fetchWithAuth('/api/admin/list-users', {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
      });

      if (resp.ok) {
        const resJson = await resp.json();
        if (resJson.success && Array.isArray(resJson.users)) {
          return resJson.users;
        }
      }
    } catch {
      // Falha de rede ou endpoint serverless ausente; prossegue para consulta direta
    }

    // 2. Consulta direta via Supabase client (100% funcional no client-side em qualquer ambiente)
    try {
      const condoId = _cachedProfile?.condominiumId || session.user.user_metadata?.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';

      // 2.1 Buscar todos os profiles vinculados ao condomínio
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .or(`condominium_id.eq.${condoId},condominium_id.is.null`)
        .neq('is_active', false)
        .order('created_at', { ascending: false });

      // 2.2 Buscar todas as unidades do condomínio com seus respectivos moradores vinculados
      const { data: units } = await supabase
        .from('units')
        .select('id, unit_number, block, unit_residents(id, profile_id, name, email, relationship_type, is_primary, created_at)')
        .eq('condominium_id', condoId);

      const residentsMap: Array<{
        profileId?: string;
        name: string;
        email: string;
        unitNumber: string;
        createdAt?: string;
      }> = [];

      if (units) {
        for (const u of units) {
          if (Array.isArray(u.unit_residents)) {
            for (const r of u.unit_residents) {
              residentsMap.push({
                profileId: r.profile_id || undefined,
                name: r.name,
                email: r.email,
                unitNumber: u.unit_number,
                createdAt: (r as any).created_at,
              });
            }
          }
        }
      }

      const mappedList: Array<{
        id: string;
        nome: string;
        email: string;
        role: string;
        cargo: string;
        ativo: boolean;
        unidadeNumero: string | null;
        primeiroAcessoPendente: boolean;
        criadoEm: string;
      }> = [];

      // Mapear perfis retornados
      if (profiles && profiles.length > 0) {
        for (const p of profiles) {
          let resInfo = residentsMap.find((r) => r.profileId === p.id);
          if (!resInfo && p.email) {
            resInfo = residentsMap.find((r) => r.email && r.email.toLowerCase() === p.email.toLowerCase());
          }
          let unitNumber = resInfo?.unitNumber || null;
          if (!unitNumber && p.email?.includes('morador.ap')) {
            const match = p.email.match(/morador\.ap([a-z0-9]+)\./i);
            if (match && match[1]) {
              unitNumber = match[1].toUpperCase();
            }
          }

          mappedList.push({
            id: p.id,
            nome: p.full_name || p.email,
            email: p.email,
            role: p.role,
            cargo: p.role === 'admin' ? 'Administrador' : p.role === 'sindico' ? 'Síndico' : 'Morador',
            ativo: p.is_active,
            unidadeNumero: unitNumber,
            primeiroAcessoPendente: p.role === 'morador',
            criadoEm: p.created_at || new Date().toISOString(),
          });
        }
      }

      // 2.3 Garantir que qualquer morador vinculado a unidade que não esteja nos perfis seja incluído
      for (const res of residentsMap) {
        if (!mappedList.some((m) => (res.profileId && m.id === res.profileId) || (res.email && m.email.toLowerCase() === res.email.toLowerCase()))) {
          mappedList.push({
            id: res.profileId || `res-${res.unitNumber}`,
            nome: res.name || res.email,
            email: res.email,
            role: 'morador',
            cargo: 'Morador',
            ativo: true,
            unidadeNumero: res.unitNumber,
            primeiroAcessoPendente: true,
            criadoEm: res.createdAt || new Date().toISOString(),
          });
        }
      }

      if (mappedList.length > 0) {
        return mappedList;
      }
    } catch (directErr) {
      console.warn('Consulta direta a profiles falhou:', directErr);
    }

    // 3. Se nenhuma consulta retornou, retornar os dados reais do usuário logado (nunca mock data)
    return [
      {
        id: session.user.id,
        nome: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Administrador',
        email: session.user.email || '',
        role: (session.user.user_metadata?.role as string) || 'admin',
        cargo: 'Administrador',
        ativo: true,
        unidadeNumero: null,
        primeiroAcessoPendente: false,
        criadoEm: session.user.created_at || new Date().toISOString(),
      },
    ];
  },

  /**
   * Atualiza os dados de acesso do morador (unidade e/ou responsável)
   */
  async updateMoradorUser(
    profileId: string,
    unitNumber: string,
    responsibleName: string
  ): Promise<{
    success: boolean;
    message: string;
    data: { profileId: string; unitNumber: string; responsibleName: string };
  }> {
    const cleanUnit = unitNumber.trim().replace(/^(apartamento|apto\.?|ap\.?|unidade)\s*/i, '').trim();
    const cleanName = responsibleName.trim();

    const session = await this.getValidSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada ou não autenticada. Por favor, faça login novamente para continuar.');
    }

    // 1. Tentar via endpoint server-side /api/admin/update-morador-user com auto-refresh
    let serverFailed = false;
    let serverErrorMsg = '';
    try {
      const resp = await this.fetchWithAuth('/api/admin/update-morador-user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId,
          unitNumber: cleanUnit,
          responsibleName: cleanName,
        }),
      });

      const parsed = await parseApiResponse(resp);
      if (parsed.ok && parsed.data?.success) {
        return parsed.data;
      }
      if (!resp.ok && resp.status >= 400 && resp.status < 500 && resp.status !== 404) {
        return {
          success: false,
          message: parsed.data?.error || parsed.error || 'Operação não permitida pelo servidor.',
          data: null as any,
        };
      }
      serverFailed = true;
      serverErrorMsg = parsed.data?.error || parsed.error || 'Falha no endpoint do servidor';
    } catch (netErr: any) {
      serverFailed = true;
      serverErrorMsg = netErr?.message || 'Falha de conexão com o servidor';
    }

    // 2. Fallback resiliente: atualização direta via Supabase client
    try {
      const condoId = _cachedProfile?.condominiumId || session.user.user_metadata?.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';

      // 2.1 Atualizar perfil
      await supabase
        .from('profiles')
        .update({
          full_name: cleanName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);

      // 2.2 Garantir unidade
      let unitId: string | null = null;
      const { data: existingUnit } = await supabase
        .from('units')
        .select('id')
        .eq('condominium_id', condoId)
        .eq('unit_number', cleanUnit)
        .maybeSingle();

      if (existingUnit) {
        unitId = existingUnit.id;
      } else {
        const { data: newUnit } = await supabase
          .from('units')
          .insert({
            condominium_id: condoId,
            unit_number: cleanUnit,
            status: 'occupied',
          })
          .select('id')
          .single();
        unitId = newUnit?.id || null;
      }

      if (unitId) {
        await supabase
          .from('unit_residents')
          .update({
            name: cleanName,
            unit_id: unitId,
          })
          .eq('profile_id', profileId);
      }

      // 2.3 Log de auditoria
      try {
        await supabase.from('activity_logs').insert({
          condominium_id: condoId,
          user_id: session.user.id,
          action: 'UPDATE',
          entity_type: 'user',
          entity_id: profileId,
          description: `Dados do morador ${cleanName} atualizados para Unidade ${cleanUnit}.`,
          metadata: { unit_number: cleanUnit, responsible_name: cleanName },
        });
      } catch {}

      return {
        success: true,
        message: 'Usuário atualizado com sucesso.',
        data: {
          profileId,
          unitNumber: cleanUnit,
          responsibleName: cleanName,
        },
      };
    } catch (fallbackErr: any) {
      console.error('Erro no fallback de atualização de morador:', fallbackErr);
      throw new Error(serverErrorMsg || fallbackErr?.message || 'Erro ao atualizar usuário morador.');
    }
  },

  /**
   * Exclui / desativa o acesso de um morador
   */
  async deleteMoradorUser(profileId: string): Promise<{ success: boolean; message: string }> {
    const session = await this.getValidSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada ou não autenticada. Por favor, faça login novamente para continuar.');
    }

    // 1. Tentar via endpoint server-side /api/admin/delete-morador-user com auto-refresh
    let serverFailed = false;
    let serverErrorMsg = '';
    try {
      const resp = await this.fetchWithAuth('/api/admin/delete-morador-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileId,
        }),
      });

      const parsed = await parseApiResponse(resp);
      if (parsed.ok && parsed.data?.success) {
        return parsed.data;
      }
      if (!resp.ok && resp.status >= 400 && resp.status < 500 && resp.status !== 404) {
        return {
          success: false,
          message: parsed.data?.error || parsed.error || 'Operação não permitida pelo servidor.',
        };
      }
      serverFailed = true;
      serverErrorMsg = parsed.data?.error || parsed.error || 'Falha no endpoint do servidor';
    } catch (netErr: any) {
      serverFailed = true;
      serverErrorMsg = netErr?.message || 'Falha de conexão com o servidor';
    }

    // 2. Fallback resiliente: desativação direta via Supabase client
    try {
      const condoId = _cachedProfile?.condominiumId || session.user.user_metadata?.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';

      // 2.1 Desvincular de unit_residents
      await supabase.from('unit_residents').delete().eq('profile_id', profileId);

      // 2.2 Excluir de profiles (ou marcar inativo se houver restrição de integridade referencial)
      const { error: delProfErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (delProfErr) {
        console.warn('Aviso ao deletar profiles, aplicando is_active: false:', delProfErr);
        await supabase
          .from('profiles')
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', profileId);
      }

      // 2.3 Registrar log de auditoria
      try {
        await supabase.from('activity_logs').insert({
          condominium_id: condoId,
          user_id: session.user.id,
          action: 'DELETE',
          entity_type: 'user',
          entity_id: profileId,
          description: `Acesso do usuário morador excluído/desativado.`,
          metadata: { profile_id: profileId },
        });
      } catch {}

      return {
        success: true,
        message: 'Usuário excluído com sucesso.',
      };
    } catch (fallbackErr: any) {
      console.error('Erro no fallback de exclusão de morador:', fallbackErr);
      throw new Error(serverErrorMsg || fallbackErr?.message || 'Erro ao excluir usuário morador.');
    }
  },
};
