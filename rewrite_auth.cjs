const fs = require('fs');

let authTs = fs.readFileSync('src/services/supabase/authService.ts', 'utf8');

const m1 = "  async createMoradorUser(";
const m2 = "  async updateMoradorUser(";
const m3 = "  async deleteMoradorUser(";
const m4 = "  async transferSindicancia(";
const m5 = "  async listCondominiumUsers(";

function replaceMethodBody(code, methodSignature, newBody) {
    const start = code.indexOf(methodSignature);
    if (start === -1) return code;
    
    let braceCount = 0;
    let foundStartBrace = false;
    let endIndex = start;
    
    for (let i = start; i < code.length; i++) {
        if (code[i] === '{') {
            braceCount++;
            foundStartBrace = true;
        } else if (code[i] === '}') {
            braceCount--;
        }
        
        if (foundStartBrace && braceCount === 0) {
            endIndex = i;
            break;
        }
    }
    
    return code.substring(0, start) + newBody + code.substring(endIndex + 1);
}

authTs = replaceMethodBody(authTs, m1, 
"  async createMoradorUser(unitNumber: string, responsibleName: string, role: string = 'morador'): Promise<{ success: boolean; message?: string; initialPassword?: string; }> {\n" +
"    try {\n" +
"      const resp = await this.fetchWithAuth('/api/admin/users', {\n" +
"        method: 'POST',\n" +
"        body: JSON.stringify({ unitNumber, responsibleName, role }),\n" +
"        headers: { 'Content-Type': 'application/json' }\n" +
"      });\n" +
"      const data = await parseApiResponse(resp);\n" +
"      if (data.ok && data.data?.success) {\n" +
"        return { success: true, message: data.data.message, initialPassword: data.data.initialPassword };\n" +
"      }\n" +
"      return { success: false, message: data.data?.error || data.error || 'Erro ao criar usuário.' };\n" +
"    } catch (err: any) {\n" +
"      return { success: false, message: err?.message || 'Erro de rede.' };\n" +
"    }\n" +
"  }"
);

authTs = replaceMethodBody(authTs, m2,
"  async updateMoradorUser(profileId: string, updates: { unitNumber?: string; responsibleName?: string; role?: string; isActive?: boolean }): Promise<{ success: boolean; message: string }> {\n" +
"    try {\n" +
"      const resp = await this.fetchWithAuth(`/api/admin/users/${profileId}`, {\n" +
"        method: 'PUT',\n" +
"        body: JSON.stringify(updates),\n" +
"        headers: { 'Content-Type': 'application/json' }\n" +
"      });\n" +
"      const data = await parseApiResponse(resp);\n" +
"      if (data.ok && data.data?.success) {\n" +
"        return { success: true, message: data.data.message };\n" +
"      }\n" +
"      return { success: false, message: data.data?.error || data.error || 'Erro ao atualizar usuário.' };\n" +
"    } catch (err: any) {\n" +
"      return { success: false, message: err?.message || 'Erro de rede.' };\n" +
"    }\n" +
"  }"
);

authTs = replaceMethodBody(authTs, m3,
"  async deleteMoradorUser(profileId: string): Promise<{ success: boolean; message: string }> {\n" +
"    try {\n" +
"      const resp = await this.fetchWithAuth(`/api/admin/users/${profileId}`, {\n" +
"        method: 'DELETE',\n" +
"      });\n" +
"      const data = await parseApiResponse(resp);\n" +
"      if (data.ok && data.data?.success) {\n" +
"        return { success: true, message: data.data.message };\n" +
"      }\n" +
"      return { success: false, message: data.data?.error || data.error || 'Erro ao excluir usuário.' };\n" +
"    } catch (err: any) {\n" +
"      return { success: false, message: err?.message || 'Erro de rede.' };\n" +
"    }\n" +
"  }"
);

authTs = replaceMethodBody(authTs, m4,
"  async transferSindicancia(targetProfileId: string): Promise<{ success: boolean; message: string }> {\n" +
"    try {\n" +
"      const resp = await this.fetchWithAuth('/api/admin/transfer-sindicancia', {\n" +
"        method: 'POST',\n" +
"        body: JSON.stringify({ targetProfileId }),\n" +
"        headers: { 'Content-Type': 'application/json' }\n" +
"      });\n" +
"      const data = await parseApiResponse(resp);\n" +
"      if (data.ok && data.data?.success) {\n" +
"        return { success: true, message: data.data.message };\n" +
"      }\n" +
"      return { success: false, message: data.data?.error || data.error || 'Erro ao transferir sindicância.' };\n" +
"    } catch (err: any) {\n" +
"      return { success: false, message: err?.message || 'Erro de rede.' };\n" +
"    }\n" +
"  }"
);

authTs = replaceMethodBody(authTs, m5,
"  async listCondominiumUsers(): Promise<Array<{\n" +
"    id: string;\n" +
"    nome: string;\n" +
"    email: string;\n" +
"    role: string;\n" +
"    cargo: string;\n" +
"    ativo: boolean;\n" +
"    unidadeNumero: string | null;\n" +
"    primeiroAcessoPendente: boolean;\n" +
"    criadoEm: string;\n" +
"  }>> {\n" +
"    try {\n" +
"      const resp = await this.fetchWithAuth('/api/admin/users', { method: 'GET' });\n" +
"      if (resp.ok) {\n" +
"        const data = await resp.json();\n" +
"        if (data.success && data.users) {\n" +
"          return data.users;\n" +
"        }\n" +
"      }\n" +
"      return [];\n" +
"    } catch (err) {\n" +
"      console.error('Erro ao listar usuários:', err);\n" +
"      return [];\n" +
"    }\n" +
"  }"
);

fs.writeFileSync('src/services/supabase/authService.ts', authTs);
console.log('Methods replaced successfully!');
