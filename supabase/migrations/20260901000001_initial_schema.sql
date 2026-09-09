-- ==============================================================================
-- SISTEMA DE GESTÃO CONDOMINIAL - ETAPA 4.4: SCHEMA DEFINITIVO AUDITADO
-- ARQUIVO: supabase/migrations/20260901000001_initial_schema.sql
-- BANCO DE DADOS: PostgreSQL / Supabase
-- VERSÃO: 4.4 (Validação Rigorosa de Roles e Preparação para Execução)
-- ==============================================================================

-- 1. EXTENSÕES DO POSTGRESQL
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. FUNÇÃO BASE DE ATUALIZAÇÃO AUTOMÁTICA DE TIMESTAMP (UTC)
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- 3. TABELAS DE RBAC: ROLES, PERMISSIONS E ROLE_PERMISSIONS
create table if not exists public.roles (
  id text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.permissions (
  id text primary key,
  name text not null,
  module text not null,
  description text
);

create table if not exists public.role_permissions (
  role_id text references public.roles(id) on delete cascade not null,
  permission_id text references public.permissions(id) on delete cascade not null,
  primary key (role_id, permission_id)
);

-- 4. CONDOMINIUMS (TENANT RAIZ)
create table if not exists public.condominiums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  address text not null,
  city text not null,
  state text not null,
  zip_code text,
  phone text,
  email text,
  total_units integer not null default 0,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint condominiums_total_units_check check (total_units >= 0)
);

drop trigger if exists set_condominiums_updated_at on public.condominiums;
create trigger set_condominiums_updated_at
  before update on public.condominiums
  for each row execute function public.handle_updated_at();

-- 5. PROFILES (VINCULADO AO AUTH.USERS DO SUPABASE)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  condominium_id uuid references public.condominiums(id) on delete set null,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  role text not null default 'morador' references public.roles(id),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

-- 6. UNITS (UNIDADES AUTÔNOMAS)
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  unit_number text not null,
  block text,
  floor integer,
  sqm numeric(8,2),
  ideal_fraction numeric(8,6),
  status text not null default 'occupied' check (status in ('occupied', 'vacant', 'rented', 'under_renovation')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint units_condominium_number_block_unique unique (condominium_id, unit_number, block)
);

drop trigger if exists set_units_updated_at on public.units;
create trigger set_units_updated_at
  before update on public.units
  for each row execute function public.handle_updated_at();

