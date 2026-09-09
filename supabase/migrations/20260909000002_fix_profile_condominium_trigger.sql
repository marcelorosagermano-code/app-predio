-- Migration: 20260909000002_fix_profile_condominium_trigger.sql
-- Garante que o trigger de novos usuários extraia o condominium_id e role dos metadados,
-- e que administradores possam vincular perfis cujo condominium_id esteja nulo.

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

-- Permitir que administradores atualizem perfis do próprio condomínio ou vinculem perfis com condominium_id nulo
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

-- Permitir que administradores insiram perfis para o seu próprio condomínio
drop policy if exists "Admins inserem perfis do proprio condominio" on public.profiles;
create policy "Admins inserem perfis do proprio condominio" on public.profiles
  for insert to authenticated
  with check (public.is_admin() and condominium_id = public.get_auth_condominium_id());
