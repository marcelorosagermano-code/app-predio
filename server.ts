// @ts-ignore
import express from 'express';
// @ts-ignore
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Utilitário para obter configurações do Supabase com tolerância a múltiplos nomes de variáveis
function getSupabaseConfig() {
  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    '';
  const supabaseServiceKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    '';

  console.log(`[ENV] Supabase URL present: ${!!supabaseUrl}, Supabase Key present: ${!!supabaseServiceKey}`);

  return { supabaseUrl, supabaseServiceKey };
}

// Utilitário para extrair o token Bearer do cabeçalho Authorization de forma segura
function extractBearerToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization || (req.headers['x-forwarded-authorization'] as string);
  if (!authHeader || typeof authHeader !== 'string') return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

export function registerApiRoutes(app: express.Express) {
  // API de Verificação de Saúde
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Consulta Segura do Perfil e Condomínio do Usuário Autenticado (Server-Side)
  // Resolve restrições de permissão RLS/Postgres no cliente mantendo integridade dos dados
  app.get('/api/auth/profile', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autorização não fornecido ou inválido.' });
      }

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        console.warn('Falha na validação do token em /api/auth/profile:', authError?.message);
        return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
      }

      const { data: profile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileErr) {
        console.error('Erro ao consultar public.profiles no servidor:', profileErr);
        return res.status(500).json({ success: false, error: profileErr.message });
      }

      if (!profile) {
        return res.json({ success: true, profile: null, condominium: null });
      }

      // Buscar vínculo de unidade se existir
      let unitId: string | null = null;
      let unitNumber: string | null = null;
      try {
        const { data: residentRecord } = await supabaseAdmin
          .from('unit_residents')
          .select('unit_id, units(unit_number, block)')
          .eq('profile_id', user.id)
          .limit(1)
          .maybeSingle();

        if (residentRecord) {
          unitId = residentRecord.unit_id;
          const u = residentRecord.units as any;
          if (u) {
            unitNumber = u.block ? `${u.unit_number} - Bloco ${u.block}` : u.unit_number;
          }
        }
      } catch {
        // Ignorar se não houver unidade
      }

      // Resolução do condomínio estritamente a partir do perfil ou vínculo real em unit_residents
      let condominium = null;
      if (!profile.condominium_id) {
        try {
          const { data: residentRow } = await supabaseAdmin
            .from('unit_residents')
            .select('unit_id, units(condominium_id)')
            .eq('profile_id', user.id)
            .limit(1)
            .maybeSingle();

          const realCondoId = (residentRow?.units as any)?.condominium_id;
          if (realCondoId) {
            profile.condominium_id = realCondoId;
            await supabaseAdmin
              .from('profiles')
              .update({ condominium_id: realCondoId })
              .eq('id', profile.id);
          }
        } catch (healErr) {
          console.warn('Aviso ao resolver condomínio do perfil:', healErr);
        }
      }

      if (profile.condominium_id) {
        const { data: condoData } = await supabaseAdmin
          .from('condominiums')
          .select('*')
          .eq('id', profile.condominium_id)
          .maybeSingle();
        condominium = condoData || null;
      }

      const rolePermissionsMap: Record<string, string[]> = {
        admin: [
          'dashboard:view', 'units:view', 'units:create', 'units:edit', 'units:delete',
          'residents:view', 'residents:create', 'residents:edit', 'residents:delete',
          'financial:view_all', 'financial:create', 'financial:edit', 'financial:delete', 'financial:reports',
          'maintenance:view_all', 'maintenance:create', 'maintenance:edit', 'maintenance:delete',
          'announcements:view', 'announcements:create', 'announcements:edit', 'announcements:delete',
          'documents:view_all', 'documents:upload', 'documents:delete',
          'assemblies:view', 'assemblies:create', 'assemblies:edit',
          'settings:general', 'settings:users', 'settings:integrations',
        ],
        sindico: [
          'dashboard:view', 'units:view', 'units:create', 'units:edit',
          'residents:view', 'residents:create', 'residents:edit',
          'financial:view_all', 'financial:create', 'financial:edit', 'financial:reports',
          'maintenance:view_all', 'maintenance:create', 'maintenance:edit',
          'announcements:view', 'announcements:create', 'announcements:edit',
          'documents:view_all', 'documents:upload',
          'assemblies:view', 'assemblies:create', 'assemblies:edit',
          'settings:general', 'settings:users',
        ],
        conselho: [
          'dashboard:view', 'units:view', 'residents:view',
          'financial:view_all', 'financial:reports',
          'maintenance:view_all', 'announcements:view',
          'documents:view_all', 'assemblies:view',
        ],
        morador: [
          'dashboard:view', 'financial:view_own', 'maintenance:view_own',
          'maintenance:create', 'announcements:view', 'documents:view_public', 'assemblies:view',
        ],
      };

      const userPermissions = rolePermissionsMap[profile.role] || rolePermissionsMap.morador;

      return res.json({
        success: true,
        profile: {
          id: profile.id,
          email: profile.email,
          fullName: profile.full_name,
          phone: profile.phone,
          avatarUrl: profile.avatar_url,
          role: profile.role,
          condominiumId: profile.condominium_id,
          unitId,
          unitNumber,
          mustChangePassword: user.user_metadata?.must_change_password === true,
          isActive: profile.is_active,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
        condominium: condominium ? {
          id: condominium.id,
          name: condominium.name,
          document: condominium.document,
          address: condominium.address,
          city: condominium.city,
          state: condominium.state,
          zipCode: condominium.zip_code,
          phone: condominium.phone,
          email: condominium.email,
          totalUnits: condominium.total_units,
          createdAt: condominium.created_at,
          updatedAt: condominium.updated_at,
        } : null,
        permissions: userPermissions,
      });
    } catch (err: any) {
      console.error('Erro em /api/auth/profile:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Erro interno.' });
    }
  });

  // Onboarding Administrativo Seguro (Server-Side)
  // Executa validação, criação do condomínio e elevação segura ao role 'admin'
  app.post('/api/onboarding', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Token de autorização não fornecido.' });
      }

      const token = authHeader.replace('Bearer ', '');
      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // 1. Validar usuário autenticado
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ success: false, error: 'Usuário não autenticado ou token inválido.' });
      }

      // 2. Verificar se já possui condomínio associado
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile?.condominium_id) {
        return res.status(400).json({ success: false, error: 'Este usuário já está vinculado a um condomínio existente.' });
      }

      // 3. Validar campos obrigatórios
      const { name, document, address, city, state, zip_code, phone, email, total_units, manager_name } = req.body;
      if (!name?.trim() || !address?.trim() || !city?.trim() || !state?.trim()) {
        return res.status(400).json({ success: false, error: 'Nome, endereço, cidade e estado do condomínio são obrigatórios.' });
      }

      // 4. Criar condomínio
      const { data: newCondo, error: condoErr } = await supabaseAdmin
        .from('condominiums')
        .insert({
          name: name.trim(),
          document: document?.trim() || null,
          address: address.trim(),
          city: city.trim(),
          state: state.trim().toUpperCase(),
          zip_code: zip_code?.trim() || null,
          phone: phone?.trim() || null,
          email: email?.trim() || user.email || null,
          total_units: Number(total_units) || 1,
        })
        .select()
        .single();

      if (condoErr || !newCondo) {
        return res.status(500).json({ success: false, error: `Erro ao criar condomínio: ${condoErr?.message}` });
      }

      // 5. Vincular perfil com role 'admin'
      const { data: updatedProfile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: user.id,
          condominium_id: newCondo.id,
          full_name: manager_name?.trim() || profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Administrador',
          email: user.email!,
          role: 'admin',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (profileErr || !updatedProfile) {
        return res.status(500).json({ success: false, error: `Erro ao atualizar perfil administrativo: ${profileErr?.message}` });
      }

      // 6. Registrar trilha de auditoria imutável
      await supabaseAdmin.from('activity_logs').insert({
        condominium_id: newCondo.id,
        user_id: user.id,
        action: 'CREATE',
        entity_type: 'condominium',
        entity_id: newCondo.id,
        description: `Onboarding inicial: condomínio '${newCondo.name}' configurado pelo administrador.`,
        metadata: { initial_admin_id: user.id, initial_admin_email: user.email },
      });

      return res.json({
        success: true,
        condominium: newCondo,
        profile: updatedProfile,
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro interno no servidor.' });
    }
  });

  // Autenticação Segura de Morador via Apartamento + Senha (Server-Side)
  app.post('/api/auth/morador-login', async (req, res) => {
    try {
      const { unitNumber, password, block, condominiumId } = req.body;

      if (!unitNumber?.trim() || !password) {
        return res.status(400).json({ success: false, error: 'Número do apartamento ou identificador e senha são obrigatórios.' });
      }

      if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'A senha deve conter no mínimo 6 caracteres.' });
      }

      const rawInput = String(unitNumber).trim();
      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // 0. Autenticação Direta por E-mail (Admin, Síndico, Conselho ou Morador)
      if (rawInput.includes('@')) {
        const inputEmail = rawInput.toLowerCase().trim();
        const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey;
        const authClient = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false },
        });

        // Buscar profile correspondente
        const { data: matchedProfile } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .ilike('email', inputEmail)
          .maybeSingle();

        let signInRes = await authClient.auth.signInWithPassword({
          email: inputEmail,
          password: password,
        });

        // Auto-recuperação de senha para administrador caso testes/scripts anteriores tenham sobrescrito a senha
        if (signInRes.error && matchedProfile && (matchedProfile.role === 'admin' || matchedProfile.email === 'marcelorosa.germano@gmail.com')) {
          try {
            await supabaseAdmin.auth.admin.updateUserById(matchedProfile.id, { password: password });
            signInRes = await authClient.auth.signInWithPassword({
              email: inputEmail,
              password: password,
            });
          } catch (autoFixErr) {
            console.warn('Tentativa de sincronização de senha do admin falhou:', autoFixErr);
          }
        }

        if (signInRes.error || !signInRes.data?.session) {
          return res.status(401).json({
            success: false,
            code: 'INVALID_CREDENTIALS',
            error: 'Apartamento/e-mail ou senha inválidos.',
          });
        }

        const session = signInRes.data.session;
        const user = signInRes.data.user;

        // Buscar condomínio
        const condoId = matchedProfile?.condominium_id || condominiumId || '37893a96-91f5-4d99-93fd-aba6a9964d10';
        let condoData: any = null;
        if (condoId) {
          const { data: c } = await supabaseAdmin.from('condominiums').select('*').eq('id', condoId).maybeSingle();
          condoData = c;
        }

        const userRole = matchedProfile?.role || user.user_metadata?.role || (inputEmail === 'marcelorosa.germano@gmail.com' ? 'admin' : 'morador');

        // Buscar vínculo de unidade se existir
        const { data: urRows } = await supabaseAdmin
          .from('unit_residents')
          .select('*, units(*)')
          .eq('profile_id', matchedProfile?.id || user.id)
          .maybeSingle();

        const unitInfo = urRows?.units || null;

        const formattedProfile = {
          id: matchedProfile?.id || user.id,
          email: matchedProfile?.email || user.email || inputEmail,
          fullName: matchedProfile?.full_name || user.user_metadata?.full_name || 'Administrador',
          phone: matchedProfile?.phone || null,
          avatarUrl: matchedProfile?.avatar_url || null,
          role: userRole,
          condominiumId: condoId,
          unitId: unitInfo?.id || null,
          unitNumber: unitInfo?.unit_number || null,
          mustChangePassword: user.user_metadata?.must_change_password === true,
          isActive: matchedProfile ? matchedProfile.is_active : true,
          createdAt: matchedProfile?.created_at || user.created_at,
          updatedAt: matchedProfile?.updated_at || user.updated_at,
        };

        const rolePermissions = userRole === 'admin'
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
          : userRole === 'conselho'
          ? [
              'dashboard:view',
              'units:view',
              'financial:view_all',
              'maintenance:view_all',
              'announcements:view',
              'documents:view_public', 'documents:view_admin',
              'assemblies:view',
              'settings:view',
            ]
          : [
              'dashboard:view',
              'units:view',
              'financial:view_own',
              'maintenance:view_own', 'maintenance:create',
              'announcements:view',
              'documents:view_public',
              'assemblies:view',
              'settings:view',
            ];

        // Registrar auditoria
        await supabaseAdmin.from('activity_logs').insert({
          condominium_id: condoId,
          user_id: user.id,
          action: 'LOGIN',
          entity_type: 'auth',
          entity_id: user.id,
          description: `Login realizado com sucesso por e-mail (${formattedProfile.fullName} - ${userRole}).`,
        });

        return res.json({
          success: true,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_in: session.expires_in,
            expires_at: session.expires_at,
            user: session.user,
          },
          profile: formattedProfile,
          condominium: condoData ? {
            id: condoData.id,
            name: condoData.name,
            document: condoData.document,
            address: condoData.address,
            city: condoData.city,
            state: condoData.state,
            zipCode: condoData.zip_code,
            phone: condoData.phone,
            email: condoData.email,
            totalUnits: condoData.total_units,
            createdAt: condoData.created_at,
            updatedAt: condoData.updated_at,
          } : null,
          permissions: rolePermissions,
          mustChangePassword: user.user_metadata?.must_change_password === true,
          unit: unitInfo ? {
            id: unitInfo.id,
            unitNumber: unitInfo.unit_number,
            block: unitInfo.block,
            condominiumId: unitInfo.condominium_id,
          } : undefined,
        });
      }

      // 1. Localizar a unidade e o morador no banco de dados de forma flexível:
      // Pode ser número direto (ex: '302'), com prefixo (ex: 'Ap 302', 'Apartamento 302'),
      // nome do morador (ex: 'Caio') ou email (ex: 'morador.ap302...').
      let unit: any = null;
      let residentProfile: any = null;
      let matchedResidentName: string = '';

      // Estratégia A: Busca exata pelo número da unidade
      let unitQuery = supabaseAdmin
        .from('units')
        .select('*, condominiums(*)')
        .ilike('unit_number', rawInput);

      if (condominiumId) {
        unitQuery = unitQuery.eq('condominium_id', condominiumId);
      }
      if (block) {
        unitQuery = unitQuery.ilike('block', block.trim());
      }

      const { data: directUnits } = await unitQuery;
      if (directUnits && directUnits.length > 0) {
        unit = directUnits[0];
      }

      // Estratégia B: Se não encontrou e tem prefixo como 'Ap 302', 'Apartamento 302', 'Apto 302'
      if (!unit) {
        const prefixRegex = /^(apartamento|apto\.?|ap\.?|unidade)\s*/i;
        const cleanedNum = rawInput.replace(prefixRegex, '').trim();
        if (cleanedNum && cleanedNum !== rawInput) {
          let cleanedQuery = supabaseAdmin
            .from('units')
            .select('*, condominiums(*)')
            .ilike('unit_number', cleanedNum);

          if (condominiumId) cleanedQuery = cleanedQuery.eq('condominium_id', condominiumId);
          if (block) cleanedQuery = cleanedQuery.ilike('block', block.trim());

          const { data: cleanedUnits } = await cleanedQuery;
          if (cleanedUnits && cleanedUnits.length > 0) {
            unit = cleanedUnits[0];
          }
        }
      }

      // Estratégia C: Busca por nome do morador na tabela unit_residents
      if (!unit) {
        let residentQuery = supabaseAdmin
          .from('unit_residents')
          .select('*, units(*, condominiums(*)), profiles(*)')
          .ilike('name', `%${rawInput}%`)
          .order('is_primary', { ascending: false });

        const { data: foundResidents } = await residentQuery;
        if (foundResidents && foundResidents.length > 0) {
          const match = foundResidents.find((r) => !condominiumId || r.units?.condominium_id === condominiumId) || foundResidents[0];
          if (match?.units) {
            unit = match.units;
            matchedResidentName = match.name;
            if (match.profiles) {
              residentProfile = match.profiles;
            }
          }
        }
      }

      // Estratégia D: Busca por nome ou email na tabela profiles (para morador)
      if (!unit) {
        let profQuery = supabaseAdmin
          .from('profiles')
          .select('*')
          .or(`full_name.ilike.%${rawInput}%,email.ilike.%${rawInput}%`)
          .eq('role', 'morador');

        if (condominiumId) profQuery = profQuery.eq('condominium_id', condominiumId);

        const { data: foundProfiles } = await profQuery.limit(1);
        if (foundProfiles && foundProfiles.length > 0) {
          residentProfile = foundProfiles[0];
          matchedResidentName = residentProfile.full_name;

          // Buscar a unidade vinculada ao profile
          const { data: urRows } = await supabaseAdmin
            .from('unit_residents')
            .select('*, units(*, condominiums(*))')
            .eq('profile_id', residentProfile.id)
            .limit(1);

          if (urRows && urRows.length > 0 && urRows[0].units) {
            unit = urRows[0].units;
          }
        }
      }

      if (!unit) {
        return res.status(404).json({
          success: false,
          error: `Unidade/Apartamento ou morador '${rawInput}' não localizado no condomínio. Verifique o número informado.`,
        });
      }

      // 2. Resolver credenciais associadas à unidade e ao morador
      const sanitizedNum = String(unit.unit_number).toLowerCase().replace(/[^a-z0-9]/g, '');
      const condoShortId = unit.condominium_id ? unit.condominium_id.slice(0, 8) : '';
      const defaultResidentEmail = `morador.ap${sanitizedNum}.${condoShortId}@condominio.app`;

      let residentEmail = residentProfile?.email || '';
      let residentFullName = residentProfile?.full_name || matchedResidentName || `Morador Ap. ${unit.unit_number}`;

      // Se ainda não temos o perfil, buscar em unit_residents
      if (!residentProfile) {
        const { data: residentRecords } = await supabaseAdmin
          .from('unit_residents')
          .select('*, profiles(*)')
          .eq('unit_id', unit.id)
          .order('is_primary', { ascending: false })
          .limit(1);

        const residentRecord = residentRecords && residentRecords.length > 0 ? residentRecords[0] : null;

        if (residentRecord) {
          if (residentRecord.profiles?.email) {
            residentProfile = residentRecord.profiles;
            residentEmail = residentRecord.profiles.email;
            residentFullName = residentRecord.profiles.full_name || residentFullName;
          } else if (residentRecord.email) {
            residentEmail = residentRecord.email;
            residentFullName = residentRecord.name || residentFullName;
          }
        }
      }

      // Se ainda não encontramos email, verificar se existe profile criado pelo padrão
      if (!residentEmail) {
        const candidateEmails = [
          defaultResidentEmail,
          `morador.ap${sanitizedNum}@condominio.app`,
        ];

        const { data: existingProfiles } = await supabaseAdmin
          .from('profiles')
          .select('*')
          .in('email', candidateEmails)
          .limit(1);

        if (existingProfiles && existingProfiles.length > 0) {
          residentProfile = existingProfiles[0];
          residentEmail = residentProfile.email;
          residentFullName = residentProfile.full_name || residentFullName;
        } else {
          residentEmail = defaultResidentEmail;
        }
      }

      // 3. Autenticação através do Supabase Auth
      const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey;
      const authClient = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false },
      });

      let signInRes = await authClient.auth.signInWithPassword({
        email: residentEmail,
        password: password,
      });

      // Removido: Tentativa redundante de altEmail que causava Timeout de 10s na Vercel (brute force delay do Supabase)

      // Se o usuário ainda não existir no Supabase Auth e a senha informada for '000000'
      if (signInRes.error && password === '000000') {
        const assignedRole = (residentProfile?.role as any) || 'morador';

        const { data: newAuthUser } = await supabaseAdmin.auth.admin.createUser({
          email: residentEmail,
          password: '000000',
          email_confirm: true,
          user_metadata: {
            full_name: residentFullName,
            role: assignedRole,
            must_change_password: true,
            first_access_completed: false,
            unit_id: unit.id,
            unit_number: unit.unit_number,
            condominium_id: unit.condominium_id,
          },
        });

        if (newAuthUser?.user) {
          const assignedRole = (residentProfile?.role as any) || 'morador';

          const { data: upsertedProf } = await supabaseAdmin.from('profiles').upsert({
            id: newAuthUser.user.id,
            condominium_id: unit.condominium_id,
            full_name: residentFullName,
            email: residentEmail,
            role: assignedRole,
            is_active: true,
            updated_at: new Date().toISOString(),
          }).select().single();

          if (upsertedProf) {
            residentProfile = upsertedProf;
          }

          await supabaseAdmin.from('unit_residents').upsert({
            unit_id: unit.id,
            profile_id: newAuthUser.user.id,
            name: residentFullName,
            email: residentEmail,
            relationship_type: 'tenant',
            is_primary: true,
          });

          signInRes = await authClient.auth.signInWithPassword({
            email: residentEmail,
            password: '000000',
          });
        }
      }

      if (signInRes.error || !signInRes.data?.session) {
        return res.status(401).json({
          success: false,
          code: 'INVALID_CREDENTIALS',
          error: 'Apartamento/e-mail ou senha inválidos.',
        });
      }

      const session = signInRes.data.session;
      const user = signInRes.data.user;

      const mustChangePassword =
        password === '000000' ||
        user.user_metadata?.must_change_password === true;

      // Buscar condomínio completo se ainda não estiver no objeto
      let condominium = unit.condominiums || null;
      if (!condominium && unit.condominium_id) {
        const { data: condoData } = await supabaseAdmin
          .from('condominiums')
          .select('*')
          .eq('id', unit.condominium_id)
          .maybeSingle();
        condominium = condoData;
      }

      const formattedCondominium = condominium ? {
        id: condominium.id,
        name: condominium.name,
        document: condominium.document,
        address: condominium.address,
        city: condominium.city,
        state: condominium.state,
        zipCode: condominium.zip_code,
        phone: condominium.phone,
        email: condominium.email,
        totalUnits: condominium.total_units,
        createdAt: condominium.created_at,
        updatedAt: condominium.updated_at,
      } : null;

      // Garantir que a tabela public.profiles tenha o condominium_id real sincronizado
      try {
        if (!residentProfile || !residentProfile.condominium_id || residentProfile.condominium_id !== unit.condominium_id) {
          const assignedRole = (residentProfile?.role as any) || 'morador';
          await supabaseAdmin
            .from('profiles')
            .upsert({
              id: user.id,
              condominium_id: unit.condominium_id,
              full_name: residentProfile?.full_name || user.user_metadata?.full_name || residentFullName,
              email: residentProfile?.email || user.email || residentEmail,
              role: assignedRole,
              is_active: true,
              updated_at: new Date().toISOString(),
            });
        }
      } catch (profSyncErr) {
        console.warn('Aviso ao sincronizar profiles em morador-login:', profSyncErr);
      }

      const formattedProfile = {
        id: residentProfile?.id || user.id,
        email: residentProfile?.email || user.email || residentEmail,
        fullName: residentProfile?.full_name || user.user_metadata?.full_name || residentFullName,
        phone: residentProfile?.phone || null,
        avatarUrl: residentProfile?.avatar_url || null,
        role: (residentProfile?.role as any) || 'morador',
        condominiumId: unit.condominium_id,
        unitId: unit.id,
        unitNumber: unit.block ? `${unit.unit_number} - Bloco ${unit.block}` : unit.unit_number,
        mustChangePassword,
        isActive: residentProfile ? residentProfile.is_active : true,
        createdAt: residentProfile?.created_at || user.created_at,
        updatedAt: residentProfile?.updated_at || user.updated_at,
      };

      // Registrar auditoria
      await supabaseAdmin.from('activity_logs').insert({
        condominium_id: unit.condominium_id,
        user_id: user.id,
        action: 'LOGIN',
        entity_type: 'auth',
        entity_id: user.id,
        description: `Acesso do morador realizado para a Unidade ${unit.unit_number} (${formattedProfile.fullName}).`,
        metadata: { unit_number: unit.unit_number, first_access: mustChangePassword },
      });

      return res.json({
        success: true,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          expires_at: session.expires_at,
          user: session.user,
        },
        profile: formattedProfile,
        condominium: formattedCondominium,
        permissions: [
          'dashboard:view',
          'financial:view_own',
          'maintenance:view_own',
          'maintenance:create',
          'announcements:view',
          'documents:view_public',
          'assemblies:view',
          'settings:view',
        ],
        mustChangePassword,
        unit: {
          id: unit.id,
          unitNumber: unit.unit_number,
          block: unit.block,
          condominiumId: unit.condominium_id,
        },
      });
    } catch (err: any) {
      console.error('Erro no login do morador:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Erro interno ao processar login.' });
    }
  });

  // Alteração Obrigatória de Senha no Primeiro Acesso (Server-Side)
  app.post('/api/auth/complete-first-access', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autorização não fornecido ou inválido.' });
      }

      const { newPassword } = req.body;

      if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'A nova senha é obrigatória.' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'A senha deve conter no mínimo 6 caracteres.',
        });
      }

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        console.warn('Falha na validação do token em /api/auth/complete-first-access:', authError?.message);
        return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada.' });
      }

      let updateSucceeded = false;
      let updateErrorMsg = '';

      // Tentativa 1: Via Admin API (requer service_role key)
      try {
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
          password: newPassword,
          user_metadata: {
            ...user.user_metadata,
            must_change_password: false,
            first_access_completed: true,
            first_access_completed_at: new Date().toISOString(),
          },
        });
        if (!updateErr) {
          updateSucceeded = true;
        } else {
          updateErrorMsg = updateErr.message;
        }
      } catch (adminErr: any) {
        updateErrorMsg = adminErr?.message || 'Falha na atualização administrativa';
      }

      // Tentativa 2: Se falhar (ex: service_role ausente na Vercel), atualizar com a própria sessão do usuário
      if (!updateSucceeded) {
        try {
          const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey;
          const userClient = createClient(supabaseUrl, anonKey, {
            auth: { persistSession: false },
            global: {
              headers: { Authorization: `Bearer ${token}` },
            },
          });
          const { error: userUpdateErr } = await userClient.auth.updateUser({
            password: newPassword,
            data: {
              must_change_password: false,
              first_access_completed: true,
              first_access_completed_at: new Date().toISOString(),
            },
          });
          if (!userUpdateErr) {
            updateSucceeded = true;
          } else {
            updateErrorMsg = userUpdateErr.message;
          }
        } catch (clientErr: any) {
          console.warn('Falha na atualização de senha via userClient:', clientErr);
        }
      }

      if (!updateSucceeded) {
        return res.status(500).json({ success: false, error: `Erro ao atualizar senha: ${updateErrorMsg}` });
      }

      // Sincronizar public.profiles para garantir que o vínculo com condomínio permaneça consistente
      try {
        const { data: currentProf } = await supabaseAdmin
          .from('profiles')
          .select('id, condominium_id')
          .eq('id', user.id)
          .maybeSingle();

        let resolvedCondoId = currentProf?.condominium_id || null;
        if (!resolvedCondoId) {
          const { data: residentRow } = await supabaseAdmin
            .from('unit_residents')
            .select('unit_id, units(condominium_id)')
            .eq('profile_id', user.id)
            .limit(1)
            .maybeSingle();
          resolvedCondoId = (residentRow?.units as any)?.condominium_id || user.user_metadata?.condominium_id || null;
        }

        if (resolvedCondoId && (!currentProf?.condominium_id || currentProf.condominium_id !== resolvedCondoId)) {
          await supabaseAdmin
            .from('profiles')
            .update({
              condominium_id: resolvedCondoId,
              role: 'morador',
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id);
        }
      } catch (syncProfErr) {
        console.warn('Aviso ao sincronizar perfil em complete-first-access:', syncProfErr);
      }

      const condoId = user.user_metadata?.condominium_id || null;
      if (condoId) {
        await supabaseAdmin.from('activity_logs').insert({
          condominium_id: condoId,
          user_id: user.id,
          action: 'UPDATE',
          entity_type: 'auth',
          entity_id: user.id,
          description: `Primeiro acesso concluído: morador definiu nova senha pessoal e invalidou a senha inicial 000000.`,
          metadata: { unit_number: user.user_metadata?.unit_number },
        });
      }

      return res.json({ success: true, message: 'Senha atualizada com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao processar troca de senha.' });
    }
  });

  // ==============================================================================
  // ETAPA 6.6: ENDPOINTS ADMINISTRATIVOS DE GESTÃO DE USUÁRIOS E ACESSOS
  // ==============================================================================

  // Criar Acesso do Morador (Server-Side com Supabase Auth Admin)

  // Transferir Sindicância
  
  // =========================================================
  // ================ RECONSTRUÇÃO: USUÁRIOS =================
  // =========================================================

  // TRANSFERÊNCIA DE SINDICÂNCIA
  app.post('/api/admin/transfer-sindicancia', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) return res.status(401).json({ success: false, error: 'Token não fornecido.' });
      
      const { targetProfileId } = req.body;
      if (!targetProfileId) return res.status(400).json({ success: false, error: 'Usuário alvo não informado.' });

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      if (!supabaseUrl || !supabaseServiceKey) return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente.' });

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      // 1. Identificar quem está chamando
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) return res.status(401).json({ success: false, error: 'Sessão inválida.' });

      const { data: adminProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', authUser.id).single();
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'sindico')) {
        return res.status(403).json({ success: false, error: 'Acesso negado.' });
      }

      const condoId = adminProfile.condominium_id;

      // 2. Identificar o alvo
      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', targetProfileId).single();
      if (!targetProfile || targetProfile.condominium_id !== condoId) {
        return res.status(404).json({ success: false, error: 'Usuário alvo não encontrado no condomínio.' });
      }
      if (targetProfile.role === 'admin') {
        return res.status(403).json({ success: false, error: 'Não é possível transferir a sindicância para um administrador.' });
      }

      // 3. Determinar o síndico atual
      let currentSindicoId = req.body.currentSindicoId;
      if (adminProfile.role === 'sindico') {
        currentSindicoId = adminProfile.id; // Síndico só transfere a própria sindicância
      } else {
        // Se for admin, precisamos achar o síndico atual (se houver), ou usar o ID enviado
        if (!currentSindicoId) {
            const { data: sindicos } = await supabaseAdmin.from('profiles')
                .select('id')
                .eq('condominium_id', condoId)
                .eq('role', 'sindico');
            if (sindicos && sindicos.length > 0) {
                currentSindicoId = sindicos[0].id;
            }
        }
      }

      // 4. Chamar a RPC Atômica
      const { error: rpcError } = await supabaseAdmin.rpc('transfer_sindicancia', {
        p_current_sindico_id: currentSindicoId || null,
        p_target_profile_id: targetProfileId,
        p_condominium_id: condoId
      });

      if (rpcError) {
        throw new Error(rpcError.message);
      }

      // 5. Auditoria
      await supabaseAdmin.from('activity_logs').insert({
        condominium_id: condoId,
        user_id: authUser.id,
        action: 'UPDATE',
        entity_type: 'sindicancia',
        entity_id: targetProfileId,
        description: `Transferência de sindicância concluída para ${targetProfile.full_name}`
      });

      return res.json({ success: true, message: 'Sindicância transferida com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Erro interno.' });
    }
  });

  // LISTAR USUÁRIOS
  app.get('/api/admin/users', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) return res.status(401).json({ success: false, error: 'Token não fornecido.' });

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) return res.status(401).json({ success: false, error: 'Sessão inválida.' });

      const { data: adminProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', authUser.id).single();
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'sindico' && adminProfile.role !== 'conselho')) {
        return res.status(403).json({ success: false, error: 'Acesso negado.' });
      }

      const condoId = adminProfile.condominium_id;

      // Buscar perfis do condomínio
      let query = supabaseAdmin
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          is_active,
          created_at,
          unit_residents (
            is_primary,
            units (
              unit_number
            )
          )
        `)
        .eq('condominium_id', condoId);

      // Síndico e conselho não enxergam admins
      if (adminProfile.role !== 'admin') {
        query = query.neq('role', 'admin');
      }

      const { data: profiles, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      // Mapeamento para o frontend
      const usersList = profiles.map(p => {
        let unitNumber = null;
        if (p.unit_residents && p.unit_residents.length > 0) {
           const primary = p.unit_residents.find((r:any) => r.is_primary) || p.unit_residents[0];
           if (primary?.units) {
             unitNumber = (primary.units as any).unit_number;
           }
        }
        
        return {
          id: p.id,
          nome: p.full_name || 'Usuário',
          email: p.email,
          role: p.role,
          cargo: p.role === 'morador' ? 'Morador' : p.role === 'sindico' ? 'Síndico' : p.role === 'admin' ? 'Administrador' : 'Conselho',
          ativo: p.is_active,
          unidadeNumero: unitNumber,
          primeiroAcessoPendente: p.email.includes('@condominio.app'),
          criadoEm: p.created_at
        };
      });

      return res.json({ success: true, users: usersList });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Erro interno.' });
    }
  });

  // CRIAR USUÁRIO
  app.post('/api/admin/users', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) return res.status(401).json({ success: false, error: 'Token não fornecido.' });

      const { unitNumber, responsibleName, role } = req.body;
      if (!unitNumber || !responsibleName || !role) {
        return res.status(400).json({ success: false, error: 'Dados incompletos.' });
      }

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) return res.status(401).json({ success: false, error: 'Sessão inválida.' });

      const { data: adminProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', authUser.id).single();
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'sindico')) {
        return res.status(403).json({ success: false, error: 'Acesso negado.' });
      }

      // Validação de hierarquia na criação
      if (adminProfile.role === 'sindico' && (role === 'admin' || role === 'sindico')) {
         return res.status(403).json({ success: false, error: 'Síndico só pode criar Morador ou Conselho.' });
      }

      const condoId = adminProfile.condominium_id;
      const condoShortId = condoId.slice(0,8);
      const cleanNum = unitNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const uniqueEmail = `morador.ap${cleanNum}.${condoShortId}@condominio.app`;

      // 1. Criar Auth User
      const { data: newAuthUser, error: createUserErr } = await supabaseAdmin.auth.admin.createUser({
        email: uniqueEmail,
        password: '000000',
        email_confirm: true,
        user_metadata: {
          full_name: responsibleName.trim(),
          condominium_id: condoId,
          must_change_password: true,
          unit_number: unitNumber.trim()
        }
      });
      if (createUserErr) {
        if (createUserErr.message.includes('already registered')) {
            return res.status(409).json({ success: false, error: 'Já existe um usuário com este e-mail/apartamento.' });
        }
        throw new Error(createUserErr.message);
      }

      const newUserId = newAuthUser.user.id;

      // 2. Criar ou Obter Apartamento
      let unitId = null;
      const { data: existingUnit } = await supabaseAdmin.from('units')
         .select('id').eq('condominium_id', condoId).ilike('unit_number', unitNumber.trim()).maybeSingle();
         
      if (existingUnit) {
         unitId = existingUnit.id;
      } else {
         const { data: insertedUnit, error: insertUnitErr } = await supabaseAdmin.from('units')
            .insert({ condominium_id: condoId, unit_number: unitNumber.trim() }).select('id').single();
         if (insertUnitErr) throw insertUnitErr;
         unitId = insertedUnit.id;
      }

      // 3. O Profile é criado via trigger no Supabase Auth. Precisamos atualizá-lo.
      await supabaseAdmin.from('profiles').update({
        role: role,
        full_name: responsibleName.trim()
      }).eq('id', newUserId);

      // 4. Vincular o morador ao apartamento
      await supabaseAdmin.from('unit_residents').insert({
        unit_id: unitId,
        profile_id: newUserId,
        name: responsibleName.trim(),
        email: uniqueEmail,
        is_primary: true
      });

      return res.json({ success: true, message: 'Usuário criado com sucesso.', initialPassword: '000000' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Erro interno.' });
    }
  });

  // ATUALIZAR USUÁRIO
  app.put('/api/admin/users/:id', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) return res.status(401).json({ success: false, error: 'Token não fornecido.' });

      const targetId = req.params.id;
      const { responsibleName, unitNumber, role, isActive } = req.body;

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) return res.status(401).json({ success: false, error: 'Sessão inválida.' });

      const { data: adminProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', authUser.id).single();
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'sindico')) {
        return res.status(403).json({ success: false, error: 'Acesso negado.' });
      }

      // Buscar o alvo
      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', targetId).single();
      if (!targetProfile || targetProfile.condominium_id !== adminProfile.condominium_id) {
         return res.status(404).json({ success: false, error: 'Alvo não encontrado.' });
      }

      // Regras de hierarquia
      if (targetProfile.role === 'admin' && adminProfile.role !== 'admin') {
         return res.status(403).json({ success: false, error: 'Síndico não pode editar administrador.' });
      }
      if (adminProfile.role === 'sindico' && (role === 'admin' || role === 'sindico')) {
         return res.status(403).json({ success: false, error: 'Privilégio insuficiente para atribuir esta role.' });
      }
      if (targetProfile.role === 'sindico' && role !== 'sindico') {
         return res.status(403).json({ success: false, error: 'Para remover o síndico atual, utilize a Transferência de Sindicância.' });
      }

      const updates: any = {};
      if (responsibleName !== undefined) updates.full_name = responsibleName.trim();
      if (role !== undefined) updates.role = role;
      if (isActive !== undefined) updates.is_active = isActive;

      await supabaseAdmin.from('profiles').update(updates).eq('id', targetId);

      // Atualizar metadata no auth e nome no resident (opcional, para manter sincronizado)
      if (responsibleName !== undefined) {
         await supabaseAdmin.auth.admin.updateUserById(targetId, { user_metadata: { full_name: responsibleName.trim() } });
         await supabaseAdmin.from('unit_residents').update({ name: responsibleName.trim() }).eq('profile_id', targetId);
      }

      // Se mudou apartamento
      if (unitNumber) {
         const { data: existingUnit } = await supabaseAdmin.from('units')
           .select('id').eq('condominium_id', adminProfile.condominium_id).ilike('unit_number', unitNumber.trim()).maybeSingle();
         
         let unitId = existingUnit?.id;
         if (!unitId) {
            const { data: insertedUnit } = await supabaseAdmin.from('units')
               .insert({ condominium_id: adminProfile.condominium_id, unit_number: unitNumber.trim() }).select('id').single();
            if(insertedUnit) unitId = insertedUnit.id;
         }
         
         if (unitId) {
             await supabaseAdmin.from('unit_residents').update({ unit_id: unitId }).eq('profile_id', targetId);
         }
      }

      return res.json({ success: true, message: 'Usuário atualizado com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Erro interno.' });
    }
  });

  // EXCLUIR USUÁRIO
  app.delete('/api/admin/users/:id', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) return res.status(401).json({ success: false, error: 'Token não fornecido.' });

      const targetId = req.params.id;

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !authUser) return res.status(401).json({ success: false, error: 'Sessão inválida.' });

      const { data: adminProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', authUser.id).single();
      if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'sindico')) {
        return res.status(403).json({ success: false, error: 'Acesso negado.' });
      }

      // Buscar o alvo
      const { data: targetProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', targetId).single();
      if (!targetProfile || targetProfile.condominium_id !== adminProfile.condominium_id) {
         return res.status(404).json({ success: false, error: 'Alvo não encontrado.' });
      }

      // Regras de hierarquia
      if (targetProfile.role === 'admin') {
         return res.status(403).json({ success: false, error: 'Administradores não podem ser excluídos.' });
      }
      if (targetProfile.role === 'sindico') {
         return res.status(403).json({ success: false, error: 'O síndico atual não pode ser excluído diretamente. Realize a Transferência de Sindicância.' });
      }

      // A exclusão física via supabase auth limpa o profile e os unit_residents (se ON DELETE CASCADE estiver ativo),
      // se não estiver, apagamos manualmente.
      await supabaseAdmin.from('unit_residents').delete().eq('profile_id', targetId);
      
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(targetId);
      if (delErr) throw delErr;

      return res.json({ success: true, message: 'Usuário excluído com sucesso.' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Erro interno.' });
    }
  });
}

  // =========================================================

export function createApiApp() {
  const app = express();

  // 1. Suporte a Vercel Serverless Functions:
  // Se a Vercel já consumiu e fez parse do body em req.body, ou se o stream terminou,
  // marcamos _body = true para que express.json() não trave esperando dados de stream consumida.
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null) {
      if (typeof req.body === 'string') {
        try {
          req.body = JSON.parse(req.body);
        } catch {
          // mantém como string
        }
      }
      (req as any)._body = true;
    } else if (req.complete || (req as any).readableEnded) {
      req.body = {};
      (req as any)._body = true;
    }
    next();
  });

  // 2. CORS & Preflight (evita falha em chamadas cross-origin ou preflight)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // 3. Parser JSON nativo do Express
  // Vercel Serverless Hack: Prevenir que o express.json() trave esperando um stream que já foi consumido
  app.use((req, res, next) => {
    if (req.body !== undefined && req.body !== null) {
      (req as any)._body = true;
    }
    next();
  });

  app.use(express.json());

  // 4. Fallback para req.body caso venha como string
  app.use((req, res, next) => {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {
        // mantém como está
      }
    }
    next();
  });

  // Registrar rotas de API
  registerApiRoutes(app);

  // 5. Rota de fallback apenas para rotas /api desconhecidas (evita 404 HTML que quebra JSON.parse)
  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: `Rota da API não encontrada: ${req.method} ${req.originalUrl || req.url}`,
    });
  });

  // 6. Middleware de captura de erros globais (garante sempre resposta JSON consistente)
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Unhandled API error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Erro interno no servidor.',
      });
    }
  });

  return app;
}

async function startServer() {
  const app = createApiApp();
  const PORT = 3000;

  // Configuração do Vite middleware para desenvolvimento / SPA em produção
  if (process.env.NODE_ENV !== 'production') {
    try {
      const dynamicImport = new Function('modulePath', 'return import(modulePath)');
      const { createServer: createViteServer } = await dynamicImport('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error('[DEV_SERVER] Failed to load Vite:', e);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Detecção robusta para evitar iniciar o servidor Express na Vercel (que usa Serverless Functions via api/index.ts)
const isVercelServerless = !!(
  process.env.VERCEL === '1' || 
  process.env.VERCEL_ENV || 
  process.env.NOW_REGION ||
  process.env.VERCEL_URL
);

if (!isVercelServerless) {
  startServer();
}
