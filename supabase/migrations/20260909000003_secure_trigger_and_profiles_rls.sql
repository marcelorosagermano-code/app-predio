-- Migration: 20260909000003_secure_trigger_and_profiles_rls.sql
-- RESTAURAÇÃO DE SEGURANÇA: USER_METADATA NUNCA É FONTE DE AUTORIZAÇÃO.
--
-- 1. O trigger handle_new_auth_user NÃO confia em raw_user_meta_data->>'condominium_id' nem em raw_user_meta_data->>'role'.
--    Todo novo usuário no Supabase Auth recebe role = 'morador' e condominium_id = NULL por padrão no trigger.
-- 2. O backend com permissão privilegiada (service_role) é a ÚNICA entidade autorizada a associar o condominium_id
--    do administrador autenticado e vincular a unidade.
-- 3. A política de RLS em public.profiles para administradores é estrita: somente permite atualizar perfis do próprio
--    condomínio (condominium_id = get_auth_condominium_id()). Nenhuma policy client-side permite manipular perfis órfãos.

create or replace function public.handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, is_active, condominium_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    'morador',
    true,
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public, pg_temp;

-- Restaurar a política estrita de atualização de perfis
drop policy if exists "Admins atualizam perfis do proprio condominio" on public.profiles;
create policy "Admins atualizam perfis do proprio condominio" on public.profiles
  for update to authenticated
  using (public.is_admin() and condominium_id = public.get_auth_condominium_id())
  with check (condominium_id = public.get_auth_condominium_id());

-- Remover qualquer política de inserção direta por clientes
drop policy if exists "Admins inserem perfis do proprio condominio" on public.profiles;
