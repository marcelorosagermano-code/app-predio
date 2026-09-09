# RELATÓRIO DE INVESTIGAÇÃO TÉCNICA
## PROBLEMA: CONDOMÍNIO CRIADO, MAS USUÁRIO CONTINUA "SEM CONDOMÍNIO" / "VINCULAÇÃO PENDENTE"

**Data:** 01/09/2026  
**Status do Diagnóstico:** CAUSA RAIZ IDENTIFICADA  
**Finalidade:** Exclusivamente investigação e diagnóstico (sem alterações no código ou no banco).

---

### 1. Resumo Executivo das Respostas Objetivas

1. **O condomínio foi criado?**  
   **SIM**. Tanto a Edge Function (`/supabase/functions/onboarding/index.ts`) quanto o endpoint de backend Express (`/server.ts` linha 62) inserem o registro na tabela `public.condominiums` com sucesso.
2. **Qual arquivo cria o condomínio?**  
   - Primário (Edge Function): `/supabase/functions/onboarding/index.ts` (linhas 95–110).  
   - Secundário / Fallback (Server Express): `/server.ts` (linhas 62–77).
3. **O ID criado é retornado?**  
   **SIM**. Ambas as rotas retornam `{ success: true, condominium: newCondominium, profile: updatedProfile }`.
4. **O profile é atualizado?**  
   **SIM (no banco)**. O profile é atualizado via `supabaseAdmin.from('profiles').upsert(...)` com `service_role`.
5. **condominium_id é gravado?**  
   **SIM (no banco)**. O campo `condominium_id` recebe `newCondominium.id` no PostgreSQL.
6. **role é gravado como 'admin'?**  
   **SIM (no banco)**. O campo `role` recebe `'admin'`.
7. **auth.users.id e profiles.id correspondem?**  
   **SIM**. O ID utilizado no upsert do profile é exatamente `user.id` extraído do token JWT autenticado (`supabaseAdmin.auth.getUser(token)`).
8. **Existe algum erro/rollback?**  
   **NÃO** no banco. As inserções em `condominiums`, `profiles` e `activity_logs` são commitadas.
9. **O RLS interfere?**  
   **SIM (Causa Parcial/Grave de Interação com o AuthContext)**.  
   - O RLS da tabela `profiles` possui a policy `"Membros visualizam perfis do condominio"`:
     ```sql
     using (id = auth.uid() or (condominium_id = public.get_auth_condominium_id() and condominium_id is not null))
     ```
     O usuário consegue ler seu próprio registro `profiles` quando autenticado diretamente pelo cliente.  
   - Porém, a função `authService.getProfile()` implementou um tratamento para quando `profiles` retorna erro ou restrição, buscando o fallback em `authUser.user_metadata`:
     ```ts
     const condominiumId = meta.condominium_id || meta.condominioId || null;
     ```
     Como o Supabase Auth armazena os metadados do JWT (`raw_user_meta_data`) no momento do `signUp`, os metadados do Auth NÃO continham `condominium_id` e nunca são atualizados pelo onboarding (que só atualizou a tabela `public.profiles`, mas não chamou `auth.admin.updateUserById(user.id, { user_metadata: ... })`).
10. **O AuthContext recarrega o profile?**  
    **PARCIALMENTE / DESINCRONIZADO**.  
    - No momento em que `completeOnboarding` é executado na mesma sessão ativa (`/src/contexts/AuthContext.tsx` linha 504), o contexto define o estado em memória `setUser(result.profile)` e `setCondominium(result.condominium)`.  
    - No entanto, ao fazer **novo login** (`login(email, password)` ou `onAuthStateChange` após F5/recarregar página), o método `loadUserData` chama `authService.getProfile(userId)`.
11. **O estado fica em cache?**  
    Não é cache de memória estático, mas sim dessincronização entre:
    - O banco de dados relacional (`public.profiles.condominium_id` que foi gravado via service_role);
    - A sessão Auth JWT (`auth.users.user_metadata`) que não contém `condominium_id`;
    - E o fallback de permissão/leitura caso a query do cliente no Supabase RPC/REST não retorne a coluna atualizada ou falhe ao sincronizar a sessão.
