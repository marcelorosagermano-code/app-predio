-- ==============================================================================
-- SISTEMA DE GESTÃO CONDOMINIAL - CHECKLIST DE VALIDAÇÃO PÓS-EXECUÇÃO
-- ARQUIVO: docs/supabase-verification.sql
-- TIPO: Consultas SQL de Apenas Leitura (Read-Only)
-- VERSÃO: 4.4 (Validação Rigorosa de Roles e Preparação para Execução)
-- ==============================================================================
-- Execute estas consultas no SQL Editor do Supabase após rodar a migration inicial.
-- Nenhuma consulta abaixo altera ou exclui dados.
-- Todas as consultas retornam status EXPECTED, ACTUAL e STATUS (OK / FAIL).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PAINEL GERAL DE AUDITORIA E VALIDAÇÃO AUTOMATIZADA DE CONSISTÊNCIA
-- ------------------------------------------------------------------------------
with audit_counts as (
  select
    -- 1. Total de Tabelas no schema public
    (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE') as actual_tables,
    -- 2. Total de Tabelas com RLS Ativo
    (select count(*) from pg_tables where schemaname = 'public' and rowsecurity = true) as actual_rls_enabled,
    -- 3. Total de Funções Customizadas no schema public
    (select count(*) from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname in (
      'handle_updated_at', 'get_auth_profile', 'get_auth_condominium_id', 'is_admin', 
      'is_council_or_admin', 'get_user_unit_ids', 'handle_new_auth_user', 'protect_profile_changes'
    )) as actual_functions,
    -- 4. Funções com SECURITY DEFINER
    (select count(*) from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.prosecdef = true and p.proname in (
      'handle_updated_at', 'get_auth_profile', 'get_auth_condominium_id', 'is_admin', 
      'is_council_or_admin', 'get_user_unit_ids', 'handle_new_auth_user', 'protect_profile_changes'
    )) as actual_secdef_functions,
    -- 5. Funções com search_path seguro
    (select count(*) from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proconfig::text like '%search_path=public, pg_temp%' and p.proname in (
      'handle_updated_at', 'get_auth_profile', 'get_auth_condominium_id', 'is_admin', 
      'is_council_or_admin', 'get_user_unit_ids', 'handle_new_auth_user', 'protect_profile_changes'
    )) as actual_secure_searchpath,
    -- 6. Total de Triggers (10 em public para updated_at, 1 em profiles para proteção, 1 em auth.users para signup)
    (select count(*) from information_schema.triggers where event_object_schema = 'public') as actual_public_triggers,
    (select count(*) from information_schema.triggers where event_object_schema in ('public', 'auth') and trigger_name in (
      'set_condominiums_updated_at', 'set_profiles_updated_at', 'set_units_updated_at',
      'set_unit_owners_updated_at', 'set_unit_residents_updated_at', 'set_financial_entries_updated_at',
      'set_maintenance_requests_updated_at', 'set_announcements_updated_at', 'set_documents_updated_at',
      'set_assemblies_updated_at', 'trg_protect_profile_changes', 'on_auth_user_created'
    )) as actual_total_triggers,
    -- 7. Policies no Schema Public
    (select count(*) from pg_policies where schemaname = 'public') as actual_public_policies,
    -- 8. Policies no Schema Storage (objects)
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects') as actual_storage_policies,
    -- 9. Total de Roles Oficiais
    (select count(*) from public.roles where id in ('admin', 'sindico', 'conselho', 'morador')) as actual_roles,
    -- 10. Total de Permissões
    (select count(*) from public.permissions) as actual_permissions,
    -- 11. Total de Buckets Privados
    (select count(*) from storage.buckets where id in ('condominium_documents', 'maintenance_attachments', 'assembly_minutes') and public = false) as actual_buckets,
    -- 12. Total de Índices Customizados
    (select count(*) from pg_indexes where schemaname = 'public' and indexname like 'idx_%') as actual_custom_indexes
)
select 
  item,
  expected,
  actual,
  case when expected = actual then 'OK' else 'FAIL' end as status
from (
  select '1. Total de Tabelas (public)' as item, 14 as expected, actual_tables as actual from audit_counts
  union all
  select '2. Tabelas com RLS Habilitado', 14, actual_rls_enabled from audit_counts
  union all
  select '3. Funções Customizadas Criadas', 8, actual_functions from audit_counts
  union all
  select '4. Funções com SECURITY DEFINER', 8, actual_secdef_functions from audit_counts
  union all
  select '5. Funções com search_path blindado', 8, actual_secure_searchpath from audit_counts
  union all
  select '6. Total de Triggers Auditados', 12, actual_total_triggers from audit_counts
  union all
  select '7. Políticas RLS (public)', 45, actual_public_policies from audit_counts
  union all
  select '8. Políticas de Storage (storage.objects)', 7, actual_storage_policies from audit_counts
  union all
  select '9. Políticas RLS Totais (public + storage)', 52, actual_public_policies + actual_storage_policies from audit_counts
  union all
  select '10. Roles Oficiais (admin, sindico, conselho, morador)', 4, actual_roles from audit_counts
  union all
  select '11. Catálogo de Permissões (permissions)', 29, actual_permissions from audit_counts
  union all
  select '12. Buckets Privados do Storage', 3, actual_buckets from audit_counts
  union all
  select '13. Índices Customizados de Performance (idx_*)', 22, actual_custom_indexes from audit_counts
) summary;

-- ------------------------------------------------------------------------------
-- 2. DETALHAMENTO DE TABELAS E STATUS DO ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------
select 
  t.table_name,
  p.rowsecurity as rls_enabled,
  case when p.rowsecurity = true then 'OK' else 'FAIL' end as status,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = t.table_name) as column_count,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = t.table_name) as policy_count
