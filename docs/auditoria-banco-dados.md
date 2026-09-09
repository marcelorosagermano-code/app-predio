# Relatório Completo de Auditoria da Base de Dados (Supabase PostgreSQL)

**Sistema:** Plataforma de Gestão Condominial  
**Etapa:** 3.1 — Pacote Completo de Documentação e Auditoria Técnica  
**Data:** 2026-09-01  
**Status da Auditoria:** Concluída com Sucesso  
**Ações Remotas no Supabase:** Nenhuma migration executada remotamente (apenas validação local).

---

## 1. Objetivo da Auditoria

Validar rigorosamente a integridade estrutural, nomenclatura técnica, regras de segurança em nível de linha (Row Level Security - RLS), integridade referencial (FKs), automações via triggers e a compatibilidade tipada com a camada de código TypeScript da aplicação antes da aplicação de migrations em produção.

---

## 2. Estrutura Definitiva e Contagem de Tabelas

A base de dados do sistema é composta por **exatamente 14 tabelas**, estruturadas em PostgreSQL com nomenclatura padronizada em **inglês técnico** (`snake_case`):

1. `condominiums` (Cadastro do Condomínio / Tenant Raiz)
2. `roles` (Perfis de Acesso do Sistema)
3. `permissions` (Catálogo de Permissões de Módulos)
4. `role_permissions` (Tabela Associativa N:N de Perfis e Permissões)
5. `profiles` (Perfis de Usuários vinculados a `auth.users`)
6. `units` (Unidades Autônomas)
7. `unit_owners` (Proprietários Titulares)
8. `unit_residents` (Moradores e Inquilinos)
9. `financial_entries` (Lançamentos Financeiros: Receitas e Despesas)
10. `maintenance_requests` (Chamados e Ordens de Serviço de Manutenção)
11. `announcements` (Mural de Comunicados e Avisos)
12. `documents` (Repositório de Metadados de Documentos Oficiais)
13. `assemblies` (Assembleias Gerais, Pautas e Atas)
14. `activity_logs` (Trilha de Auditoria e Logs do Sistema)

---

## 3. Especificação Completa das Tabelas

### 3.1. `condominiums`
- **Finalidade:** Armazenar os dados institucionais do condomínio.
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `name` text not null
  - `document` text
  - `address` text not null
  - `city` text not null
  - `state` text not null
  - `zip_code` text
  - `phone` text
  - `email` text
  - `total_units` integer not null default 0
  - `created_at` timestamptz not null default `timezone('utc'::text, now())`
  - `updated_at` timestamptz not null default `timezone('utc'::text, now())`
- **FKs:** Nenhuma.
- **Índices:** PK em `id`.
- **Triggers:** `set_condominiums_updated_at` (executa `public.handle_updated_at()`).

### 3.2. `roles`
- **Finalidade:** Armazenar os papéis do sistema (`admin`, `sindico`, `conselho`, `morador`).
- **PK:** `id` (TEXT)
- **Colunas:** `id` text PK, `name` text not null, `description` text, `created_at` timestamptz.
- **FKs:** Nenhuma.

### 3.3. `permissions`
- **Finalidade:** Catálogo de permissões granulares do sistema.
- **PK:** `id` (TEXT)
- **Colunas:** `id` text PK, `name` text not null, `module` text not null, `description` text.
- **FKs:** Nenhuma.

### 3.4. `role_permissions`
- **Finalidade:** Relação N:N entre perfis de usuário e permissões concedidas.
- **PK Composta:** `(role_id, permission_id)`
- **FKs:**
  - `role_id` REFERENCES `public.roles(id)` ON DELETE CASCADE
  - `permission_id` REFERENCES `public.permissions(id)` ON DELETE CASCADE