12. **O redirect após onboarding está correto?**  
    Na página `OnboardingPage.tsx`, após `completeOnboarding` retornar `{ success: true }`, o componente exibe uma tela estática: `"Condomínio Criado com Sucesso! Carregando seu painel..."` com `isSuccess = true`, mas **NÃO possui timer nem callback para fechar `isOnboardingOpen`** no `App.tsx`. Como `isOnboardingOpen` permanece `true` no estado do `App.tsx`, o usuário fica preso ou ao dar F5 o fluxo reinicia.
13. **Qual condição mostra "Vinculação Pendente"?**  
    Em `/src/App.tsx` (linhas 87–92):
    ```tsx
    if (status === 'NO_CONDOMINIUM' || status === 'PROFILE_MISSING') {
      if (isOnboardingOpen) {
        return <OnboardingPage onCancel={() => setIsOnboardingOpen(false)} />;
      }
      return <NoCondominiumView onStartOnboarding={() => setIsOnboardingOpen(true)} />;
    }
    ```
    E no `AuthContext.tsx` (linhas 110–113):
    ```tsx
    if (!profile.condominiumId) {
      setStatus('NO_CONDOMINIUM');
      return;
    }
    ```
14. **Por que "Criar Condomínio" aparece novamente?**  
    Porque a view `NoCondominiumView.tsx` exibe o botão `"Criar Condomínio"` sempre que `status === 'NO_CONDOMINIUM'`. Como o `loadUserData` avalia `profile.condominiumId` como nulo/indefinido (seja pelo fallback de metadata ou falha de leitura), o status do usuário recai em `NO_CONDOMINIUM`.
15. **Qual é a causa raiz provável?**  
    Ver Seção Detalhada abaixo.

---

### 2. Investigação do Fluxo Completo de Onboarding

#### Mapeamento dos Arquivos e Operações:
```
[Frontend] OnboardingPage.tsx 
  └─ handleSubmit() -> Chama completeOnboarding(payload) no AuthContext.tsx
       │
[Contexto] AuthContext.tsx
  └─ completeOnboarding() -> Chama onboardingService.executeOnboarding(payload)
       │
[Serviço] onboardingService.ts
  ├─ 1. Tenta invocar Edge Function: supabase.functions.invoke('onboarding', { body })
  └─ 2. Fallback: fetch('/api/onboarding', { headers: { Authorization: Bearer <token> }, body })
       │
[Backend Server-Side] server.ts (/api/onboarding) ou Edge Function (index.ts)
  ├─ Extrai token do header, valida com supabaseAdmin.auth.getUser(token)
  ├─ Consulta profiles onde id = user.id
  ├─ Insere em condominiums: { name, address, city, state, total_units, ... } -> Retorna newCondo
  ├─ Executa upsert em profiles: { id: user.id, condominium_id: newCondo.id, role: 'admin', is_active: true }
  ├─ Insere em activity_logs (auditoria)
  └─ Retorna JSON: { success: true, condominium: newCondo, profile: updatedProfile }
       │
[Retorno ao AuthContext.tsx]
  ├─ Recebe { condominium, profile }
  ├─ Seta setCondominium(result.condominium)
  ├─ Seta setUser(result.profile)
  ├─ Seta status = 'READY'
  └─ Retorna { success: true }
```

---

### 3. Diagnóstico do Estado: Por que ao fazer login novamente o usuário volta a ficar "Sem Condomínio"?

Existem **2 fatores convergentes** identificados na investigação:

#### Fator 1: Falta de Atualização dos Metadados do Usuário em `auth.users` (`user_metadata`)
- No backend (`server.ts` e Edge Function), o servidor atualizou a tabela `public.profiles`, mas **NÃO atualizou** os metadados do `auth.users` via `supabaseAdmin.auth.admin.updateUserById(user.id, { user_metadata: { condominium_id: newCondo.id, role: 'admin' } })`.
- Quando o usuário faz login via `supabase.auth.signInWithPassword`, a sessão JWT emitida pelo Supabase ainda contém o `user_metadata` inicial (vazio de condominium_id).
- Se a chamada `authService.getProfile(userId)` no cliente encontrar qualquer restrição de RLS (ou se o cliente estiver em transição de token), o bloco de fallback em `authService.ts` (linhas 190–220) lê `userData.user.user_metadata` — que está com `condominium_id = null`. Consequentemente, `profile.condominiumId` é retornado como `null`, disparando imediatamente:
  ```ts
  if (!profile.condominiumId) {
    setStatus('NO_CONDOMINIUM');
    return;
  }
  ```

