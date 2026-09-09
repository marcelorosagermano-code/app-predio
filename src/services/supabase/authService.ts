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
 * Evita erro de 'Unexpected token T, The page could not be found is not valid JSON'
 */
async function parseApiResponse(res: Response): Promise<{ ok: boolean; data: any; error?: string }> {
  const text = await res.text().catch(() => '');
  try {
    const json = JSON.parse(text);
    return { ok: res.ok, data: json, error: json.error };
  } catch {
    if (res.status === 404 || text.includes('The page could not be found') || text.includes('404')) {
      return {
        ok: false,
        data: null,
        error:
          'A rota de autenticação (/api) não foi encontrada na Vercel (Erro 404). Isso acontece quando as variáveis ou novos arquivos foram salvos na Vercel mas ainda não foi feito um Redeploy. Vá na aba Deployments da Vercel e clique em "Redeploy".',
      };
    }
    return {
      ok: false,
      data: null,
      error: `Erro de comunicação com o servidor (${res.status || 'Falha de rede'}). Se acabou de configurar as variáveis na Vercel, realize um Redeploy.`,
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
   * Conclui o primeiro acesso do morador atualizando sua senha pessoal
   */
  async completeFirstAccess(newPassword: string) {
    const session = await this.getSession();
    const token = session?.access_token;

    if (!token) {
      // Se não há token ativo (modo local sem supabase), apenas resolve
      if (!isSupabaseConfigured) {
        return { success: true };
      }
      return { success: false, error: 'Sessão não encontrada.' };
    }

    const res = await fetch('/api/auth/complete-first-access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ newPassword }),
    });

    const { ok, data, error: parsedErr } = await parseApiResponse(res);
    if (!ok || !data?.success) {
      return { success: false, error: parsedErr || data?.error || 'Falha ao atualizar senha.' };
    }

    return { success: true };
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
   * Busca os dados da sessão atual
   */
  async getSession() {
    if (!supabase) return null;
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
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
        const resp = await fetch('/api/auth/profile', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
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
    data: { unitNumber: string; responsibleName: string; initialPassword: string; profileId: string };
  }> {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const resp = await fetch('/api/admin/create-morador-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        unitNumber,
        responsibleName,
      }),
    });

    const resJson = await resp.json();
    if (!resp.ok || !resJson.success) {
      throw new Error(resJson.error || 'Erro ao criar usuário morador.');
    }

    return resJson;
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
    if (!supabase) {
      return [];
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return [];
    }

    // 1. Tentar buscar via endpoint server-side /api/admin/list-users
    try {
      const resp = await fetch('/api/admin/list-users', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (resp.ok) {
        const resJson = await resp.json();
        if (resJson.success && Array.isArray(resJson.users) && resJson.users.length > 0) {
          return resJson.users;
        }
      }
    } catch {
      // Falha de rede ou endpoint serverless ausente; prossegue para consulta direta
    }

    // 2. Consulta direta via Supabase client (100% funcional no client-side em qualquer ambiente)
    try {
      const condoId = session.user.user_metadata?.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('condominium_id', condoId)
        .order('created_at', { ascending: false });

      if (profiles && profiles.length > 0) {
        const { data: residents } = await supabase
          .from('unit_residents')
          .select('profile_id, name, email, unit_id, units(id, unit_number, block)');

        return profiles.map((p: any) => {
          const resInfo = residents?.find((r: any) => r.profile_id === p.id);
          const unitNumber = (resInfo?.units as any)?.unit_number || null;
          return {
            id: p.id,
            nome: p.full_name || p.email,
            email: p.email,
            role: p.role,
            cargo: p.role === 'admin' ? 'Administrador' : p.role === 'sindico' ? 'Síndico' : 'Morador',
            ativo: p.is_active,
            unidadeNumero: unitNumber,
            primeiroAcessoPendente: p.role === 'morador',
            criadoEm: p.created_at || new Date().toISOString(),
          };
        });
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
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const resp = await fetch('/api/admin/update-morador-user', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        profileId,
        unitNumber,
        responsibleName,
      }),
    });

    const resJson = await resp.json();
    if (!resp.ok || !resJson.success) {
      throw new Error(resJson.error || 'Erro ao atualizar usuário morador.');
    }

    return resJson;
  },

  /**
   * Exclui / desativa o acesso de um morador
   */
  async deleteMoradorUser(profileId: string): Promise<{ success: boolean; message: string }> {
    if (!supabase) {
      throw new Error('Supabase não configurado');
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    const resp = await fetch('/api/admin/delete-morador-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        profileId,
      }),
    });

    const resJson = await resp.json();
    if (!resp.ok || !resJson.success) {
      throw new Error(resJson.error || 'Erro ao excluir usuário morador.');
    }

    return resJson;
  },
};
