# Relatório Técnico de Auditoria — Etapa 6
**Sistema de Gestão Condominial**  
**Data:** 01/09/2026  
**Auditor:** Agente de Engenharia e Segurança  

---

## 1. Roles Encontrados no Código

A auditoria de papéis técnicos mapeou todas as interfaces, tipos e chamadas no código-fonte.

- **Valores canônicos válidos homologados:**
  - `'admin'` (Administrador / Síndico Geral com privilégios totais)
  - `'sindico'` (Síndico com gestão operacional e financeira)
  - `'conselho'` (Membro do Conselho Fiscal com acesso de visualização e auditoria)
  - `'morador'` (Morador / Inquilino / Proprietário restrito à sua respectiva unidade)

- **Correção de variantes legadas:**
  - O tipo `UserRole` em `src/types/index.ts` continha os literais `'ADMIN' | 'MORADOR'` além dos canônicos em minúsculo. Todas as variantes em maiúsculo foram **removidas**, unificando estritamente a tipagem para:
    ```typescript
    export type UserRole = 'admin' | 'sindico' | 'conselho' | 'morador';
    ```
  - Em `mockData.ts`, `AuthContext.tsx`, `Header.tsx`, `LoginPage.tsx` e `ConfiguracoesPage.tsx`, todos os valores e verificações técnicas foram ajustados para operar exclusivamente sobre `'admin' | 'sindico' | 'conselho' | 'morador'`.

---

## 2. Verificação de 'administrador' como Role Técnico

- **Resultado:** **NÃO**.
- **Detalhamento:**
  - A string `"administrador"` e suas variantes com acentuação aparecem estritamente como **labels visuais legíveis** em componentes de UI (`cargo: 'Administrador'`), comentários ou textos explicativos.
  - Como identificador técnico de papel, é utilizado exclusivamente `'admin'`, em conformidade direta com a chave primária da tabela `public.roles` e com a coluna `public.profiles.role`.

---

## 3. Verificação de 'receptor' como Role Técnico

- **Resultado:** **NÃO**.
- **Detalhamento:**
  - O termo `receptor` **não existe** no banco de dados, em migrations, em tipagens TypeScript (`src/types/`), contextos, serviços ou componentes visuais.

---

## 4. Tabelas e Referências Verificadas

A pesquisa automatizada confirmou que todas as entidades no código correspondem com 100% de exatidão aos nomes das 14 tabelas canônicas:

| Tabela Canônica | Presença no Código / Serviços | Status |
| :--- | :--- | :--- |
| `condominiums` | `condominiumService.ts`, `authService.ts`, `onboardingService.ts` | **OK** |
| `roles` | `rawSchema.ts`, `authService.ts`, `types/database.ts` | **OK** |
| `permissions` | `authService.ts`, `types/database.ts`, `types/auth.ts` | **OK** |
| `role_permissions` | `authService.ts` (`getPermissionsForRole`) | **OK** |
| `profiles` | `profileService.ts`, `authService.ts`, `onboardingService.ts` | **OK** |
| `units` | `unitService.ts`, `authService.ts` | **OK** |
| `unit_owners` | `unitService.ts`, `types/database.ts` | **OK** |
| `unit_residents` | `unitService.ts`, `authService.ts` | **OK** |
| `financial_entries`| `financialService.ts`, `types/database.ts` | **OK** |
| `maintenance_requests` | `maintenanceService.ts`, `types/database.ts` | **OK** |
| `announcements` | `announcementService.ts`, `types/database.ts` | **OK** |
| `documents` | `documentService.ts`, `types/database.ts` | **OK** |
| `assemblies` | `assemblyService.ts`, `types/database.ts` | **OK** |
| `activity_logs` | `activityLogService.ts`, `server.ts`, Edge Function | **OK** |