### 3.5. `profiles`
- **Finalidade:** Dados do perfil associados à conta de autenticação `auth.users`.
- **PK:** `id` (UUID que referencia `auth.users(id)`).
- **Colunas:**
  - `id` uuid PK REFERENCES `auth.users(id)` ON DELETE CASCADE
  - `condominium_id` uuid REFERENCES `public.condominiums(id)` ON DELETE SET NULL
  - `full_name` text not null
  - `email` text not null
  - `phone` text
  - `avatar_url` text
  - `role` text not null default 'morador' REFERENCES `public.roles(id)`
  - `is_active` boolean not null default true
  - `created_at` timestamptz not null default `timezone('utc'::text, now())`
  - `updated_at` timestamptz not null default `timezone('utc'::text, now())`
- **Índices:** `idx_profiles_condominium_id`, `idx_profiles_role`.
- **Triggers:** `set_profiles_updated_at`.

### 3.6. `units`
- **Finalidade:** Registro de unidades autônomas (apartamentos, casas, lojas).
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `condominium_id` uuid not null REFERENCES `public.condominiums(id)` ON DELETE CASCADE
  - `unit_number` text not null
  - `block` text
  - `floor` integer
  - `sqm` numeric(8,2)
  - `ideal_fraction` numeric(8,6)
  - `status` text not null default 'occupied' CHECK (`status` in ('occupied', 'vacant', 'rented', 'under_renovation'))
  - `created_at` timestamptz, `updated_at` timestamptz
- **Constraints:** `UNIQUE (condominium_id, unit_number, block)`.
- **Índices:** `idx_units_condominium_id`.
- **Triggers:** `set_units_updated_at`.

### 3.7. `unit_owners`
- **Finalidade:** Proprietários registrados de cada unidade autônoma.
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `unit_id` uuid not null REFERENCES `public.units(id)` ON DELETE CASCADE
  - `profile_id` uuid REFERENCES `public.profiles(id)` ON DELETE SET NULL
  - `name` text not null
  - `email` text
  - `phone` text
  - `document` text
  - `is_primary` boolean not null default true
  - `created_at` timestamptz, `updated_at` timestamptz
- **Índices:** `idx_unit_owners_unit_id`.
- **Triggers:** `set_unit_owners_updated_at`.

### 3.8. `unit_residents`
- **Finalidade:** Moradores, locatários e dependentes residentes na unidade.
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `unit_id` uuid not null REFERENCES `public.units(id)` ON DELETE CASCADE
  - `profile_id` uuid REFERENCES `public.profiles(id)` ON DELETE SET NULL
  - `name` text not null
  - `email` text
  - `phone` text
  - `relationship_type` text not null default 'tenant' CHECK (`relationship_type` in ('owner', 'tenant', 'family_member', 'dependent', 'other'))
  - `is_primary` boolean not null default false
  - `created_at` timestamptz, `updated_at` timestamptz
- **Índices:** `idx_unit_residents_unit_id`, `idx_unit_residents_profile_id`.
- **Triggers:** `set_unit_residents_updated_at`.

### 3.9. `financial_entries`
- **Finalidade:** Registro de lançamentos financeiros (taxas condominiais, multas, despesas operacionais).
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `condominium_id` uuid not null REFERENCES `public.condominiums(id)` ON DELETE CASCADE
  - `unit_id` uuid REFERENCES `public.units(id)` ON DELETE SET NULL
  - `type` text not null CHECK (`type` in ('income', 'expense'))
  - `category` text not null
  - `description` text not null
  - `amount` numeric(12,2) not null CHECK (`amount` >= 0)
  - `due_date` date not null
  - `payment_date` date
  - `status` text not null default 'pending' CHECK (`status` in ('pending', 'paid', 'overdue', 'cancelled'))
  - `receipt_file_path` text
  - `barcode` text
  - `notes` text
  - `created_at` timestamptz, `updated_at` timestamptz
- **Índices:** `idx_financial_condominium_id`, `idx_financial_unit_id`, `idx_financial_status`, `idx_financial_due_date`.
- **Triggers:** `set_financial_entries_updated_at`.

