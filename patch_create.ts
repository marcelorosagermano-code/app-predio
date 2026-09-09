import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(
`      // SEGURANÇA: Nunca aceitar condominium_id ou role do body do frontend!
      // Ignorar/descartar qualquer valor de role ou condominium_id enviado no payload.
      const body = req.body || {};
      const { unitNumber, responsibleName } = body;`,
`      // SEGURANÇA: Validar rigorosamente a role solicitada. O condominium_id SEMPRE será o do admin.
      const body = req.body || {};
      const { unitNumber, responsibleName, role: requestedRoleFromClient } = body;
      
      let requestedRole = requestedRoleFromClient || 'morador';
      
      // Validação da hierarquia
      if (requestedRole === 'admin') {
        return res.status(403).json({ success: false, error: 'Acesso negado: Não é possível criar perfil de administrador por esta interface.' });
      }
      if (requestedRole === 'sindico' && userRole !== 'admin') {
        return res.status(403).json({ success: false, error: 'Acesso negado: Apenas administradores podem cadastrar síndicos.' });
      }
      if (!['morador', 'sindico', 'conselho'].includes(requestedRole)) {
        requestedRole = 'morador';
      }`
);

// Update role creation dynamically
content = content.replace(
/role: 'morador',/g,
`role: requestedRole,`
);

content = content.replace(
/p\.profiles\.role === 'morador'/g,
`true` // Because now residents might not just be 'morador'
);

fs.writeFileSync('server.ts', content);