-- 7. UNIT OWNERS & RESIDENTS (PROPRIETÁRIOS E MORADORES)
create table if not exists public.unit_owners (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  document text,
  is_primary boolean not null default true,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_unit_owners_updated_at on public.unit_owners;
create trigger set_unit_owners_updated_at
  before update on public.unit_owners
  for each row execute function public.handle_updated_at();

create table if not exists public.unit_residents (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  phone text,
  relationship_type text not null default 'tenant' check (relationship_type in ('owner', 'tenant', 'family_member', 'dependent', 'other')),
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_unit_residents_updated_at on public.unit_residents;
create trigger set_unit_residents_updated_at
  before update on public.unit_residents
  for each row execute function public.handle_updated_at();

-- 8. FINANCIAL ENTRIES (RECEITAS E DESPESAS)
create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  payment_date date,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue', 'cancelled')),
  receipt_file_path text,
  barcode text,
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_financial_entries_updated_at on public.financial_entries;
create trigger set_financial_entries_updated_at
  before update on public.financial_entries
  for each row execute function public.handle_updated_at();

-- 9. MAINTENANCE REQUESTS (ORDENS DE SERVIÇO E CHAMADOS)
create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  requester_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text not null,
  location text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  assigned_to text,
  estimated_cost numeric(10,2),
  actual_cost numeric(10,2),
  opened_at date not null default current_date,
  completed_at date,
  attachments_file_paths text[] default '{}',
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_maintenance_requests_updated_at on public.maintenance_requests;
create trigger set_maintenance_requests_updated_at
  before update on public.maintenance_requests
  for each row execute function public.handle_updated_at();

-- 10. ANNOUNCEMENTS (MURAL DE COMUNICADOS)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null,
  content text not null,
  category text not null default 'general' check (category in ('general', 'urgent', 'maintenance', 'works', 'meeting', 'financial')),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  is_pinned boolean not null default false,
  published_at timestamptz default timezone('utc'::text, now()),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_announcements_updated_at on public.announcements;
create trigger set_announcements_updated_at
  before update on public.announcements
  for each row execute function public.handle_updated_at();

-- 11. DOCUMENTS (REPOSITÓRIO DE DOCUMENTOS)
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  title text not null,
  description text,
  category text not null check (category in ('regulations', 'minutes', 'financial_reports', 'contracts', 'notices', 'other')),
  file_path text not null,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  visibility text not null default 'all' check (visibility in ('all', 'admin_only', 'council')),
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();

-- 12. ASSEMBLIES (ASSEMBLEIAS E ATAS)
create table if not exists public.assemblies (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  title text not null,
  type text not null default 'ordinary' check (type in ('ordinary', 'extraordinary')),
  format text not null default 'presential' check (format in ('presential', 'virtual', 'hybrid')),
  date timestamptz not null,
  location text not null,
  agenda text[] not null default '{}',
  meeting_url text,
  minutes_file_path text,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

drop trigger if exists set_assemblies_updated_at on public.assemblies;
create trigger set_assemblies_updated_at
  before update on public.assemblies
  for each row execute function public.handle_updated_at();

-- 13. ACTIVITY LOGS (TRILHA DE AUDITORIA IMUTÁVEL)
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  condominium_id uuid not null references public.condominiums(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  description text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

-- 14. ÍNDICES DE PERFORMANCE E CONSULTAS MULTI-TENANT
create index if not exists idx_profiles_condominium_id on public.profiles(condominium_id);
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_units_condominium_id on public.units(condominium_id);
create index if not exists idx_unit_owners_unit_id on public.unit_owners(unit_id);
create index if not exists idx_unit_residents_unit_id on public.unit_residents(unit_id);
create index if not exists idx_unit_residents_profile_id on public.unit_residents(profile_id);
create index if not exists idx_financial_condominium_id on public.financial_entries(condominium_id);
create index if not exists idx_financial_unit_id on public.financial_entries(unit_id);
create index if not exists idx_financial_status on public.financial_entries(status);
create index if not exists idx_financial_due_date on public.financial_entries(due_date);
create index if not exists idx_maintenance_condominium_id on public.maintenance_requests(condominium_id);
create index if not exists idx_maintenance_unit_id on public.maintenance_requests(unit_id);
create index if not exists idx_maintenance_requester on public.maintenance_requests(requester_id);
create index if not exists idx_maintenance_status on public.maintenance_requests(status);
create index if not exists idx_announcements_condominium_id on public.announcements(condominium_id);
create index if not exists idx_announcements_status on public.announcements(status);
create index if not exists idx_documents_condominium_id on public.documents(condominium_id);
create index if not exists idx_documents_visibility on public.documents(visibility);
create index if not exists idx_assemblies_condominium_id on public.assemblies(condominium_id);
create index if not exists idx_assemblies_status on public.assemblies(status);
create index if not exists idx_activity_logs_condominium_id on public.activity_logs(condominium_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);

-- 15. SEED DE ROLES E PERMISSÕES INICIAIS
insert into public.roles (id, name, description) values
  ('admin', 'Administrador / Síndico', 'Acesso total à gestão administrativa e financeira do condomínio'),
  ('sindico', 'Síndico', 'Gestão operacional e administrativa'),
  ('conselho', 'Conselho Fiscal', 'Acesso consultivo a finanças, relatórios e atas'),
  ('morador', 'Morador / Proprietário', 'Acesso aos dados da própria unidade, comunicados, manutenções e assembleias')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.permissions (id, name, module, description) values
  ('dashboard:view', 'Visualizar Dashboard', 'dashboard', 'Acessar indicadores gerais'),
  ('units:view', 'Visualizar Unidades', 'units', 'Consultar mapa e lista de unidades'),
  ('units:create', 'Cadastrar Unidade', 'units', 'Criar novas unidades no condomínio'),
  ('units:update', 'Editar Unidade', 'units', 'Atualizar dados cadastrais de unidades'),
  ('units:delete', 'Excluir Unidade', 'units', 'Remover unidades do condomínio'),
  ('financial:view_all', 'Visualizar Todo Financeiro', 'financial', 'Ver fluxo de caixa e todas as unidades'),
  ('financial:view_own', 'Visualizar Próprio Financeiro', 'financial', 'Ver débitos e pagamentos da própria unidade'),
  ('financial:create', 'Lançar Financeiro', 'financial', 'Cadastrar receitas e despesas'),
  ('financial:update', 'Editar Financeiro', 'financial', 'Alterar dados de lançamentos e dar baixa'),
  ('financial:delete', 'Excluir Financeiro', 'financial', 'Remover lançamentos financeiros'),
  ('maintenance:view_all', 'Visualizar Todas Manutenções', 'maintenance', 'Ver todas as ordens de serviço'),
  ('maintenance:view_own', 'Visualizar Próprias Manutenções', 'maintenance', 'Ver chamados da sua unidade ou áreas comuns'),
  ('maintenance:create', 'Abrir Chamado', 'maintenance', 'Solicitar manutenção'),
  ('maintenance:update', 'Gerenciar Manutenções', 'maintenance', 'Atribuir responsáveis, atualizar status e custos'),
  ('maintenance:delete', 'Excluir Manutenções', 'maintenance', 'Remover chamados de manutenção'),
  ('announcements:view', 'Visualizar Comunicados', 'announcements', 'Ler avisos publicados'),
  ('announcements:create', 'Criar Comunicados', 'announcements', 'Criar e publicar avisos aos moradores'),
  ('announcements:update', 'Editar Comunicados', 'announcements', 'Alterar e fixar comunicados'),
  ('announcements:delete', 'Excluir Comunicados', 'announcements', 'Remover comunicados'),
  ('documents:view_public', 'Visualizar Documentos Públicos', 'documents', 'Acessar regimento, convenção e atas públicas'),
  ('documents:view_admin', 'Visualizar Documentos Administrativos', 'documents', 'Acessar contratos e relatórios fiscais'),
  ('documents:create', 'Fazer Upload de Documentos', 'documents', 'Inserir novos documentos oficiais'),
  ('documents:delete', 'Excluir Documentos', 'documents', 'Remover arquivos do repositório'),
  ('assemblies:view', 'Visualizar Assembleias', 'assemblies', 'Consultar convocações e atas'),
  ('assemblies:create', 'Criar Assembleias', 'assemblies', 'Criar assembleias e pautas'),
  ('assemblies:update', 'Gerenciar Assembleias', 'assemblies', 'Atualizar status e publicar atas'),
  ('assemblies:delete', 'Excluir Assembleias', 'assemblies', 'Remover assembleias'),
  ('settings:view', 'Visualizar Configurações', 'settings', 'Ver dados do condomínio'),
  ('settings:update', 'Gerenciar Configurações', 'settings', 'Alterar dados cadastrais e permissões')
on conflict (id) do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select 'admin', id from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'sindico', id from public.permissions
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'conselho', id from public.permissions
where id in (
  'dashboard:view',
  'units:view',
  'financial:view_all',
  'maintenance:view_all',
  'announcements:view',
  'documents:view_public',
  'documents:view_admin',
  'assemblies:view',
  'settings:view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'morador', id from public.permissions
where id in (
  'dashboard:view',
  'financial:view_own',
  'maintenance:view_own',
  'maintenance:create',
  'announcements:view',
  'documents:view_public',
  'assemblies:view',
  'settings:view'
)
on conflict do nothing;

-- 16. FUNÇÕES DE SEGURANÇA AUXILIARES (SECURITY DEFINER COM SEARCH_PATH PROTEGIDO)
create or replace function public.get_auth_profile()
returns public.profiles as $$
  select * from public.profiles
  where id = auth.uid() and is_active = true
  limit 1;
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function public.get_auth_condominium_id()
returns uuid as $$
  select condominium_id from public.profiles
  where id = auth.uid() and is_active = true
  limit 1;
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'sindico')
      and is_active = true
      and condominium_id is not null
  );
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function public.is_council_or_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'sindico', 'conselho')
      and is_active = true
      and condominium_id is not null
  );
$$ language sql security definer stable set search_path = public, pg_temp;

create or replace function public.get_user_unit_ids()
returns table(unit_id uuid) as $$
  select u.id as unit_id
  from public.units u
  inner join public.unit_residents ur on ur.unit_id = u.id
  where ur.profile_id = auth.uid()
    and u.condominium_id = public.get_auth_condominium_id()
  union
  select u.id as unit_id
  from public.units u
  inner join public.unit_owners uo on uo.unit_id = u.id
  where uo.profile_id = auth.uid()
    and u.condominium_id = public.get_auth_condominium_id();
$$ language sql security definer stable set search_path = public, pg_temp;

-- 17. TRIGGER DE AUTOCADASTRO SEGURO (ROLE MORADOR PADRÃO)
create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, is_active, condominium_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'role'), '')::public.user_role, 'morador'),
    true,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'condominium_id'), '')::uuid,
      null
    )
  )
  on conflict (id) do update set
    condominium_id = coalesce(public.profiles.condominium_id, excluded.condominium_id),
    full_name = coalesce(nullif(trim(excluded.full_name), ''), public.profiles.full_name),
    role = coalesce(excluded.role, public.profiles.role);
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- 18. TRIGGER DE PROTEÇÃO CONTRA PRIVILEGE ESCALATION E CROSS-TENANT
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

  if is_caller_admin and old.condominium_id is not null and old.condominium_id != caller_condo_id then
    raise exception 'Operação não permitida: gerenciamento restrito ao próprio condomínio.';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

