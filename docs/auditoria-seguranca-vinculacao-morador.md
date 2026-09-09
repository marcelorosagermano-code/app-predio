# Relatório de Auditoria de Segurança: Vinculação de Morador sem Confiança em `user_metadata`

## 1. Sumário Executivo

Esta auditoria documenta a análise de causa raiz, a vulnerabilidade identificada, a remediação arquitetural aplicada e a verificação do modelo de segurança para o fluxo de vinculação de moradores.

**Princípio Fundamental de Segurança:**
> **`USER_METADATA` NUNCA É FONTE DE AUTORIZAÇÃO.**
> O cliente HTTP nunca possui autoridade para definir `condominium_id`, `role`, privilégios administrativos ou unidades associadas. A tabela `public.profiles` gerenciada no banco de dados e manipulada exclusivamente por operações autorizadas no backend é a única fonte da verdade de autorização do sistema.

---

## 2. Vulnerabilidade Identificada e Causa Raiz

### 2.1 A Causa Raiz do Problema Original ("Vinculação Pendente")
Anteriormente, quando um administrador criava um morador pelo painel:
1. O usuário era criado em `auth.users` via `admin.createUser`.
2. A trigger `public.handle_new_auth_user()` inseria o perfil em `public.profiles`.
3. Porém, se a trigger utilizasse valores fixos ou nulos e o vínculo não fosse persistido de forma atômica e definitiva em `public.profiles` no backend, o morador mantinha `condominium_id = NULL`.
4. Ao fazer login e navegar ou recarregar (F5), a hidratação da sessão consultava `public.profiles`. Como `condominium_id` era `NULL`, o sistema caía legitimamente no estado `NO_CONDOMINIUM` ("Vinculação Pendente").

### 2.2 A Regressão de Segurança Detectada
Uma tentativa de contornar esse comportamento alterou `public.handle_new_auth_user()` para ler `raw_user_meta_data->>'condominium_id'` e `raw_user_meta_data->>'role'`. 
Além disso, regras RLS foram afrouxadas para permitir atualizações onde `condominium_id IS NULL`, e métodos no frontend tentavam "curar" perfis incompletos atualizando o banco ou injetando identificadores arbitrários.

**Impacto de Segurança da Vulnerabilidade:**
- **Privilege Escalation:** Qualquer usuário se cadastrando via API pública (`auth.signUp`) poderia enviar metadados arbitrários:
  ```json
  {
    "role": "admin",
    "condominium_id": "uuid-de-outro-condominio"
  }
  ```
- **Violação de Multi-Tenancy:** A leitura de `user_metadata` pela trigger de banco permitia que clientes determinassem a qual condomínio pertencem e quais privilégios teriam no banco de dados, contornando todas as camadas de segurança relacional.

---

## 3. Correção Arquitetural Implementada

A remediação seguiu a separação estrita de responsabilidades:

### 3.1 Camada de Banco de Dados: Trigger Seguro e RLS Estrito
1. **Trigger `public.handle_new_auth_user()` Restaurada:**
   - **`role`:** Sempre fixado em `'morador'` por padrão. Metadados do usuário enviados pelo cliente são expressamente ignorados para autorização.
   - **`condominium_id`:** Sempre inicializado como `NULL`. O cliente nunca vincula um usuário a um condomínio via trigger de autenticação.
   - **`full_name`:** Extrai apenas o nome de exibição (`full_name` ou `nome`) para fins estritamente estéticos.
   - **`is_active`:** Fixado como `true`.
   - **`ON CONFLICT (id) DO NOTHING`:** O trigger nunca altera registros pré-existentes com dados não confiáveis de novos logins.

2. **Políticas de Row Level Security (RLS) Blindadas:**
   - A política de atualização de perfis por administradores exige estritamente:
     ```sql
     USING (
       EXISTS (
         SELECT 1 FROM public.profiles admin_p
         WHERE admin_p.id = auth.uid()
           AND admin_p.role IN ('admin', 'sindico')
           AND admin_p.condominium_id = profiles.condominium_id
       )
     )
     ```
   - **Nenhum bypass para `condominium_id IS NULL`**: Administradores só podem ler ou atualizar perfis que já pertencem comprovadamente ao seu próprio condomínio.

