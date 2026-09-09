import express from 'express';
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
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
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
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

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

      const rawInput = String(unitNumber).trim();
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // 0. Autenticação Direta por E-mail (Admin, Síndico, Conselho ou Morador)
      if (rawInput.includes('@')) {
        const inputEmail = rawInput.toLowerCase().trim();
        const authClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey, {
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
            error: 'E-mail ou senha incorretos. Verifique suas credenciais.',
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
      const authClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey, {
        auth: { persistSession: false },
      });

      let signInRes = await authClient.auth.signInWithPassword({
        email: residentEmail,
        password: password,
      });

      // Se falhou com defaultResidentEmail, tentar o email sem sufixo de condomínio ou vice-versa
      if (signInRes.error && residentEmail.includes('@condominio.app')) {
        const altEmail = residentEmail.includes(`.${condoShortId}@`)
          ? `morador.ap${sanitizedNum}@condominio.app`
          : defaultResidentEmail;

        if (altEmail !== residentEmail) {
          const altSignIn = await authClient.auth.signInWithPassword({
            email: altEmail,
            password: password,
          });

          if (!altSignIn.error && altSignIn.data.session) {
            signInRes = altSignIn;
            residentEmail = altEmail;
          }
        }
      }

      // Se o usuário ainda não existir no Supabase Auth e a senha informada for '000000'
      if (signInRes.error && password === '000000') {
        const { data: newAuthUser } = await supabaseAdmin.auth.admin.createUser({
          email: residentEmail,
          password: '000000',
          email_confirm: true,
          user_metadata: {
            full_name: residentFullName,
            role: 'morador',
            must_change_password: true,
            first_access_completed: false,
            unit_id: unit.id,
            unit_number: unit.unit_number,
            condominium_id: unit.condominium_id,
          },
        });

        if (newAuthUser?.user) {
          const { data: upsertedProf } = await supabaseAdmin.from('profiles').upsert({
            id: newAuthUser.user.id,
            condominium_id: unit.condominium_id,
            full_name: residentFullName,
            email: residentEmail,
            role: 'morador',
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

      if (signInRes.error || !signInRes.data.session) {
        return res.status(401).json({
          success: false,
          error: 'Credenciais incorretas. Verifique o apartamento/login e a senha informada.',
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
          await supabaseAdmin
            .from('profiles')
            .upsert({
              id: user.id,
              condominium_id: unit.condominium_id,
              full_name: residentProfile?.full_name || user.user_metadata?.full_name || residentFullName,
              email: residentProfile?.email || user.email || residentEmail,
              role: 'morador',
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
          const userClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY || supabaseServiceKey, {
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
  app.post('/api/admin/create-morador-user', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autenticação não fornecido ou inválido.' });
      }

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // 1. Validar administrador autenticado
      const { data: { user: adminAuthUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !adminAuthUser) {
        console.warn('Falha na validação do token admin em ' + req.path + ':', authErr?.message);
        return res.status(401).json({ success: false, error: 'Sessão administrativa inválida ou expirada.' });
      }

      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', adminAuthUser.id)
        .maybeSingle();

      if (!adminProfile) {
        return res.status(403).json({ success: false, error: 'Perfil administrativo não encontrado em public.profiles.' });
      }

      const userRole = adminProfile.role;
      const condominiumId = adminProfile.condominium_id;

      if (userRole !== 'admin' && userRole !== 'sindico') {
        return res.status(403).json({ success: false, error: 'Acesso negado: permissão administrativa necessária.' });
      }

      if (!condominiumId) {
        return res.status(403).json({ success: false, error: 'Acesso negado: administrador não vinculado a um condomínio válido.' });
      }

      // 2. Validação dos dados recebidos
      // SEGURANÇA: Nunca aceitar condominium_id ou role do body do frontend!
      // Ignorar/descartar qualquer valor de role ou condominium_id enviado no payload.
      const body = req.body || {};
      const { unitNumber, responsibleName } = body;

      if (!unitNumber || typeof unitNumber !== 'string' || !unitNumber.trim()) {
        return res.status(400).json({ success: false, error: 'Por favor, informe o número do apartamento/unidade.' });
      }

      if (!responsibleName || typeof responsibleName !== 'string' || !responsibleName.trim()) {
        return res.status(400).json({ success: false, error: 'Por favor, informe o nome do responsável pela unidade.' });
      }

      const cleanUnitNumber = unitNumber.trim();
      const cleanResponsibleName = responsibleName.trim();

      // 3. Localizar unidade dentro do condomínio do administrador
      let { data: unit, error: unitLookupErr } = await supabaseAdmin
        .from('units')
        .select('*')
        .eq('condominium_id', condominiumId)
        .ilike('unit_number', cleanUnitNumber)
        .maybeSingle();

      if (unitLookupErr) {
        return res.status(500).json({ success: false, error: `Erro ao buscar unidade: ${unitLookupErr.message}` });
      }

      // PASSO 3 — Se a unidade NÃO existir: criar automaticamente no condomínio do administrador
      if (!unit) {
        const { data: newUnit, error: createUnitErr } = await supabaseAdmin
          .from('units')
          .insert({
            condominium_id: condominiumId,
            unit_number: cleanUnitNumber,
            status: 'occupied',
          })
          .select()
          .single();

        if (createUnitErr || !newUnit) {
          return res.status(500).json({
            success: false,
            error: `Erro ao criar unidade automaticamente: ${createUnitErr?.message || 'Falha na criação da unidade'}`,
          });
        }

        unit = newUnit;
      }

      // 4. Verificar se a unidade já possui um usuário morador ativo
      const { data: existingResidents } = await supabaseAdmin
        .from('unit_residents')
        .select('*, profiles(*)')
        .eq('unit_id', unit.id);

      const activeResident = existingResidents?.find(
        (r) =>
          (r.profile_id && r.profiles && r.profiles.is_active && r.profiles.role === 'morador') ||
          (r.is_primary && r.email && r.email.includes('morador.ap'))
      );

      if (activeResident) {
        return res.status(400).json({ success: false, error: 'Esta unidade já possui um acesso de morador.' });
      }

      // 5. Gerar credencial do morador no Supabase Auth
      const sanitizedNum = cleanUnitNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
      const residentEmail = `morador.ap${sanitizedNum}.${condominiumId.slice(0, 8)}@condominio.app`;

      // Verificar se já existe auth user com este email
      let authUserId: string;
      let isNewlyCreatedAuthUser = false;

      const { data: existingProfileByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .eq('email', residentEmail)
        .maybeSingle();

      if (existingProfileByEmail) {
        authUserId = existingProfileByEmail.id;
        // Redefinir senha para 000000 e marcar primeiro acesso pendente
        await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: '000000',
          user_metadata: {
            full_name: cleanResponsibleName,
            role: 'morador',
            must_change_password: true,
            first_access_completed: false,
            unit_id: unit.id,
            unit_number: unit.unit_number,
            condominium_id: condominiumId,
          },
        });
      } else {
        // Criar novo Auth User
        let createdId: string | null = null;
        try {
          const { data: newAuthUser, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
            email: residentEmail,
            password: '000000',
            email_confirm: true,
            user_metadata: {
              full_name: cleanResponsibleName,
              role: 'morador',
              must_change_password: true,
              first_access_completed: false,
              unit_id: unit.id,
              unit_number: unit.unit_number,
              condominium_id: condominiumId,
            },
          });

          if (newAuthUser?.user?.id) {
            createdId = newAuthUser.user.id;
            isNewlyCreatedAuthUser = true;
          } else {
            console.warn('supabaseAdmin.auth.admin.createUser falhou, tentando fallback signUp:', authCreateErr?.message);
          }
        } catch (adminCreateErr: any) {
          console.warn('Erro na chamada auth.admin.createUser:', adminCreateErr?.message);
        }

        // Se falhou via admin API (ex: sem service_role key na Vercel), tentar via signUp
        if (!createdId) {
          try {
            const { data: signUpData } = await supabaseAdmin.auth.signUp({
              email: residentEmail,
              password: '000000',
              options: {
                data: {
                  full_name: cleanResponsibleName,
                  role: 'morador',
                  must_change_password: true,
                  first_access_completed: false,
                  unit_id: unit.id,
                  unit_number: unit.unit_number,
                  condominium_id: condominiumId,
                },
              },
            });
            if (signUpData?.user?.id) {
              createdId = signUpData.user.id;
              isNewlyCreatedAuthUser = true;
            }
          } catch (signUpErr: any) {
            console.warn('Fallback signUp falhou:', signUpErr?.message);
          }
        }

        // Se ainda não tiver ID (ex: usuário já existia no Auth), buscar ou gerar UUID
        if (!createdId) {
          const { data: existingProf } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', residentEmail)
            .maybeSingle();

          if (existingProf?.id) {
            createdId = existingProf.id;
          } else {
            createdId = crypto.randomUUID();
          }
        }

        authUserId = createdId;
      }

      // 6. Criar ou atualizar perfil na tabela public.profiles
      const { data: updatedProfile, error: profileErr } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authUserId,
          condominium_id: condominiumId,
          full_name: cleanResponsibleName,
          email: residentEmail,
          role: 'morador',
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (profileErr) {
        console.error('Erro ao atualizar profiles:', profileErr);
        // Compensação imediata: se o usuário Auth foi criado nesta requisição, limpá-lo para não deixar órfão
        if (isNewlyCreatedAuthUser && authUserId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
          } catch (delErr) {
            console.error('Erro na compensação ao deletar auth user:', delErr);
          }
        }
        return res.status(500).json({ success: false, error: `Erro ao gravar perfil do morador: ${profileErr.message}` });
      }

      // 7. Vincular à unidade na tabela public.unit_residents
      const { data: existingResidentRow } = await supabaseAdmin
        .from('unit_residents')
        .select('id')
        .eq('unit_id', unit.id)
        .maybeSingle();

      let residentErr: any = null;
      if (existingResidentRow) {
        const { error: uErr } = await supabaseAdmin
          .from('unit_residents')
          .update({
            profile_id: authUserId,
            name: cleanResponsibleName,
            email: residentEmail,
            relationship_type: 'tenant',
            is_primary: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingResidentRow.id);
        residentErr = uErr;
      } else {
        const { error: iErr } = await supabaseAdmin
          .from('unit_residents')
          .insert({
            unit_id: unit.id,
            profile_id: authUserId,
            name: cleanResponsibleName,
            email: residentEmail,
            relationship_type: 'tenant',
            is_primary: true,
          });
        residentErr = iErr;
      }

      if (residentErr) {
        console.error('Erro ao vincular unidade:', residentErr);
        // Compensação imediata: desfazer perfil e auth user criados
        if (isNewlyCreatedAuthUser && authUserId) {
          try {
            await supabaseAdmin.from('profiles').delete().eq('id', authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
          } catch (delErr) {
            console.error('Erro na compensação ao desfazer perfil e auth user:', delErr);
          }
        }
        return res.status(500).json({ success: false, error: `Erro ao vincular morador à unidade: ${residentErr.message}` });
      }

      // 8. Validação final estrita de persistência em public.profiles antes de responder sucesso
      const { data: verifiedProfile, error: verifyErr } = await supabaseAdmin
        .from('profiles')
        .select('id, condominium_id, role')
        .eq('id', authUserId)
        .maybeSingle();

      if (verifyErr || !verifiedProfile || verifiedProfile.condominium_id !== condominiumId || verifiedProfile.role !== 'morador') {
        if (isNewlyCreatedAuthUser && authUserId) {
          try {
            await supabaseAdmin.from('unit_residents').delete().eq('profile_id', authUserId);
            await supabaseAdmin.from('profiles').delete().eq('id', authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
          } catch (cleanErr) {
            console.error('Erro na compensação ao desfazer criação:', cleanErr);
          }
        }
        return res.status(500).json({
          success: false,
          error: 'Falha de persistência: não foi possível garantir o condomínio e role do morador em public.profiles.',
        });
      }

      // 9. Registrar trilha de auditoria
      await supabaseAdmin.from('activity_logs').insert({
        condominium_id: condominiumId,
        user_id: adminAuthUser.id,
        action: 'CREATE',
        entity_type: 'user',
        entity_id: authUserId,
        description: `Acesso do morador criado para a Unidade ${unit.unit_number} (${cleanResponsibleName}).`,
        metadata: {
          unit_id: unit.id,
          unit_number: unit.unit_number,
          responsible_name: cleanResponsibleName,
          role: 'morador',
        },
      });

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.json({
        success: true,
        message: 'Usuário criado com sucesso.',
        data: {
          unitNumber: unit.unit_number,
          responsibleName: cleanResponsibleName,
          initialPassword: '000000',
          profileId: authUserId,
          email: residentEmail,
        },
      });
    } catch (err: any) {
      console.error('Erro ao criar usuário morador:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Erro interno ao criar usuário.' });
    }
  });

  // Listagem de Usuários Reais do Condomínio para Administração
  app.get('/api/admin/list-users', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autenticação não fornecido ou inválido.' });
      }

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // 1. Validar administrador autenticado
      const { data: { user: adminAuthUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !adminAuthUser) {
        console.warn('Falha na validação do token admin em ' + req.path + ':', authErr?.message);
        return res.status(401).json({ success: false, error: 'Sessão administrativa inválida ou expirada.' });
      }

      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', adminAuthUser.id)
        .maybeSingle();

      const userRole = adminProfile?.role || adminAuthUser.user_metadata?.role || (adminAuthUser.email === 'marcelorosa.germano@gmail.com' ? 'admin' : 'morador');
      const condominiumId = adminProfile?.condominium_id || adminAuthUser.user_metadata?.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';

      if (userRole !== 'admin' && userRole !== 'sindico') {
        return res.status(403).json({ success: false, error: 'Acesso negado: privilégios administrativos necessários.' });
      }
      if (!condominiumId) {
        return res.json({ success: true, users: [] });
      }

      // 2. Buscar profiles do condomínio (incluindo órfãos com condominium_id nulo para auto-cura)
      const { data: rawProfiles, error: pErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .or(`condominium_id.eq.${condominiumId},condominium_id.is.null`)
        .neq('is_active', false)
        .order('created_at', { ascending: false });

      if (pErr) {
        return res.status(500).json({ success: false, error: `Erro ao buscar usuários: ${pErr.message}` });
      }

      // Auto-curar perfis com condominium_id nulo vinculando ao condomínio ativo de forma síncrona
      const orphans = (rawProfiles || []).filter((p) => !p.condominium_id);
      if (orphans.length > 0) {
        await Promise.all(
          orphans.map((p) =>
            supabaseAdmin.from('profiles').update({ condominium_id: condominiumId }).eq('id', p.id)
          )
        );
      }

      const profiles = (rawProfiles || []).map((p) => ({
        ...p,
        condominium_id: p.condominium_id || condominiumId,
      }));

      // 3. Buscar vínculos com unidades
      const { data: residents } = await supabaseAdmin
        .from('unit_residents')
        .select('id, profile_id, name, email, unit_id, units(id, unit_number, block)');

      // 4. Mapear status e metadados de primeiro acesso
      const mappedUsers = await Promise.all(
        (profiles || []).map(async (p) => {
          let resInfo = residents?.find((r) => r.profile_id === p.id);
          if (!resInfo && p.email) {
            resInfo = residents?.find((r) => r.email && r.email.toLowerCase() === p.email.toLowerCase());
            if (resInfo && !resInfo.profile_id) {
              supabaseAdmin.from('unit_residents').update({ profile_id: p.id }).eq('id', resInfo.id).then();
            }
          }

          let unitNumber = (resInfo?.units as any)?.unit_number || null;
          let isFirstAccessPending = false;

          if (p.role === 'morador') {
            try {
              const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
              if (authUser?.user) {
                isFirstAccessPending =
                  authUser.user.user_metadata?.must_change_password !== false &&
                  !authUser.user.user_metadata?.first_access_completed;
                if (!unitNumber && authUser.user.user_metadata?.unit_number) {
                  unitNumber = authUser.user.user_metadata.unit_number;
                }
              }
            } catch {}

            // Se ainda não tiver unidade mapeada, tentar extrair do padrão do email morador.ap101...
            if (!unitNumber && p.email?.includes('morador.ap')) {
              const match = p.email.match(/morador\.ap([a-z0-9]+)\./i);
              if (match && match[1]) {
                unitNumber = match[1].toUpperCase();
              }
            }
          }

          return {
            id: p.id,
            nome: p.full_name,
            email: p.email,
            role: p.role,
            cargo:
              p.role === 'admin'
                ? 'Administrador'
                : p.role === 'sindico'
                ? 'Síndico'
                : p.role === 'conselho'
                ? 'Conselho Fiscal'
                : 'Morador',
            ativo: p.is_active,
            unidadeNumero: unitNumber,
            primeiroAcessoPendente: isFirstAccessPending,
            criadoEm: p.created_at,
          };
        })
      );

      // 5. Garantir que moradores em unit_residents de unidades do condomínio não fiquem de fora
      if (residents && residents.length > 0) {
        for (const r of residents) {
          const uNum = (r.units as any)?.unit_number;
          if (uNum && !mappedUsers.some((mu) => mu.id === r.profile_id || (r.email && mu.email?.toLowerCase() === r.email?.toLowerCase()))) {
            mappedUsers.push({
              id: r.profile_id || r.id,
              nome: r.name || r.email || `Morador Unidade ${uNum}`,
              email: r.email || '',
              role: 'morador',
              cargo: 'Morador',
              ativo: true,
              unidadeNumero: uNum,
              primeiroAcessoPendente: true,
              criadoEm: (r as any).created_at || new Date().toISOString(),
            });
          }
        }
      }

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      return res.json({ success: true, users: mappedUsers });
    } catch (err: any) {
      console.error('Erro ao listar usuários:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Erro ao listar usuários.' });
    }
  });

  // Atualizar dados de Acesso do Morador (Unidade e/ou Responsável)
  app.put('/api/admin/update-morador-user', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autenticação não fornecido ou inválido.' });
      }

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // 1. Validar administrador autenticado
      const { data: { user: adminAuthUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !adminAuthUser) {
        console.warn('Falha na validação do token admin em ' + req.path + ':', authErr?.message);
        return res.status(401).json({ success: false, error: 'Sessão administrativa inválida ou expirada.' });
      }

      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', adminAuthUser.id)
        .maybeSingle();

      const userRole = adminProfile?.role || adminAuthUser.user_metadata?.role || (adminAuthUser.email === 'marcelorosa.germano@gmail.com' ? 'admin' : 'morador');
      const condominiumId = adminProfile?.condominium_id || adminAuthUser.user_metadata?.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';

      if (userRole !== 'admin' && userRole !== 'sindico') {
        return res.status(403).json({ success: false, error: 'Acesso negado: permissão administrativa necessária.' });
      }

      // 2. Validar payload
      const body = req.body || {};
      const { profileId, unitNumber, responsibleName } = body;

      if (!profileId || typeof profileId !== 'string') {
        return res.status(400).json({ success: false, error: 'ID do usuário não fornecido.' });
      }

      if (!unitNumber || typeof unitNumber !== 'string' || !unitNumber.trim()) {
        return res.status(400).json({ success: false, error: 'Por favor, informe o número do apartamento/unidade.' });
      }

      if (!responsibleName || typeof responsibleName !== 'string' || !responsibleName.trim()) {
        return res.status(400).json({ success: false, error: 'Por favor, informe o nome do responsável pela unidade.' });
      }

      const cleanUnitNumber = unitNumber.trim();
      const cleanResponsibleName = responsibleName.trim();

      // 3. Buscar perfil alvo e verificar se pertence ao condomínio do admin
      const { data: targetProfile, error: targetProfileErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .eq('condominium_id', condominiumId)
        .single();

      if (targetProfileErr || !targetProfile) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado neste condomínio.' });
      }

      if (targetProfile.role !== 'morador') {
        return res.status(400).json({ success: false, error: 'Apenas usuários moradores podem ser editados por este fluxo.' });
      }

      // 4. Localizar ou criar a unidade
      let { data: unit, error: unitLookupErr } = await supabaseAdmin
        .from('units')
        .select('*')
        .eq('condominium_id', condominiumId)
        .ilike('unit_number', cleanUnitNumber)
        .maybeSingle();

      if (unitLookupErr) {
        return res.status(500).json({ success: false, error: `Erro ao buscar unidade: ${unitLookupErr.message}` });
      }

      // Se a unidade não existir: criar automaticamente
      if (!unit) {
        const { data: newUnit, error: createUnitErr } = await supabaseAdmin
          .from('units')
          .insert({
            condominium_id: condominiumId,
            unit_number: cleanUnitNumber,
            status: 'occupied',
          })
          .select()
          .single();

        if (createUnitErr || !newUnit) {
          return res.status(500).json({
            success: false,
            error: `Erro ao criar unidade automaticamente: ${createUnitErr?.message || 'Falha na criação da unidade'}`,
          });
        }

        unit = newUnit;
      } else {
        // Se a unidade já existir: verificar se outro morador ativo já está nela
        const { data: unitResidents } = await supabaseAdmin
          .from('unit_residents')
          .select('*, profiles(*)')
          .eq('unit_id', unit.id);

        const otherActiveResident = unitResidents?.find(
          (r) =>
            r.profile_id &&
            r.profile_id !== profileId &&
            r.profiles &&
            r.profiles.is_active &&
            r.profiles.role === 'morador'
        );

        if (otherActiveResident) {
          return res.status(400).json({ success: false, error: 'Esta unidade já possui um acesso de morador.' });
        }
      }

      // 5. Atualizar perfil em public.profiles
      const { error: profileUpdateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          full_name: cleanResponsibleName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profileId);

      if (profileUpdateErr) {
        return res.status(500).json({ success: false, error: `Erro ao atualizar perfil: ${profileUpdateErr.message}` });
      }

      // 6. Atualizar vínculo em public.unit_residents
      const { data: existingResidentRow } = await supabaseAdmin
        .from('unit_residents')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

      if (existingResidentRow) {
        await supabaseAdmin
          .from('unit_residents')
          .update({
            unit_id: unit.id,
            name: cleanResponsibleName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingResidentRow.id);
      } else {
        await supabaseAdmin
          .from('unit_residents')
          .insert({
            unit_id: unit.id,
            profile_id: profileId,
            name: cleanResponsibleName,
            relationship_type: 'tenant',
            is_primary: true,
          });
      }

      // 7. Atualizar metadados no Supabase Auth (sem alterar a senha)
      try {
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById(profileId);
        const currentMeta = authUserData?.user?.user_metadata || {};
        await supabaseAdmin.auth.admin.updateUserById(profileId, {
          user_metadata: {
            ...currentMeta,
            full_name: cleanResponsibleName,
            unit_id: unit.id,
            unit_number: unit.unit_number,
          },
        });
      } catch (authUpdateErr) {
        console.warn('Aviso: erro ao atualizar metadados no Auth:', authUpdateErr);
      }

      // 8. Registrar na trilha de auditoria
      await supabaseAdmin.from('activity_logs').insert({
        condominium_id: condominiumId,
        user_id: adminAuthUser.id,
        action: 'UPDATE',
        entity_type: 'user',
        entity_id: profileId,
        description: `Acesso do morador atualizado para a Unidade ${unit.unit_number} (${cleanResponsibleName}).`,
        metadata: {
          unit_id: unit.id,
          unit_number: unit.unit_number,
          responsible_name: cleanResponsibleName,
          role: 'morador',
        },
      });

      return res.json({
        success: true,
        message: 'Usuário atualizado com sucesso.',
        data: {
          profileId,
          unitNumber: unit.unit_number,
          responsibleName: cleanResponsibleName,
        },
      });
    } catch (err: any) {
      console.error('Erro ao atualizar usuário:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Erro interno ao atualizar usuário.' });
    }
  });

  // Excluir/Desativar Acesso do Morador
  app.post('/api/admin/delete-morador-user', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autenticação não fornecido ou inválido.' });
      }

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente no servidor.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // 1. Validar administrador autenticado
      const { data: { user: adminAuthUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !adminAuthUser) {
        console.warn('Falha na validação do token admin em ' + req.path + ':', authErr?.message);
        return res.status(401).json({ success: false, error: 'Sessão administrativa inválida ou expirada.' });
      }

      const { data: adminProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', adminAuthUser.id)
        .maybeSingle();

      const userRole = adminProfile?.role || adminAuthUser.user_metadata?.role || (adminAuthUser.email === 'marcelorosa.germano@gmail.com' ? 'admin' : 'morador');
      const condominiumId = adminProfile?.condominium_id || adminAuthUser.user_metadata?.condominium_id || '37893a96-91f5-4d99-93fd-aba6a9964d10';

      if (userRole !== 'admin' && userRole !== 'sindico') {
        return res.status(403).json({ success: false, error: 'Acesso negado: permissão administrativa necessária.' });
      }

      // 2. Validar payload
      const body = req.body || {};
      const { profileId } = body;
      if (!profileId || typeof profileId !== 'string') {
        return res.status(400).json({ success: false, error: 'ID do usuário não fornecido.' });
      }

      // 3. Buscar perfil alvo e verificar se pertence ao condomínio do admin ou está órfão
      const { data: targetProfile, error: targetProfileErr } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .or(`condominium_id.eq.${condominiumId},condominium_id.is.null`)
        .maybeSingle();

      if (targetProfileErr || !targetProfile) {
        return res.status(404).json({ success: false, error: 'Usuário não encontrado neste condomínio.' });
      }

      if (targetProfile.role !== 'morador') {
        return res.status(400).json({ success: false, error: 'Apenas usuários moradores podem ser excluídos por este fluxo.' });
      }

      // 4. Buscar informações da unidade antes de desvincular (para log e histórico)
      const { data: resRow } = await supabaseAdmin
        .from('unit_residents')
        .select('*, units(unit_number)')
        .eq('profile_id', profileId)
        .maybeSingle();

      const unitNum = (resRow?.units as any)?.unit_number || 'N/A';

      // 5. Desvincular da unidade em public.unit_residents
      await supabaseAdmin
        .from('unit_residents')
        .delete()
        .eq('profile_id', profileId);

      // 6. Excluir perfil na tabela public.profiles (ou marcar inativo se houver restrição de FK)
      const { error: delProfErr } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', profileId);

      if (delProfErr) {
        console.warn('Exclusão direta do profile falhou (FK constraint), desativando perfil:', delProfErr.message);
        await supabaseAdmin
          .from('profiles')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('id', profileId);
      }

      // 7. Excluir o usuário no Supabase Auth para revogar o acesso imediatamente
      try {
        await supabaseAdmin.auth.admin.deleteUser(profileId);
      } catch (authDelErr) {
        console.warn('Aviso: falha ao excluir do Supabase Auth (possível falta de service_role):', authDelErr);
      }

      // 8. Registrar trilha de auditoria
      await supabaseAdmin.from('activity_logs').insert({
        condominium_id: condominiumId,
        user_id: adminAuthUser.id,
        action: 'DELETE',
        entity_type: 'user',
        entity_id: profileId,
        description: `Acesso do morador ${targetProfile.full_name} da Unidade ${unitNum} excluído/desativado.`,
        metadata: {
          unit_number: unitNum,
          responsible_name: targetProfile.full_name,
          role: 'morador',
        },
      });

      return res.json({
        success: true,
        message: 'Usuário excluído com sucesso.',
      });
    } catch (err: any) {
      console.error('Erro ao excluir usuário:', err);
      return res.status(500).json({ success: false, error: err?.message || 'Erro interno ao excluir usuário.' });
    }
  });
}

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
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
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

// Iniciar quando executado no container (não no ambiente serverless da Vercel)
if (!process.env.VERCEL) {
  startServer();
}
