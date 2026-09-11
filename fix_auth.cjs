const fs = require('fs');

let authTs = fs.readFileSync('src/services/supabase/authService.ts', 'utf8');

const startIndex = authTs.indexOf("  async createMoradorUser(");

if (startIndex > 0) {
    const before = authTs.substring(0, startIndex);
    const newMethods = `
  // =========================================================
  // ================ RECONSTRUÇÃO: USUÁRIOS =================
  // =========================================================

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
    try {
      const resp = await this.fetchWithAuth('/api/admin/users', { method: 'GET' });
      if (resp.ok) {
        const data = await resp.json();
        if (data.success && data.users) {
          return data.users;
        }
      }
      return [];
    } catch (err) {
      console.error('Erro ao listar usuários:', err);
      return [];
    }
  }

  async createMoradorUser(unitNumber: string, responsibleName: string, role: string = 'morador'): Promise<{
    success: boolean;
    message?: string;
    initialPassword?: string;
  }> {
    try {
      const resp = await this.fetchWithAuth('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ unitNumber, responsibleName, role }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await parseApiResponse(resp);
      if (data.ok && data.data?.success) {
        return { success: true, message: data.data.message, initialPassword: data.data.initialPassword };
      }
      return { success: false, message: data.data?.error || data.error || 'Erro ao criar usuário.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede.' };
    }
  }

  async updateMoradorUser(
    profileId: string,
    updates: { unitNumber?: string; responsibleName?: string; role?: string; isActive?: boolean }
  ): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.fetchWithAuth(\`/api/admin/users/\${profileId}\`, {
        method: 'PUT',
        body: JSON.stringify(updates),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await parseApiResponse(resp);
      if (data.ok && data.data?.success) {
        return { success: true, message: data.data.message };
      }
      return { success: false, message: data.data?.error || data.error || 'Erro ao atualizar usuário.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede.' };
    }
  }

  async deleteMoradorUser(profileId: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.fetchWithAuth(\`/api/admin/users/\${profileId}\`, {
        method: 'DELETE',
      });
      const data = await parseApiResponse(resp);
      if (data.ok && data.data?.success) {
        return { success: true, message: data.data.message };
      }
      return { success: false, message: data.data?.error || data.error || 'Erro ao excluir usuário.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede.' };
    }
  }

  async transferSindicancia(targetProfileId: string): Promise<{ success: boolean; message: string }> {
    try {
      const resp = await this.fetchWithAuth('/api/admin/transfer-sindicancia', {
        method: 'POST',
        body: JSON.stringify({ targetProfileId }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await parseApiResponse(resp);
      if (data.ok && data.data?.success) {
        return { success: true, message: data.data.message };
      }
      return { success: false, message: data.data?.error || data.error || 'Erro ao transferir sindicância.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erro de rede.' };
    }
  }
}

export const authService = new AuthService();
`;
    fs.writeFileSync('src/services/supabase/authService.ts', before + newMethods);
    console.log("File fixed!");
}
