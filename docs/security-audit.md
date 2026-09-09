# Relatório Completo de Segurança e Políticas RLS (Supabase PostgreSQL)

**Sistema:** Plataforma de Gestão Condominial  
**Status de Isolamento:** Multi-tenant estrito com Row Level Security (RLS)  
**Data da Auditoria:** 2026-09-01  

---

## 1. Arquitetura de Autenticação e Perfis

- **Autenticação:** Baseada no `auth.users` do Supabase.
- **Tabela de Perfis (`public.profiles`):**
  - Chave primária `id` referencia `auth.users.id` com `ON DELETE CASCADE`.
  - Contém `condominium_id` (UUID), `role` (TEXT), `full_name`, `email` e `is_active` (BOOLEAN).
- **Trigger de Auto-Criação de Perfil (`on_auth_user_created`):**
  - Disparado `AFTER INSERT` na tabela `auth.users`.
  - Executa a função `public.handle_new_auth_user()`.
  - Cria automaticamente o perfil com o papel padrão `'morador'` e `is_active = true`.

---

## 2. Funções `SECURITY DEFINER` de Suporte ao RLS

Para evitar recursão e garantir consultas com máxima performance em índices indexados:

1. **`public.get_auth_profile()`**: Retorna a linha do perfil autenticado pelo `auth.uid()`.
2. **`public.is_admin()`**: Retorna `true` se o usuário autenticado possui `role IN ('admin', 'sindico')` e `is_active = true`.
3. **`public.get_auth_condominium_id()`**: Retorna o `condominium_id` do usuário logado.
4. **`public.get_user_unit_ids()`**: Retorna os IDs das unidades autônomas vinculadas ao usuário autenticado (consultando `unit_residents` e `unit_owners`).

---

## 3. Matriz de Políticas RLS por Tabela

Todas as 14 tabelas possuem `ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;`.

### 3.1. `condominiums`
- **SELECT:** Usuários autenticados podem ver o próprio condomínio (`id = public.get_auth_condominium_id()` ou se for `admin`).
- **INSERT:** Usuários autenticados durante onboarding inicial ou administradores.
- **UPDATE:** Apenas Administradores do condomínio (`is_admin() AND id = get_auth_condominium_id()`).
- **DELETE:** Bloqueado via RLS (apenas superadmin do banco).

### 3.2. `roles`, `permissions`, `role_permissions`
- **SELECT:** Todos os usuários autenticados (catálogo de consulta do sistema).
- **INSERT / UPDATE / DELETE:** Apenas Administradores (`is_admin()`).

### 3.3. `profiles`
- **SELECT:** O próprio usuário (`id = auth.uid()`), usuários do mesmo condomínio (`condominium_id = get_auth_condominium_id()`) ou Administrador.
- **INSERT:** Disparado pelo trigger de auth ou administradores.
- **UPDATE:** O próprio usuário (dados pessoais) ou Administrador do condomínio (`is_admin()`).
- **DELETE:** Administrador do condomínio (`is_admin()`).

### 3.4. `units`
- **SELECT:** Membros do mesmo condomínio (`condominium_id = get_auth_condominium_id()`).
- **INSERT / UPDATE / DELETE:** Apenas Administradores do condomínio (`is_admin()`).

### 3.5. `unit_owners`
- **SELECT:**
  - Administradores (`is_admin()`).
  - Morador titular/residente da unidade (`unit_id IN (SELECT unit_id FROM get_user_unit_ids())`).
- **INSERT / UPDATE / DELETE:** Apenas Administradores do condomínio (`is_admin()`).

### 3.6. `unit_residents`
- **SELECT:**
  - Administradores (`is_admin()`).
  - Moradores da própria unidade (`unit_id IN (SELECT unit_id FROM get_user_unit_ids())`).
- **INSERT / UPDATE / DELETE:** Apenas Administradores do condomínio (`is_admin()`).

### 3.7. `financial_entries`
- **SELECT:**
  - Administradores do condomínio (`is_admin() AND condominium_id = get_auth_condominium_id()`).
  - Moradores: **Estritamente** os lançamentos da sua própria unidade (`unit_id IN (SELECT unit_id FROM get_user_unit_ids())`).
- **INSERT / UPDATE / DELETE:** Apenas Administradores do condomínio (`is_admin()`).

### 3.8. `maintenance_requests`
- **SELECT:**
  - Administradores do condomínio (`is_admin()`).
  - Moradores: Chamados abertos por eles (`requester_id = auth.uid()`), chamados da sua unidade (`unit_id IN (SELECT unit_id FROM get_user_unit_ids())`) ou chamados de áreas comuns (`unit_id IS NULL`).
- **INSERT:** Qualquer usuário autenticado no condomínio (`condominium_id = get_auth_condominium_id()`).
- **UPDATE / DELETE:** Administradores (`is_admin()`) ou o solicitante enquanto o chamado estiver aberto.

### 3.9. `announcements`
- **SELECT:**
  - Administradores: Todos do condomínio (incluindo rascunhos).
  - Moradores: Apenas comunicados com `status = 'published'` do seu condomínio.
- **INSERT / UPDATE / DELETE:** Apenas Administradores do condomínio (`is_admin()`).

### 3.10. `documents`
- **SELECT:**
  - Administradores: Todos os documentos do condomínio.
  - Moradores: Documentos com `visibility = 'all'` ou `visibility = 'council'` (se conselheiro). Documentos `admin_only` são estritamente ocultos.
- **INSERT / UPDATE / DELETE:** Apenas Administradores do condomínio (`is_admin()`).

### 3.11. `assemblies`
- **SELECT:** Todos os membros do mesmo condomínio (`condominium_id = get_auth_condominium_id()`).
- **INSERT / UPDATE / DELETE:** Apenas Administradores do condomínio (`is_admin()`).

### 3.12. `activity_logs`
- **SELECT:** Apenas Administradores do condomínio (`is_admin()`).
- **INSERT:** Todos os usuários autenticados para registrar ações de auditoria no seu condomínio.
- **UPDATE / DELETE:** Bloqueado (tabela append-only imutável para compliance).

---

## 4. Políticas de Supabase Storage (`storage.objects`)

| Bucket | Operação | Permissão | Regra de Verificação |
| :--- | :--- | :--- | :--- |
| `condominium_documents` | SELECT | Autenticado | Membro autenticado do condomínio |
| `condominium_documents` | INSERT / DELETE | Admin | `is_admin() = true` |
| `maintenance_attachments` | SELECT | Autenticado | Membro autenticado do condomínio |
| `maintenance_attachments` | INSERT | Autenticado | Usuário autenticado registrando chamado |
| `maintenance_attachments` | DELETE | Admin | `is_admin() = true` |
| `assembly_minutes` | SELECT | Autenticado | Membro autenticado do condomínio |
| `assembly_minutes` | INSERT / DELETE | Admin | `is_admin() = true` |

---

## 5. Garantia contra Violação de Acesso Cruzado (IDOR)

1. **Acesso Direto por URL/ID:**
   Mesmo que um morador de má-fé tente consultar ou alterar `/financial_entries/id-de-outro-morador`, a política RLS no PostgreSQL valida em nível de banco que `unit_id` pertença ao conjunto retornado por `get_user_unit_ids()`.
2. **Multi-Tenancy por Condomínio:**
   Todas as consultas agregadas possuem cláusula `condominium_id = public.get_auth_condominium_id()`, impedindo o vazamento de dados entre condomínios distintos gerenciados na mesma base.
