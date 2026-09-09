import fs from 'fs';

let content = fs.readFileSync('src/services/supabase/authService.ts', 'utf8');

content = content.replace(
`      if (parsed.success) {
        // Atualiza a sessão silenciosamente para refletir a mudança de role localmente
        await this.refreshSession();
        return { success: true, message: parsed.message || 'Transferência concluída com sucesso.' };
      }

      return { success: false, message: parsed.error || 'Erro ao transferir sindicância.' };`,
`      if (parsed.ok) {
        // Atualiza a sessão silenciosamente para refletir a mudança de role localmente
        await this.refreshSession();
        return { success: true, message: (parsed.data as any)?.message || 'Transferência concluída com sucesso.' };
      }

      return { success: false, message: parsed.error || 'Erro ao transferir sindicância.' };`
);

fs.writeFileSync('src/services/supabase/authService.ts', content);
