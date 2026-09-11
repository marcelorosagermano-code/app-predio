const fs = require('fs');

const serverTs = fs.readFileSync('server.ts', 'utf8');

const startIndex = serverTs.indexOf("app.post('/api/admin/transfer-sindicancia'");
const deleteIndex = serverTs.indexOf("app.post('/api/admin/delete-morador-user'");
const endBlock = serverTs.indexOf("export function createApiApp()", deleteIndex);

console.log("Found bounds:", startIndex, endBlock);

const before = serverTs.substring(0, startIndex);
const after = serverTs.substring(endBlock);

const newEndpoints = `
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
        description: \`Transferência de sindicância concluída para \${targetProfile.full_name}\`
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
        .select(\`
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
        \`)
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
             unitNumber = primary.units.unit_number;
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
      const uniqueEmail = \`morador.ap\${cleanNum}.\${condoShortId}@condominio.app\`;

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

  // =========================================================

`;

fs.writeFileSync('server.ts', before + newEndpoints + after);