drop trigger if exists trg_protect_profile_changes on public.profiles;
create trigger trg_protect_profile_changes
  before update on public.profiles
  for each row execute function public.protect_profile_changes();

-- 19. ATIVAÇÃO DE ROW LEVEL SECURITY (RLS)
alter table public.condominiums enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.units enable row level security;
alter table public.unit_owners enable row level security;
alter table public.unit_residents enable row level security;
alter table public.financial_entries enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.announcements enable row level security;
alter table public.documents enable row level security;
alter table public.assemblies enable row level security;
alter table public.activity_logs enable row level security;

-- 20. POLÍTICAS DE SEGURANÇA (RLS POLICIES)
drop policy if exists "Roles visíveis autenticados" on public.roles;
create policy "Roles visíveis autenticados" on public.roles
  for select to authenticated using (true);

drop policy if exists "Permissoes visíveis autenticados" on public.permissions;
create policy "Permissoes visíveis autenticados" on public.permissions
  for select to authenticated using (true);

drop policy if exists "Role-permissions visíveis autenticados" on public.role_permissions;
create policy "Role-permissions visíveis autenticados" on public.role_permissions
  for select to authenticated using (true);

-- Condominiums
drop policy if exists "Membros visualizam condominio" on public.condominiums;
drop policy if exists "Membros visualizam proprio condominio" on public.condominiums;
create policy "Membros visualizam proprio condominio" on public.condominiums
  for select to authenticated
  using (id = public.get_auth_condominium_id());