### 3.2 Camada de Backend: Vinculação Autoritativa com Privilégios Controlados
Toda a criação e vinculação do morador agora ocorre exclusivamente no endpoint privilegiado `/api/admin/create-morador-user`:
1. **Validação do Administrador:**
   - Valida o token JWT através de `supabaseAdmin.auth.getUser(token)`.
   - Consulta `public.profiles` do administrador para garantir que ele possui `role IN ('admin', 'sindico')` e um `condominium_id` válido.
2. **Descarte de Metadados Maliciosos:**
   - O payload da requisição aceita apenas `unitNumber` e `responsibleName`. Qualquer campo como `role` ou `condominium_id` enviado no corpo da requisição é expressamente descartado.
3. **Escrita Atômica Autorizada:**
   - Utilizando o cliente de serviço (`supabaseAdmin`, `service_role`), o backend grava diretamente em `public.profiles`:
     - `condominium_id = adminProfile.condominium_id` (origem garantida da sessão do admin).
     - `role = 'morador'`.
   - Vincula a unidade em `public.unit_residents`.
4. **Verificação de Consistência e Compensação (Rollback):**
   - Antes de retornar resposta de sucesso ao cliente, o backend faz um `SELECT` em `public.profiles`.
   - Caso `condominium_id` ou `role` não correspondam aos valores autorizados, o backend executa a rotina de compensação (deleta usuário em `auth.users`, remove registros órfãos) e retorna erro 500, impedindo estados inconsistentes.

### 3.3 Camada de Frontend: Eliminação de Fallbacks e Auto-Curas
1. **`authService.ts` (`getProfile`):**
   - Não utiliza `user_metadata.condominium_id` nem `user_metadata.role`.
   - Apenas consulta `public.profiles`. Se o registro não existir ou se `condominium_id` for nulo, retorna `null` para o vínculo.
   - Não tenta executar mutações (`supabase.from('profiles').update`) a partir do navegador.
2. **`AuthContext.tsx`:**
   - Não faz suposições nem busca o primeiro condomínio da tabela como fallback fictício.
   - Se `profile.condominiumId` for nulo após a carga oficial de `public.profiles`, o status do usuário é legitimamente definido como `'NO_CONDOMINIUM'`.

---

## 4. Matriz de Verificação e Testes de Segurança

| Cenário de Teste | Vetor / Ação | Resultado Esperado | Validação do Sistema |
| :--- | :--- | :--- | :--- |
| **Tentativa de Elevação de Privilégio via SignUp** | Envio de `user_metadata: { role: 'admin', condominium_id: 'uuid' }` em cadastro público | Perfil criado com `role='morador'` e `condominium_id=NULL` | **Aprovado.** Trigger ignora metadados para autorização. |
| **Tentativa de Injeção no Payload de Criação de Morador** | Envio de `POST /api/admin/create-morador-user` com `{ role: 'admin', condominiumId: 'outro_condo' }` | Backend descarta os campos e força `role='morador'` e condomínio do administrador | **Aprovado.** Endpoint vincula exclusivamente ao condomínio do admin. |
| **Tentativa de Atualização Indevida de Perfil via RLS** | Admin do Condomínio A tenta atualizar perfil com `condominium_id=NULL` ou do Condomínio B | Acesso negado pelo PostgreSQL RLS | **Aprovado.** RLS restringe atualizações ao próprio `condominium_id`. |
| **Persistência de Sessão (F5 / Token Refresh)** | Morador João faz login, navega e recarrega a página | O perfil é hidratado diretamente de `public.profiles` com seu `condominium_id` preservado | **Aprovado.** João permanece ativo e não cai em "Vinculação Pendente". |
| **Isolamento Multi-Tenant** | Consulta de unidades e moradores por administradores | Apenas moradores e unidades do `condominium_id` do administrador são retornados | **Aprovado.** Queries não utilizam fallbacks genéricos. |
| **Conta sem Vínculo Real** | Usuário entra no sistema sem `condominium_id` em `public.profiles` | Exibição legítima do status `NO_CONDOMINIUM` ("Vinculação Pendente") sem vincular automaticamente a outro condomínio | **Aprovado.** Nenhum fallback arbitrário é aplicado. |

---

## 5. Conclusão

A integridade do modelo de autorização do sistema foi completamente reestabelecida:
- O banco de dados não confia em dados fornecidos pelo cliente.
- A persistência do vínculo do morador é realizada exclusivamente por rotas autorizadas do backend administrativo com checagem de consistência.
- O morador João acessa o sistema sem regressões ou falsos redirecionamentos para "Vinculação Pendente", mantendo o isolamento multi-tenant seguro e auditável.