### 3.10. `maintenance_requests`
- **Finalidade:** Abertura e controle de chamados de manutenção predial e preventiva.
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `condominium_id` uuid not null REFERENCES `public.condominiums(id)` ON DELETE CASCADE
  - `unit_id` uuid REFERENCES `public.units(id)` ON DELETE SET NULL
  - `requester_id` uuid REFERENCES `public.profiles(id)` ON DELETE SET NULL
  - `title` text not null
  - `description` text not null
  - `location` text not null
  - `priority` text not null default 'medium' CHECK (`priority` in ('low', 'medium', 'high', 'urgent'))
  - `status` text not null default 'open' CHECK (`status` in ('open', 'in_progress', 'completed', 'cancelled'))
  - `assigned_to` text
  - `estimated_cost` numeric(10,2)
  - `actual_cost` numeric(10,2)
  - `opened_at` date not null default current_date
  - `completed_at` date
  - `attachments_file_paths` text[] default '{}'
  - `notes` text
  - `created_at` timestamptz, `updated_at` timestamptz
- **Índices:** `idx_maintenance_condominium_id`, `idx_maintenance_unit_id`, `idx_maintenance_requester`, `idx_maintenance_status`.
- **Triggers:** `set_maintenance_requests_updated_at`.

### 3.11. `announcements`
- **Finalidade:** Mural de comunicados, informativos e avisos urgentes.
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `condominium_id` uuid not null REFERENCES `public.condominiums(id)` ON DELETE CASCADE
  - `author_id` uuid REFERENCES `public.profiles(id)` ON DELETE SET NULL
  - `title` text not null
  - `content` text not null
  - `category` text not null default 'general' CHECK (`category` in ('general', 'urgent', 'maintenance', 'works', 'meeting', 'financial'))
  - `status` text not null default 'published' CHECK (`status` in ('draft', 'published', 'archived'))
  - `is_pinned` boolean not null default false
  - `published_at` timestamptz default timezone('utc'::text, now())
  - `created_at` timestamptz, `updated_at` timestamptz
- **Índices:** `idx_announcements_condominium_id`, `idx_announcements_status`.
- **Triggers:** `set_announcements_updated_at`.

### 3.12. `documents`
- **Finalidade:** Catálogo de arquivos oficiais (regimentos, convenções, contratos, balancetes).
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `condominium_id` uuid not null REFERENCES `public.condominiums(id)` ON DELETE CASCADE
  - `title` text not null
  - `description` text
  - `category` text not null CHECK (`category` in ('regulations', 'minutes', 'financial_reports', 'contracts', 'notices', 'other'))
  - `file_path` text not null
  - `file_name` text not null
  - `file_type` text not null
  - `file_size` bigint not null
  - `visibility` text not null default 'all' CHECK (`visibility` in ('all', 'admin_only', 'council'))
  - `uploaded_by` uuid REFERENCES `public.profiles(id)` ON DELETE SET NULL
  - `created_at` timestamptz, `updated_at` timestamptz
- **Índices:** `idx_documents_condominium_id`, `idx_documents_visibility`.
- **Triggers:** `set_documents_updated_at`.

### 3.13. `assemblies`
- **Finalidade:** Convocação, pautas, links de reunião e atas de assembleias condominiais.
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `condominium_id` uuid not null REFERENCES `public.condominiums(id)` ON DELETE CASCADE
  - `title` text not null
  - `type` text not null default 'ordinary' CHECK (`type` in ('ordinary', 'extraordinary'))
  - `format` text not null default 'presential' CHECK (`format` in ('presential', 'virtual', 'hybrid'))
  - `date` timestamptz not null
  - `location` text not null
  - `agenda` text[] not null default '{}'
  - `meeting_url` text
  - `minutes_file_path` text
  - `status` text not null default 'scheduled' CHECK (`status` in ('scheduled', 'in_progress', 'completed', 'cancelled'))
  - `created_at` timestamptz, `updated_at` timestamptz
