-- Macrofood: histórico de alterações dos produtos
create table if not exists public.product_change_history (
 id uuid primary key default gen_random_uuid(),
 product_id uuid null references public.products(id) on delete set null,
 changed_by uuid null references auth.users(id) on delete set null,
 action text not null default 'updated',
 changed_at timestamptz not null default now(),
 old_data jsonb,
 new_data jsonb
);
create index if not exists product_change_history_product_date_idx on public.product_change_history(product_id,changed_at desc);
alter table public.product_change_history enable row level security;
drop policy if exists "Admins can read product history" on public.product_change_history;
create policy "Admins can read product history" on public.product_change_history for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
drop policy if exists "Admins can insert product history" on public.product_change_history;
create policy "Admins can insert product history" on public.product_change_history for insert to authenticated with check (changed_by=auth.uid() and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