drop policy if exists "Admins atualizam condominio" on public.condominiums;
drop policy if exists "Admins atualizam proprio condominio" on public.condominiums;
create policy "Admins atualizam proprio condominio" on public.condominiums
  for update to authenticated
  using (public.is_admin() and id = public.get_auth_condominium_id())
  with check (id = public.get_auth_condominium_id());

drop policy if exists "Admins inserem condominio" on public.condominiums;
create policy "Admins inserem condominio" on public.condominiums
  for insert to authenticated
  with check (public.is_admin() and id = public.get_auth_condominium_id());

drop policy if exists "Admins excluem proprio condominio" on public.condominiums;
create policy "Admins excluem proprio condominio" on public.condominiums
  for delete to authenticated
  using (public.is_admin() and id = public.get_auth_condominium_id());

-- Profiles
drop policy if exists "Membros visualizam perfis do condominio" on public.profiles;
create policy "Membros visualizam perfis do condominio" on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or (
      condominium_id = public.get_auth_condominium_id()
      and condominium_id is not null
    )
  );

drop policy if exists "Usuarios atualizam proprio perfil" on public.profiles;
drop policy if exists "Usuarios atualizam proprio perfil restrito" on public.profiles;
create policy "Usuarios atualizam proprio perfil restrito" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and coalesce(condominium_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce((select p.condominium_id from public.profiles p where p.id = auth.uid()), '00000000-0000-0000-0000-000000000000'::uuid)
    and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
  );