- **Termos incorretos verificados:**
  - `registros_de_atividade`: 0 ocorrências.
  - `permissoes_de_funcao` / `permissões_de_função`: 0 ocorrências.
  - `tenant` / `tenants` como nome de tabela: 0 ocorrências (a palavra `tenant` existe apenas como valor enum da coluna `relationship_type` em `unit_residents`, conforme modelagem canônica da Etapa 5).

---

## 5. Fluxo Real do Onboarding

1. **Início pelo Cliente Autenticado:**
   - O usuário acessa a aplicação após cadastro ou login via Supabase Auth.
   - O estado do usuário é avaliado pelo `AuthContext` como `NO_CONDOMINIUM` ou `PROFILE_MISSING`.
   - A interface renderiza o assistente de onboarding em `OnboardingPage.tsx`.

2. **Envio dos Dados Cadastrais:**
   - O formulário coleta exclusivamente dados cadastrais: `condominiumName`, `document` (CNPJ), `address`, `city`, `state`, `zipCode`, `phone`, `email`, `totalUnits` e `managerName`.
   - O frontend **não envia** valores de `role` e não realiza mutações manuais diretas nas tabelas de segurança.

3. **Execução no Backend Isolado:**
   - A chamada é enviada para a Supabase Edge Function (`/supabase/functions/onboarding`) ou para a API Server-Side local (`/api/onboarding`).
   - O backend extrai o Bearer Token do header `Authorization` e valida a sessão real do usuário via `supabase.auth.getUser(token)`.
   - O backend verifica se o perfil já possui condomínio cadastrado (bloqueando abusos).
   - O backend cria o registro na tabela `condominiums`.
   - O backend associa o perfil do usuário em `profiles` definindo `role = 'admin'` e `condominium_id = newCondominium.id`.
   - O backend insere uma trilha imutável de auditoria em `activity_logs`.
   - Retorna o condomínio e perfil criados para sincronização de estado na aplicação.

---

## 6. Onde Ocorre a Elevação para Admin

- **Localização:** **Exclusivamente Server-Side**.
  - No ambiente de produção Supabase: `supabase/functions/onboarding/index.ts` (linhas 119-140).
  - No servidor backend Express complementar: `server.ts` (linhas 82-100).
- **Garantia de Isolamento:**
  - O frontend **NÃO** executa `UPDATE profiles SET role = 'admin'` ou similar.
  - Triggers de banco de dados (`trg_protect_profile_changes`) barram qualquer tentativa de atualização direta de `role` ou `condominium_id` realizada pelo cliente com token anônimo.
  - A elevação só pode ocorrer através do contexto com credencial administrativa restrita no servidor.

---

## 7. Verificação de Chaves Secretas e Privilegiadas

- **Chaves Privilegiadas Procuradas:** `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEY`, `sb_secret_`, `service_role`.
- **Resultado:**
  - **Nenhuma chave privilegiada presente no frontend**, em código executado no navegador, em variáveis `VITE_*`, em `localStorage`, em `sessionStorage` ou em arquivos públicos.
  - A referência `SUPABASE_SERVICE_ROLE_KEY` existe estritamente em:
    1. `supabase/functions/onboarding/index.ts` (execução Deno na infraestrutura Supabase).
    2. `server.ts` (processo Node.js server-side, obtido via `process.env`).
    3. `.env.example` (documentação de variáveis de ambiente).

---

## 8. Fluxo de Autenticação e Prevenção de Condições de Corrida

O ciclo de autenticação em `AuthContext.tsx` opera em cadeia estritamente sequencial:

```
[onAuthStateChange / getSession]
              ↓
  [auth.getUser(userId)]
              ↓
  [authService.getProfile(userId)]
              ↓
  [Validação de Ativação: is_active === true]
              ↓
  [Validação de Condomínio: condominium_id !== null]
              ↓
  [Promise.all: getCondominium() + getPermissionsForRole()]
              ↓
  [setStatus('READY')]
```