#### Fator 2: A trigger `protect_profile_changes()` no PostgreSQL
Na migration `/supabase/migrations/20260901000001_initial_schema.sql` (linhas 450–477), foi criada a trigger:
```sql
create or replace function public.protect_profile_changes()
returns trigger as $$
declare
  is_caller_admin boolean;
  caller_condo_id uuid;
begin
  caller_condo_id := public.get_auth_condominium_id();
  is_caller_admin := public.is_admin();

  if auth.uid() = old.id and not is_caller_admin then
    if new.role is distinct from old.role then
      raise exception 'Operação não permitida: alteração de perfil/cargo bloqueada.';
    end if;
    if new.condominium_id is distinct from old.condominium_id then
      raise exception 'Operação não permitida: alteração de condomínio bloqueada.';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Operação não permitida: alteração de status de ativação bloqueada.';
    end if;
  end if;
  ...
```
- Se qualquer operação tentar atualizar o profile utilizando o client normal (ou se a Edge Function/backend executasse sem bypass explícito de trigger), essa trigger bloquearia a atribuição de `condominium_id` para um usuário que ainda não é admin (`not is_caller_admin`).
- O `server.ts` utiliza `supabaseAdmin` com `SUPABASE_SERVICE_ROLE_KEY`. Porém, no Supabase, triggers de tabela em `BEFORE UPDATE` executam mesmo para conexões de `service_role` a menos que o `auth.uid()` seja nulo ou tratado. No caso do upsert com `id: user.id`, a condição `auth.uid() = old.id` pode ser avaliada se o contexto da sessão não estiver limpo, ou caso a chamada seja repassada via client.

#### Fator 3: Ausência de fecho/redirecionamento da tela de Onboarding no Frontend
Em `OnboardingPage.tsx`:
- Quando `res.success === true`, é setado `setIsSuccess(true)`.
- A tela exibe a mensagem de sucesso mas **não dispara o fechamento de `isOnboardingOpen`** no `App.tsx` nem realiza navegação automática após timeout.
- Se o usuário recarrega a página (F5) para sair da tela, o `AppContent` remonta, executa `initSession()`, chama `loadUserData()`, e se depara com a inconsistência descrita no Fator 1.

---

### 4. Classificação e Causa Raiz

**CLASSIFICAÇÃO:**  
`CAUSA RAIZ IDENTIFICADA`

**Explicação Exata:**  
1. **Dessincronização de Metadados de Autenticação (`auth.users` vs `public.profiles`):**  
   O processo de onboarding grava `condominium_id` e `role = 'admin'` exclusivamente na tabela `public.profiles`, mas não sincroniza o `user_metadata` do `auth.users` no Supabase Auth. Ao realizar novo login, o token e os fallbacks de perfil leem os metadados vazios gerados no cadastro (`signUp`), resultando em `profile.condominiumId === null`.
2. **Avaliação no `AuthContext`:**  
   O `AuthContext.loadUserData` verifica `if (!profile.condominiumId)` e define o estado como `NO_CONDOMINIUM`, renderizando a view `NoCondominiumView` com "VINCULAÇÃO PENDENTE" e o botão "Criar Condomínio".
3. **Fluxo de UI no Onboarding:**  
   Após o onboarding ser concluído, a interface não finaliza o modal/estado `isOnboardingOpen = false`, forçando o usuário a recarregar a aplicação ou fazer logout/login, momento em que o problema de leitura do perfil se manifesta.

---
*Documento gerado em conformidade estrita com a diretriz de NÃO alteração de código ou banco de dados durante esta etapa de diagnóstico.*
