import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const transferEndpoint = `
  // Transferir Sindicância
  app.post('/api/admin/transfer-sindicancia', async (req, res) => {
    try {
      const token = extractBearerToken(req);
      if (!token) {
        return res.status(401).json({ success: false, error: 'Token de autenticação não fornecido.' });
      }

      const { supabaseUrl, supabaseServiceKey } = getSupabaseConfig();
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ success: false, error: 'Configuração do Supabase ausente.' });
      }

      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      // 1. Identificar o usuário autenticado
      const { data: { user: authUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !authUser) {
        return res.status(401).json({ success: false, error: 'Sessão inválida.' });
      }

      // 2. Consultar public.profiles do solicitante
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (!callerProfile) {
        return res.status(403).json({ success: false, error: 'Perfil não encontrado.' });
      }

      // 3 & 4. Confirmar que o solicitante pertence ao condomínio e é síndico
      const condominiumId = callerProfile.condominium_id;
      if (!condominiumId) {
        return res.status(403).json({ success: false, error: 'Usuário sem condomínio vinculado.' });
      }

      if (callerProfile.role !== 'sindico') {
        return res.status(403).json({ success: false, error: 'Apenas síndicos podem transferir a sindicância.' });
      }

      // 5. Validar o destino
      const body = req.body || {};
      const { targetProfileId } = body;

      if (!targetProfileId || typeof targetProfileId !== 'string') {
        return res.status(400).json({ success: false, error: 'Destino não fornecido.' });
      }

      // 8. Validar que o destino não é o próprio solicitante
      if (targetProfileId === callerProfile.id) {
        return res.status(400).json({ success: false, error: 'Não é possível transferir a sindicância para si mesmo.' });
      }

      // 6 & 7. Validar que o destino pertence ao mesmo condomínio e não é admin
      const { data: targetProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', targetProfileId)
        .maybeSingle();

      if (!targetProfile) {
        return res.status(404).json({ success: false, error: 'Usuário destino não encontrado.' });
      }

      if (targetProfile.condominium_id !== condominiumId) {
        return res.status(403).json({ success: false, error: 'O usuário destino deve pertencer ao mesmo condomínio.' });
      }

      if (targetProfile.role === 'admin') {
        return res.status(403).json({ success: false, error: 'Não é possível transferir a sindicância para um administrador.' });
      }
      
      if (targetProfile.role === 'sindico') {
        return res.status(400).json({ success: false, error: 'O usuário destino já é um síndico.' });
      }

      // 9. Verificar se já existe algum outro síndico ativo, para evitar inconsistências (safety check)
      const { data: existingSindicos } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('condominium_id', condominiumId)
        .eq('role', 'sindico')
        .neq('id', callerProfile.id);
        
      if (existingSindicos && existingSindicos.length > 0) {
        console.warn('Alerta: Encontrados outros síndicos no condomínio.', existingSindicos);
      }

      // 10 & 11. Alterar os roles (Simulando atomicidade com fallback)
      const originalTargetRole = targetProfile.role;
      
      // Step 1: Promote target
      const { error: targetErr } = await supabaseAdmin
        .from('profiles')
        .update({ role: 'sindico' })
        .eq('id', targetProfileId);
        
      if (targetErr) {
        return res.status(500).json({ success: false, error: 'Falha ao promover o novo síndico.' });
      }
      
      // Step 2: Demote caller
      const { error: callerErr } = await supabaseAdmin
        .from('profiles')
        .update({ role: 'morador' })
        .eq('id', callerProfile.id);
        
      if (callerErr) {
        // Fallback: Revert target promotion
        await supabaseAdmin.from('profiles').update({ role: originalTargetRole }).eq('id', targetProfileId);
        return res.status(500).json({ success: false, error: 'Falha ao rebaixar o síndico atual. Operação revertida.' });
      }

      // Update Auth User Metadata for both to reflect roles (optional but recommended for session consistency)
      await supabaseAdmin.auth.admin.updateUserById(targetProfileId, {
        user_metadata: { role: 'sindico' }
      }).catch(console.warn);
      
      await supabaseAdmin.auth.admin.updateUserById(callerProfile.id, {
        user_metadata: { role: 'morador' }
      }).catch(console.warn);

      // 12. Registrar no activity_logs
      try {
        await supabaseAdmin.from('activity_logs').insert({
          condominium_id: condominiumId,
          user_id: callerProfile.id,
          action: 'Transferência de Sindicância',
          details: \`Sindicância transferida de \${callerProfile.full_name || callerProfile.name || callerProfile.id} para \${targetProfile.full_name || targetProfile.name || targetProfile.id}.\`,
          type: 'system',
          created_at: new Date().toISOString()
        });
      } catch (logErr) {
        console.warn('Falha ao registrar log de transferência:', logErr);
      }

      return res.json({ success: true, message: 'Transferência concluída com sucesso.' });
    } catch (err: any) {
      console.error('Erro na transferência de sindicância:', err);
      return res.status(500).json({ success: false, error: 'Erro interno na transferência.' });
    }
  });
`;

// Insert the new route right before `app.post('/api/admin/create-morador-user', async (req, res) => {`
content = content.replace(
  "  app.post('/api/admin/create-morador-user', async (req, res) => {",
  transferEndpoint + "\n  app.post('/api/admin/create-morador-user', async (req, res) => {"
);

fs.writeFileSync('server.ts', content);
