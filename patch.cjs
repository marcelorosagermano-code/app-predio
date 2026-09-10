const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const targetStr = `      // Passo 3: Atualizar metadados de autenticação
      await supabaseAdmin.auth.admin.updateUserById(targetProfileId, {
        user_metadata: { role: 'sindico' }
      }).catch(console.warn);

      await supabaseAdmin.auth.admin.updateUserById(actualCurrentSindicoId, {
        user_metadata: { role: 'morador' }
      }).catch(console.warn);`;

const replaceStr = `      // Passo 3: Atualizar metadados de autenticação
      try {
        await supabaseAdmin.auth.admin.updateUserById(targetProfileId, {
          user_metadata: { role: 'sindico' }
        });
      } catch(e) {
        console.warn('Erro ao atualizar auth do target:', e);
      }

      try {
        await supabaseAdmin.auth.admin.updateUserById(actualCurrentSindicoId, {
          user_metadata: { role: 'morador' }
        });
      } catch(e) {
        console.warn('Erro ao atualizar auth do sindico atual:', e);
      }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
