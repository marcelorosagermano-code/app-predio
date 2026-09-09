# Diagnóstico e Auditoria Final da Consistência de Usuários e Moradores

Este documento consolida a investigação de arquitetura, fluxo de persistência, auditoria de segurança (RLS) e testes de ponta a ponta para a criação e listagem de moradores no sistema.

---

## 1. Análise de Consistência Pós-Correção

### 1.1 Por que o `condominium_id` nasce inicialmente como `null`?
No PostgreSQL do Supabase, existe um trigger ativado na tabela de autenticação:
```sql
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
```
A função do trigger possui a seguinte implementação intencional:
```sql
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, is_active, condominium_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'morador', -- SEMPRE 'morador' para impedir elevação de privilégios via payload de signup
    true,
    null       -- Vinculação a condomínio deve ser feita via convite ou administração
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;
```

**Conclusão da auditoria:**
- **É esperado pela arquitetura de segurança contra privilege escalation e multi-tenancy.**
- Caso um usuário se registrasse publicamente via `signUp`, ele não poderia forjar `condominium_id` em metadados para invadir dados de outro condomínio.
- Portanto, o banco atribui `condominium_id: null` de forma padronizada até que a autoridade administrativa competente estabeleça o vínculo formal.

---

### 1.2 Em que momento exato o perfil recebe o `condominium_id`?
No fluxo administrativo oficial via servidor backend (`/api/admin/create-morador-user`):
1. **Passo 1:** O token do administrador logado é validado e seu `condominium_id` verificado.
2. **Passo 2:** A unidade é localizada ou provisionada no condomínio ativo com status `occupied`.
3. **Passo 3:** O usuário de autenticação é criado via Supabase Auth Admin API (`supabaseAdmin.auth.admin.createUser`).
4. **Passo 4:** O trigger do PostgreSQL cria o registro preliminar em `public.profiles`.
5. **Passo 5 (Imediato):** O backend executa synchronous `upsert` com Service Role em `public.profiles`:
   ```typescript
   await supabaseAdmin.from('profiles').upsert({
     id: authUserId,
     condominium_id: condominiumId,
     full_name: cleanResponsibleName,
     email: residentEmail,
     role: 'morador',
     is_active: true,
   });
   ```
6. **Passo 6 (Imediato):** O morador é vinculado à unidade na tabela `public.unit_residents`.
7. **Passo 7 (Imediato):** O log de auditoria é registrado em `public.activity_logs`.
8. **Passo 8:** Apenas após a conclusão síncrona de todos esses passos, a rota HTTP 200 é devolvida ao frontend.

---

### 1.3 Existe janela de inconsistência?
- **Para o cliente / frontend: NÃO existe janela de inconsistência.** O backend não responde à requisição de criação até que o `condominium_id`, a unidade e o vínculo em `unit_residents` estejam confirmados no banco de dados.
- **Internamente no banco de dados:** A transição dura apenas os milissegundos entre o retorno de `createUser` e o comando seguinte `profiles.upsert`. Durante esse intervalo interno, o usuário ainda não foi retornado ao chamador.

---

### 1.4 Existe risco de registro órfão e como funciona a compensação (Rollback)?
Caso ocorra uma falha de rede ou de banco durante o Passo 5 (`profiles`) ou Passo 6 (`unit_residents`), foi implementado um **mecanismo de compensação transacional defensiva**:
- Se a gravação em `profiles` falhar, o backend deleta imediatamente o usuário recém-criado no Supabase Auth (`supabaseAdmin.auth.admin.deleteUser(authUserId)`).
- Se a gravação em `unit_residents` falhar, o backend deleta o perfil incompleto em `profiles` e deleta o usuário no Auth.
- A requisição falha com status 500 informando o motivo real e **nenhum registro fantasma ou órfão permanece no Supabase**.

---

### 1.5 Como o frontend é sincronizado e o Supabase continua sendo a única fonte de verdade?
1. O frontend executa `authService.createMoradorUser()`.
2. Caso o backend aprove a criação:
   - A interface exibe os dados de acesso no modal (unidade, responsável, senha provisória `000000`).
   - Imediatamente, a interface executa `await loadUsers()`.
   - O método `loadUsers()` faz uma requisição HTTP real ao endpoint `/api/admin/list-users` com headers anti-cache (`Cache-Control: no-cache, no-store`).
   - O estado `usersList` é substituído na íntegra pelos dados reais devolvidos pelo Supabase.
3. Se o backend recusar a requisição (ex: HTTP 400 por unidade já ocupada com morador ativo):
   - O `authService` intercepta o erro 4xx e repassa diretamente a mensagem `"Esta unidade já possui um acesso de morador."` sem executar fallbacks indevidos.
   - O estado do React permanece inalterado e o erro é exibido no modal.

---

### 1.6 Políticas RLS (Row-Level Security)
As políticas RLS de `profiles`, `units` e `unit_residents` foram checadas:
- `profiles`:
  ```sql
  create policy "Membros visualizam perfis do condominio" on public.profiles
    for select to authenticated
    using (id = auth.uid() or (condominium_id = public.get_auth_condominium_id() and condominium_id is not null));
  ```
- O administrador autenticado consegue consultar via cliente padrão (Anon Key + JWT) todos os moradores que possuem `condominium_id` correspondente ao condomínio ativo.
- Nenhum RLS foi desativado e nenhuma brecha de segurança foi aberta.

---

## 2. Resultados dos Testes Práticos Executados

### Teste 1: Criação de Morador em Unidade Existente
- **Unidade:** 302
- **Responsável:** Caio
- **Resultado:**
  - `auth.users`: Criado com sucesso (`morador.ap302.37893a96@condominio.app`).
  - `profiles`: Presente com `condominium_id = 37893a96-91f5-4d99-93fd-aba6a9964d10`, role `morador`.
  - `unit_residents`: Vinculado com `relationship_type: tenant`, `is_primary: true`.
  - `list-users`: Retornado imediatamente pela consulta real ao banco.

### Teste 2: Criação de Morador com Nova Unidade (Auto-Provisionamento)
- **Unidade:** 303 (não existia no banco)
- **Responsável:** João
- **Resultado:**
  - `units`: Unidade 303 criada automaticamente no condomínio do administrador com status `occupied`.
  - `auth.users`: Criado com sucesso (`morador.ap303.37893a96@condominio.app`).
  - `profiles`: Vinculado com `condominium_id = 37893a96-91f5-4d99-93fd-aba6a9964d10`.
  - `unit_residents`: Vinculado à nova unidade 303.
  - `list-users`: Retornado imediatamente pela consulta real.

### Teste 3: Teste de Duplicidade
- **Tentativa 1:** Tentar criar novo morador para Unidade 302 ("Caio Clone").
  - **Resposta:** HTTP 400 — `"Esta unidade já possui um acesso de morador."`
  - **Resultado:** Operação bloqueada com sucesso, sem criação de segundo usuário ou vínculo indevido.
- **Tentativa 2:** Tentar criar novo morador para Unidade 303 ("Outro João").
  - **Resposta:** HTTP 400 — `"Esta unidade já possui um acesso de morador."`
  - **Resultado:** Operação bloqueada com sucesso.

### Teste 4: Persistência após Logout / Login / F5
- Nova sessão de autenticação do administrador foi gerada com novo token OTP.
- A consulta direta de `list-users` e as consultas RLS em `profiles` e `units` confirmaram que tanto a Unidade 302 (Caio) quanto a Unidade 303 (João) permanecem ativas, íntegras e visíveis para o administrador.
