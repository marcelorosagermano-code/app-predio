import fs from 'fs';

let content = fs.readFileSync('src/services/supabase/authService.ts', 'utf8');

const transferMethod = `
  /**
   * Transfere a sindicância do usuário atual para outro usuário elegível no mesmo condomínio.
   * Utiliza o endpoint server-side para segurança e atomicidade.
   */
  async transferSindicancia(targetProfileId: string): Promise<{ success: boolean; message: string }> {
    const session = await this.getValidSession();
    if (!session?.access_token) {
      throw new Error('Sessão expirada ou não autenticada. Por favor, faça login novamente para continuar.');
    }

    try {
      const resp = await this.fetchWithAuth('/api/admin/transfer-sindicancia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetProfileId,
        }),
      });

      const parsed = await parseApiResponse(resp);

      if (parsed.success) {
        // Atualiza a sessão silenciosamente para refletir a mudança de role localmente
        await this.refreshSession();
        return { success: true, message: parsed.message || 'Transferência concluída com sucesso.' };
      }

      return { success: false, message: parsed.error || 'Erro ao transferir sindicância.' };
    } catch (err: any) {
      console.error('Erro na requisição transferSindicancia:', err);
      return { success: false, message: err?.message || 'Erro inesperado na transferência de sindicância.' };
    }
  }
`;

content = content.replace(
  "  async deleteMoradorUser(profileId: string): Promise<{ success: boolean; message: string }> {",
  transferMethod + "\n  async deleteMoradorUser(profileId: string): Promise<{ success: boolean; message: string }> {"
);

fs.writeFileSync('src/services/supabase/authService.ts', content);