- **Estados de Controle:**
  - `LOADING`: Exibe splash animado sem renderizar rotas protegidas antes da conclusão das consultas.
  - `UNAUTHENTICATED`: Redireciona imediatamente para a tela de autenticação (`LoginPage.tsx`).
  - `PROFILE_MISSING` / `NO_CONDOMINIUM`: Redireciona para visualização informativa / onboarding (`NoCondominiumView.tsx`).
  - `INACTIVE`: Redireciona para tela de bloqueio com orientações de contato com a administração (`InactiveUserView.tsx`).
  - `READY`: Libera acesso aos módulos permitidos pelo RBAC.

---

## 9. Fluxo de RBAC (Role-Based Access Control)

- As permissões granulares são consultadas diretamente da tabela `public.role_permissions` através de `authService.getPermissionsForRole(role)`.
- O hook `useAuth()` disponibiliza os métodos equivalentes:
  - `hasPermission(perm)` / `can(perm)`
  - `temPermissao(perm)` / `pode(perm)`
- Os métodos retornam `true` automaticamente para `'admin'` e `'sindico'` e avaliam a presença da chave de permissão na lista de permissões retornada pelo banco de dados para os demais papéis.
- A segurança real dos dados é garantida pelas 45 políticas de Row Level Security (RLS) e triggers anti-escalation aprovados na Etapa 5.

---

## 10. Rotas Protegidas e Estados de Acesso

| Rota / Visão | Usuário Não Autenticado | Sem Condomínio | Usuário Inativo | Morador / Conselho / Admin |
| :--- | :--- | :--- | :--- | :--- |
| `/login` | Exibido | Redireciona p/ App | Redireciona p/ Inativo | Redireciona p/ Dashboard |
| `/reset-password` | Exibido | Exibido (com hash) | Exibido (com hash) | Exibido (com hash) |
| `/onboarding` | Redireciona p/ Login | Exibido | Bloqueado | Redireciona p/ Dashboard |
| `/dashboard` | Redireciona p/ Login | Redireciona Onboarding | Exibe InactiveView | Renderiza conforme papel e permissões |
| Módulos Admin | Redireciona p/ Login | Redireciona Onboarding | Exibe InactiveView | Guard `hasPermission()` / tela 403 `UnauthorizedView` |

---

## 11. Resultado dos Testes de Tipagem e Compilação

1. **TypeScript (`npx tsc --noEmit`):**
   - **Resultado:** Executado com sucesso. Zero erros ou avisos de tipagem.

2. **Linter do Applet (`npm run lint`):**
   - **Resultado:** Concluído com sucesso (código 0).

3. **Build de Produção (`npm run build`):**
   - **Resultado:** Compilação do Vite + empacotamento do servidor executados com sucesso (código 0).

---

## 12. Correções Realizadas na Auditoria

1. **Unificação Estrita de `UserRole`:**
   - Removidos os tipos redundantes `'ADMIN' | 'MORADOR'` em `src/types/index.ts`.
   - Padronizado todo o código para utilizar estritamente `'admin' | 'sindico' | 'conselho' | 'morador'`.
2. **Métodos de Permissão no `useAuth()`:**
   - Adicionados formalmente os métodos `temPermissao()` e `pode()` como aliases de validação no `AuthContext` e na interface `AuthContextType`.
3. **Refatoração de Demonstração / Testes no Login:**
   - Removida injeção de senhas fixas no frontend. Em modo conectado ao Supabase, a seleção de perfis de referência apenas preenche o e-mail no formulário, exigindo autenticação legítima.
4. **Alinhamento de Rótulos vs. Valores Técnicos:**
   - Verificado que todos os componentes (`Header.tsx`, `LoginPage.tsx`, `ConfiguracoesPage.tsx`) comparam papéis técnicos utilizando os valores canônicos.
5. **Preservação Total do Banco de Dados:**
   - Nenhuma migration, tabela, política RLS, trigger ou função de banco de dados foi alterada, mantendo 100% intacta a Etapa 5 aprovada.

---

## STATUS FINAL DA AUDITORIA

**STATUS:** **APROVADA**