drop policy if exists "Admins gerenciam perfis do condominio" on public.profiles;
drop policy if exists "Admins atualizam perfis do proprio condominio" on public.profiles;
create policy "Admins atualizam perfis do proprio condominio" on public.profiles
  for update to authenticated
  using (
    public.is_admin() and (
      condominium_id = public.get_auth_condominium_id()
      or condominium_id is null
    )
  )
  with check (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins inserem perfis do proprio condominio" on public.profiles;
create policy "Admins inserem perfis do proprio condominio" on public.profiles
  for insert to authenticated
  with check (public.is_admin() and condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins excluem perfis do proprio condominio" on public.profiles;
create policy "Admins excluem perfis do proprio condominio" on public.profiles
  for delete to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id() and id != auth.uid());

-- Units
drop policy if exists "Membros visualizam unidades do condominio" on public.units;
create policy "Membros visualizam unidades do condominio" on public.units
  for select to authenticated
  using (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins gerenciam unidades" on public.units;
drop policy if exists "Admins inserem unidades no proprio condominio" on public.units;
create policy "Admins inserem unidades no proprio condominio" on public.units
  for insert to authenticated
  with check (public.is_admin() and condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins atualizam unidades do proprio condominio" on public.units;
create policy "Admins atualizam unidades do proprio condominio" on public.units
  for update to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id())
  with check (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins excluem unidades do proprio condominio" on public.units;
create policy "Admins excluem unidades do proprio condominio" on public.units
  for delete to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id());

-- Unit Owners
drop policy if exists "Admins visualizam proprietarios" on public.unit_owners;
drop policy if exists "Moradores visualizam proprietarios da unidade" on public.unit_owners;
drop policy if exists "Membros visualizam proprietarios pertinentes" on public.unit_owners;
create policy "Membros visualizam proprietarios pertinentes" on public.unit_owners
  for select to authenticated
  using (
    (
      unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
      and (public.is_admin() or public.is_council_or_admin())
    )
    or (unit_id in (select unit_id from public.get_user_unit_ids()))
  );

drop policy if exists "Admins inserem proprietarios da unidade" on public.unit_owners;
create policy "Admins inserem proprietarios da unidade" on public.unit_owners
  for insert to authenticated
  with check (
    public.is_admin()
    and unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
  );

drop policy if exists "Admins atualizam proprietarios da unidade" on public.unit_owners;
create policy "Admins atualizam proprietarios da unidade" on public.unit_owners
  for update to authenticated
  using (
    public.is_admin()
    and unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
  )
  with check (
    unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
  );

drop policy if exists "Admins excluem proprietarios da unidade" on public.unit_owners;
create policy "Admins excluem proprietarios da unidade" on public.unit_owners
  for delete to authenticated
  using (
    public.is_admin()
    and unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
  );

-- Unit Residents
drop policy if exists "Admins gerenciam moradores" on public.unit_residents;
drop policy if exists "Moradores visualizam moradores da unidade" on public.unit_residents;
drop policy if exists "Membros visualizam moradores pertinentes" on public.unit_residents;
create policy "Membros visualizam moradores pertinentes" on public.unit_residents
  for select to authenticated
  using (
    (
      unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
      and (public.is_admin() or public.is_council_or_admin())
    )
    or (unit_id in (select unit_id from public.get_user_unit_ids()))
  );

drop policy if exists "Admins inserem moradores da unidade" on public.unit_residents;
create policy "Admins inserem moradores da unidade" on public.unit_residents
  for insert to authenticated
  with check (
    public.is_admin()
    and unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
  );

drop policy if exists "Admins atualizam moradores da unidade" on public.unit_residents;
create policy "Admins atualizam moradores da unidade" on public.unit_residents
  for update to authenticated
  using (
    public.is_admin()
    and unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
  )
  with check (
    unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
  );

drop policy if exists "Admins excluem moradores da unidade" on public.unit_residents;
create policy "Admins excluem moradores da unidade" on public.unit_residents
  for delete to authenticated
  using (
    public.is_admin()
    and unit_id in (select id from public.units where condominium_id = public.get_auth_condominium_id())
  );

-- Financial Entries
drop policy if exists "Admins gerenciam financeiro" on public.financial_entries;
drop policy if exists "Moradores visualizam apenas propria unidade" on public.financial_entries;
drop policy if exists "Membros visualizam financeiro pertinente" on public.financial_entries;
create policy "Membros visualizam financeiro pertinente" on public.financial_entries
  for select to authenticated
  using (
    condominium_id = public.get_auth_condominium_id()
    and (
      (public.is_admin() or public.is_council_or_admin())
      or (unit_id is not null and unit_id in (select unit_id from public.get_user_unit_ids()))
    )
  );

drop policy if exists "Admins inserem financeiro" on public.financial_entries;
create policy "Admins inserem financeiro" on public.financial_entries
  for insert to authenticated
  with check (public.is_admin() and condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins atualizam financeiro" on public.financial_entries;
create policy "Admins atualizam financeiro" on public.financial_entries
  for update to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id())
  with check (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins excluem financeiro" on public.financial_entries;
create policy "Admins excluem financeiro" on public.financial_entries
  for delete to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id());

-- Maintenance Requests
drop policy if exists "Admins gerenciam manutencoes" on public.maintenance_requests;
drop policy if exists "Moradores visualizam manutencoes pertinentes" on public.maintenance_requests;
create policy "Moradores visualizam manutencoes pertinentes" on public.maintenance_requests
  for select to authenticated
  using (
    condominium_id = public.get_auth_condominium_id()
    and (
      public.is_admin()
      or public.is_council_or_admin()
      or requester_id = auth.uid()
      or (unit_id is not null and unit_id in (select unit_id from public.get_user_unit_ids()))
      or (unit_id is null and (location ilike '%comum%' or location ilike '%área%'))
    )
  );

drop policy if exists "Moradores abrem manutencoes" on public.maintenance_requests;
create policy "Moradores abrem manutencoes" on public.maintenance_requests
  for insert to authenticated
  with check (
    condominium_id = public.get_auth_condominium_id()
    and (public.is_admin() or requester_id = auth.uid() or requester_id is null)
  );

drop policy if exists "Usuarios atualizam manutencoes pertinentes" on public.maintenance_requests;
create policy "Usuarios atualizam manutencoes pertinentes" on public.maintenance_requests
  for update to authenticated
  using (
    (public.is_admin() and condominium_id = public.get_auth_condominium_id())
    or (
      requester_id = auth.uid()
      and condominium_id = public.get_auth_condominium_id()
      and status = 'open'
    )
  )
  with check (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins excluem manutencoes" on public.maintenance_requests;
create policy "Admins excluem manutencoes" on public.maintenance_requests
  for delete to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id());

-- Announcements
drop policy if exists "Admins gerenciam comunicados" on public.announcements;
drop policy if exists "Moradores visualizam comunicados publicados" on public.announcements;
create policy "Membros visualizam comunicados pertinentes" on public.announcements
  for select to authenticated
  using (
    condominium_id = public.get_auth_condominium_id()
    and (
      (public.is_admin() or public.is_council_or_admin())
      or status = 'published'
    )
  );

drop policy if exists "Admins inserem comunicados" on public.announcements;
create policy "Admins inserem comunicados" on public.announcements
  for insert to authenticated
  with check (public.is_admin() and condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins atualizam comunicados" on public.announcements;
create policy "Admins atualizam comunicados" on public.announcements
  for update to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id())
  with check (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins excluem comunicados" on public.announcements;
create policy "Admins excluem comunicados" on public.announcements
  for delete to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id());

-- Documents
drop policy if exists "Admins gerenciam documentos" on public.documents;
drop policy if exists "Moradores visualizam documentos gerais" on public.documents;
drop policy if exists "Membros visualizam documentos por visibilidade" on public.documents;
create policy "Membros visualizam documentos por visibilidade" on public.documents
  for select to authenticated
  using (
    condominium_id = public.get_auth_condominium_id()
    and (
      visibility = 'all'
      or (visibility = 'council' and (public.is_council_or_admin() or public.is_admin()))
      or (visibility = 'admin_only' and public.is_admin())
    )
  );

drop policy if exists "Admins inserem documentos" on public.documents;
create policy "Admins inserem documentos" on public.documents
  for insert to authenticated
  with check (public.is_admin() and condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins atualizam documentos" on public.documents;
create policy "Admins atualizam documentos" on public.documents
  for update to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id())
  with check (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins excluem documentos" on public.documents;
create policy "Admins excluem documentos" on public.documents
  for delete to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id());

-- Assemblies
drop policy if exists "Admins gerenciam assembleias" on public.assemblies;
drop policy if exists "Moradores visualizam assembleias" on public.assemblies;
create policy "Moradores visualizam assembleias" on public.assemblies
  for select to authenticated
  using (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins inserem assembleias" on public.assemblies;
create policy "Admins inserem assembleias" on public.assemblies
  for insert to authenticated
  with check (public.is_admin() and condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins atualizam assembleias" on public.assemblies;
create policy "Admins atualizam assembleias" on public.assemblies
  for update to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id())
  with check (condominium_id = public.get_auth_condominium_id());

drop policy if exists "Admins excluem assembleias" on public.assemblies;
create policy "Admins excluem assembleias" on public.assemblies
  for delete to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id());

-- Activity Logs
drop policy if exists "Admins visualizam logs" on public.activity_logs;
create policy "Admins visualizam logs" on public.activity_logs
  for select to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id());

drop policy if exists "Usuarios registram logs" on public.activity_logs;
create policy "Usuarios registram logs" on public.activity_logs
  for insert to authenticated
  with check (
    condominium_id = public.get_auth_condominium_id()
    and (user_id = auth.uid() or user_id is null)
  );

-- 21. PROVISIONAMENTO DE BUCKETS DO SUPABASE STORAGE E POLÍTICAS DE ACESSO
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('condominium_documents', 'condominium_documents', false, 20971520, array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']),
  ('maintenance_attachments', 'maintenance_attachments', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('assembly_minutes', 'assembly_minutes', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Políticas no Storage com validação de Condomínio no primeiro path segment:
drop policy if exists "Acesso a documentos e anexos autenticado" on storage.objects;
drop policy if exists "Documentos leitura restrita ao condominio" on storage.objects;
create policy "Documentos leitura restrita ao condominio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'condominium_documents'
    and split_part(name, '/', 1) = public.get_auth_condominium_id()::text
  );

drop policy if exists "Anexos manutencao leitura restrita ao condominio" on storage.objects;
create policy "Anexos manutencao leitura restrita ao condominio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'maintenance_attachments'
    and split_part(name, '/', 1) = public.get_auth_condominium_id()::text
  );

drop policy if exists "Atas assembleia leitura restrita ao condominio" on storage.objects;
create policy "Atas assembleia leitura restrita ao condominio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assembly_minutes'
    and split_part(name, '/', 1) = public.get_auth_condominium_id()::text
  );

drop policy if exists "Upload de documentos por administradores" on storage.objects;
drop policy if exists "Documentos upload apenas admin do condominio" on storage.objects;
create policy "Documentos upload apenas admin do condominio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'condominium_documents'
    and public.is_admin()
    and split_part(name, '/', 1) = public.get_auth_condominium_id()::text
  );

drop policy if exists "Upload de anexos de manutenção por usuários autenticados" on storage.objects;
drop policy if exists "Anexos manutencao upload membro do condominio" on storage.objects;
create policy "Anexos manutencao upload membro do condominio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'maintenance_attachments'
    and split_part(name, '/', 1) = public.get_auth_condominium_id()::text
  );

drop policy if exists "Atas assembleia upload apenas admin do condominio" on storage.objects;
create policy "Atas assembleia upload apenas admin do condominio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assembly_minutes'
    and public.is_admin()
    and split_part(name, '/', 1) = public.get_auth_condominium_id()::text
  );

drop policy if exists "Exclusão de arquivos por administradores" on storage.objects;
drop policy if exists "Exclusao de arquivos apenas admin do condominio" on storage.objects;
create policy "Exclusao de arquivos apenas admin do condominio"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('condominium_documents', 'maintenance_attachments', 'assembly_minutes')
    and public.is_admin()
    and split_part(name, '/', 1) = public.get_auth_condominium_id()::text
  );
