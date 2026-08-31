-- Execute este arquivo no SQL Editor do Supabase para ativar o nome do administrador no suporte.

alter table public.support_messages add column if not exists sender_id uuid references public.profiles(id) on delete set null;
alter table public.support_conversations add column if not exists admin_id uuid references public.profiles(id) on delete set null;

create or replace function public.get_support_admin_name(p_user_id uuid)
returns text
language sql
security definer
set search_path = public
as $$
  select coalesce(
    (select nullif(trim(p.nickname),'') from public.support_conversations c join public.profiles p on p.id=c.admin_id where c.user_id=p_user_id and p.role='admin' limit 1),
    (select nullif(trim(p.nickname),'') from public.profiles p where p.role='admin' order by p.created_at asc limit 1),
    (select p.email from public.profiles p where p.role='admin' order by p.created_at asc limit 1),
    'Administrador'
  );
$$;
revoke all on function public.get_support_admin_name(uuid) from public;
grant execute on function public.get_support_admin_name(uuid) to authenticated;
