# Relatório de Consistência Técnica: SQL vs TypeScript vs Camada de Serviços

**Sistema:** Plataforma de Gestão Condominial  
**Status de Consistência:** 100% Sincronizado  
**Data da Verificação:** 2026-09-01  

---

## 1. Escopo da Comparação

Foi realizada a checagem cruzada entre os três pilares da arquitetura de dados do sistema:
1. **Definição de Banco:** `supabase/migrations/20260901000001_initial_schema.sql`
2. **Definições Tipadas do Supabase Client:** `src/types/database.ts`
3. **Módulos de Serviços:** `src/services/supabase/*.ts`

---

## 2. Matriz de Equivalência por Entidade

### 2.1. `condominiums`
- **SQL Table:** `public.condominiums`
- **Database Types Interface:** `Database['public']['Tables']['condominiums']` (`Row`, `Insert`, `Update`)
- **Service Module:** `src/services/supabase/condominiumService.ts`
- **Tabela Invocada:** `supabase.from('condominiums')`
- **Status:** Perfeita equivalência em todos os 12 campos (nomes, opcionais, tipos numéricos e textuais).

### 2.2. `roles`, `permissions`, `role_permissions`
- **SQL Tables:** `public.roles`, `public.permissions`, `public.role_permissions`
- **Database Types Interfaces:**
  - `Database['public']['Tables']['roles']`
  - `Database['public']['Tables']['permissions']`
  - `Database['public']['Tables']['role_permissions']`
- **Service Module:** Integrado em `src/services/supabase/profileService.ts`
- **Tabelas Invocadas:** `supabase.from('roles')`, `supabase.from('permissions')`, `supabase.from('role_permissions')`
- **Status:** 100% compatível.

### 2.3. `profiles`
- **SQL Table:** `public.profiles`
- **Database Types Interface:** `Database['public']['Tables']['profiles']`
- **Service Module:** `src/services/supabase/profileService.ts`
- **Tabela Invocada:** `supabase.from('profiles')`
- **Campos Mapeados:** `id`, `condominium_id`, `full_name`, `email`, `phone`, `avatar_url`, `role`, `is_active`, `created_at`, `updated_at`.
- **Status:** 100% compatível.

### 2.4. `units`, `unit_owners`, `unit_residents`
- **SQL Tables:** `public.units`, `public.unit_owners`, `public.unit_residents`
- **Database Types Interfaces:**
  - `Database['public']['Tables']['units']`
  - `Database['public']['Tables']['unit_owners']`
  - `Database['public']['Tables']['unit_residents']`
- **Service Module:** `src/services/supabase/unitService.ts`
- **Tabelas Invocadas:**
  - `supabase.from('units')`
  - `supabase.from('unit_owners')`
  - `supabase.from('unit_residents')`
- **Status:** Todos os enums (`unit_status`, `relationship_type`) e relacionamentos FK estão estritamente alinhados.

### 2.5. `financial_entries`
- **SQL Table:** `public.financial_entries`
- **Database Types Interface:** `Database['public']['Tables']['financial_entries']`
- **Service Module:** `src/services/supabase/financialService.ts`
- **Tabela Invocada:** `supabase.from('financial_entries')`
- **Campos Mapeados:** `id`, `condominium_id`, `unit_id`, `type`, `category`, `description`, `amount`, `due_date`, `payment_date`, `status`, `receipt_file_path`, `barcode`, `notes`, `created_at`, `updated_at`.
- **Status:** 100% compatível.

### 2.6. `maintenance_requests`
- **SQL Table:** `public.maintenance_requests`
- **Database Types Interface:** `Database['public']['Tables']['maintenance_requests']`
- **Service Module:** `src/services/supabase/maintenanceService.ts`
- **Tabela Invocada:** `supabase.from('maintenance_requests')`
- **Campos Especiais:** `attachments_file_paths` mapeado como `string[]` no TypeScript e `text[]` no SQL.
- **Status:** 100% compatível.

### 2.7. `announcements`
- **SQL Table:** `public.announcements`
- **Database Types Interface:** `Database['public']['Tables']['announcements']`
- **Service Module:** `src/services/supabase/announcementService.ts`
- **Tabela Invocada:** `supabase.from('announcements')`
- **Status:** 100% compatível.

### 2.8. `documents`
- **SQL Table:** `public.documents`
- **Database Types Interface:** `Database['public']['Tables']['documents']`
- **Service Module:** `src/services/supabase/documentService.ts`
- **Tabela Invocada:** `supabase.from('documents')`
- **Status:** 100% compatível.

### 2.9. `assemblies`
- **SQL Table:** `public.assemblies`
- **Database Types Interface:** `Database['public']['Tables']['assemblies']`
- **Service Module:** `src/services/supabase/assemblyService.ts`
- **Tabela Invocada:** `supabase.from('assemblies')`
- **Campos Especiais:** `agenda` tipado como `string[]` / `text[]`.
- **Status:** 100% compatível.

### 2.10. `activity_logs`
- **SQL Table:** `public.activity_logs`
- **Database Types Interface:** `Database['public']['Tables']['activity_logs']`
- **Service Module:** `src/services/supabase/activityLogService.ts`
- **Tabela Invocada:** `supabase.from('activity_logs')`
- **Campos Especiais:** `metadata` mapeado como `Record<string, unknown>` / `jsonb`.
- **Status:** 100% compatível.

---

## 3. Verificação dos Buckets de Armazenamento

- **SQL:** `storage.buckets` com IDs `condominium_documents`, `maintenance_attachments`, `assembly_minutes`.
- **TypeScript (`storageService.ts`):** `export type StorageBucket = 'condominium_documents' | 'maintenance_attachments' | 'assembly_minutes';`
- **Status:** Sincronizado.