from information_schema.tables t
join pg_tables p on p.schemaname = 'public' and p.tablename = t.table_name
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
order by t.table_name;

-- ------------------------------------------------------------------------------
-- 3. DETALHAMENTO DAS 45 POLÍTICAS RLS NO SCHEMA PUBLIC
-- ------------------------------------------------------------------------------
select 
  tablename as table_name,
  policyname as policy_name,
  cmd as command,
  roles,
  permissive,
  qual is not null as has_using,
  with_check is not null as has_check
from pg_policies
where schemaname = 'public'
order by tablename, cmd, policyname;

-- ------------------------------------------------------------------------------
-- 4. DETALHAMENTO DAS 7 POLÍTICAS DE SUPABASE STORAGE (BUCKETS PRIVADOS)
-- ------------------------------------------------------------------------------
select 
  policyname as policy_name,
  cmd as command,
  roles,
  qual is not null as has_using,
  with_check is not null as has_check
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd, policyname;

-- ------------------------------------------------------------------------------
-- 5. DETALHAMENTO DAS 8 FUNÇÕES DE SEGURANÇA E SEARCH_PATH
-- ------------------------------------------------------------------------------
select 
  p.proname as function_name,
  p.prosecdef as is_security_definer,
  p.proconfig as execution_config,
  case 
    when p.prosecdef = true and p.proconfig::text like '%search_path=public, pg_temp%' then 'OK'
    else 'FAIL'
  end as security_status,
  pg_get_function_result(p.oid) as return_type
from pg_proc p
join pg_namespace n on p.pronamespace = n.oid
where n.nspname = 'public' 
  and p.proname in (
    'handle_updated_at', 'get_auth_profile', 'get_auth_condominium_id', 'is_admin', 
    'is_council_or_admin', 'get_user_unit_ids', 'handle_new_auth_user', 'protect_profile_changes'
  )
order by p.proname;

-- ------------------------------------------------------------------------------
-- 6. DETALHAMENTO DOS 12 TRIGGERS
-- ------------------------------------------------------------------------------
select 
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation as event,
  action_statement
from information_schema.triggers
where event_object_schema in ('public', 'auth')
  and trigger_name in (
    'set_condominiums_updated_at', 'set_profiles_updated_at', 'set_units_updated_at',
    'set_unit_owners_updated_at', 'set_unit_residents_updated_at', 'set_financial_entries_updated_at',
    'set_maintenance_requests_updated_at', 'set_announcements_updated_at', 'set_documents_updated_at',
    'set_assemblies_updated_at', 'trg_protect_profile_changes', 'on_auth_user_created'
  )
order by event_object_table, trigger_name;

-- ------------------------------------------------------------------------------
-- 7. DETALHAMENTO DOS ÍNDICES CUSTOMIZADOS (22 ÍNDICES)
-- ------------------------------------------------------------------------------
select 
  tablename as table_name,
  indexname as index_name,
  indexdef as definition
from pg_indexes
where schemaname = 'public' and indexname like 'idx_%'
order by tablename, indexname;

-- ------------------------------------------------------------------------------
-- 8. CATÁLOGO DE ROLES (4 OFICIAIS) E DETECÇÃO DE VALORES INESPERADOS
-- ------------------------------------------------------------------------------
select 
  id as role_id,
  name as role_name,
  description,
  case 
    when id in ('admin', 'sindico', 'conselho', 'morador') then 'OK (OFICIAL)'
    else 'FAIL (INESPERADO)'
  end as role_status
from public.roles
order by id;

-- Verificação de integridade estrita de roles (deve retornar exatamente 0 roles inválidos)
select 
  'Contagem de Roles Inválidos / Não Oficiais' as check_item,
  0 as expected_invalid_roles,
  count(*) as actual_invalid_roles,
  case when count(*) = 0 then 'OK' else 'FAIL' end as status
from public.roles
where id not in ('admin', 'sindico', 'conselho', 'morador');

-- ------------------------------------------------------------------------------
-- 9. PERMISSÕES AGRUPADAS POR MÓDULO (29 PERMISSÕES)
-- ------------------------------------------------------------------------------
select 
  module,
  count(*) as total_permissions,
  string_agg(id, ', ' order by id) as permissions_list
from public.permissions
group by module
order by module;

-- ------------------------------------------------------------------------------
-- 10. MATRIZ DE PERMISSÕES POR CARGO (ROLE_PERMISSIONS)
-- ------------------------------------------------------------------------------
select 
  r.id as role_id,
  r.name as role_name,
  count(rp.permission_id) as total_permissions,
  case 
    when r.id = 'admin' and count(rp.permission_id) = 29 then 'OK'
    when r.id = 'sindico' and count(rp.permission_id) = 29 then 'OK'
    when r.id = 'conselho' and count(rp.permission_id) = 9 then 'OK'
    when r.id = 'morador' and count(rp.permission_id) = 8 then 'OK'
    else 'FAIL'
  end as status
from public.roles r
left join public.role_permissions rp on r.id = rp.role_id
group by r.id, r.name
order by total_permissions desc;

-- ------------------------------------------------------------------------------
-- 11. BUCKETS PRIVADOS DO SUPABASE STORAGE (3 BUCKETS)
-- ------------------------------------------------------------------------------
select 
  id as bucket_id,
  name,
  public as is_public,
  case when public = false then 'OK' else 'FAIL' end as privacy_status,
  file_size_limit / (1024 * 1024) as max_size_mb,
  allowed_mime_types
from storage.buckets
where id in ('condominium_documents', 'maintenance_attachments', 'assembly_minutes')
order by id;