- **Índices:** `idx_assemblies_condominium_id`, `idx_assemblies_status`.
- **Triggers:** `set_assemblies_updated_at`.

### 3.14. `activity_logs`
- **Finalidade:** Trilha de auditoria para ações executadas no condomínio.
- **PK:** `id` (UUID default `gen_random_uuid()`)
- **Colunas:**
  - `id` uuid PK
  - `condominium_id` uuid not null REFERENCES `public.condominiums(id)` ON DELETE CASCADE
  - `user_id` uuid REFERENCES `public.profiles(id)` ON DELETE SET NULL
  - `action` text not null
  - `entity_type` text not null
  - `entity_id` text
  - `description` text not null
  - `metadata` jsonb default '{}'::jsonb
  - `created_at` timestamptz not null default `timezone('utc'::text, now())`
- **Índices:** `idx_activity_logs_condominium_id`, `idx_activity_logs_created_at`.

---

## 4. Funções de Segurança e Triggers

| Função | Retorno | Segurança | Propósito |
| :--- | :--- | :--- | :--- |
| `public.handle_updated_at()` | `trigger` | `security definer` | Atualiza automaticamente `updated_at` no UTC |
| `public.get_auth_profile()` | `public.profiles` | `security definer stable` | Retorna o registro completo do perfil autenticado (`auth.uid()`) |
| `public.is_admin()` | `boolean` | `security definer stable` | Retorna `true` se `role IN ('admin', 'sindico')` e `is_active = true` |
| `public.get_auth_condominium_id()` | `uuid` | `security definer stable` | Retorna o `condominium_id` do usuário conectado |
| `public.get_user_unit_ids()` | `table(unit_id uuid)`| `security definer stable` | Retorna todas as unidades do morador via `unit_residents` e `unit_owners` |
| `public.handle_new_auth_user()` | `trigger` | `security definer` | Auto-cadastra o usuário em `public.profiles` quando criado em `auth.users` |

---

## 5. Storage Buckets e Regras de Armazenamento

Os buckets foram definidos em formato privado (`public = false`):

1. **`condominium_documents`** (20MB): PDF, DOCX, DOC, JPEG, PNG.
   - Leitura: Usuários autenticados do condomínio.
   - Upload / Exclusão: Apenas administradores (`is_admin()`).
2. **`maintenance_attachments`** (10MB): JPEG, PNG, WEBP, PDF.
   - Leitura: Usuários autenticados do condomínio.
   - Upload: Moradores e Administradores.
   - Exclusão: Apenas administradores.
3. **`assembly_minutes`** (20MB): PDF.
   - Leitura: Usuários autenticados do condomínio.
   - Upload / Exclusão: Apenas administradores.

---

## 6. Inconsistências Identificadas e Corrigidas

1. **Padronização dos Buckets de Storage:**
   - *Anterior:* Havia ocorrências misturadas com hífen (`condo-documents`, `maintenance-attachments`, `assembly-minutes`).
   - *Corrigido:* Todos os identificadores de buckets foram padronizados para `snake_case` (`condominium_documents`, `maintenance_attachments`, `assembly_minutes`) no SQL, TypeScript e UI.
2. **Harmonização do Script SQL:**
   - A migration `supabase/migrations/20260901000001_initial_schema.sql`, o script `src/services/supabase/schema.sql` e a constante exportada `src/services/supabase/rawSchema.ts` estão 100% alinhados.
3. **Contagem de Tabelas no Inventário:**
   - O número exato foi consolidado em **14 tabelas** em todos os documentos.

---

## 7. Status de Validação e Conclusão

- **TypeScript Typecheck (`tsc --noEmit`):** 0 erros.
- **Build de Produção (`npm run build`):** Compilação executada com sucesso.
- **Prontidão:** A base de dados e a arquitetura TypeScript estão prontas para a criação dos módulos funcionais assim que autorizado.
- **Garantia:** Nenhuma alteração foi realizada remotamente no Supabase.
