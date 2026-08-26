-- MACROFOOD - banco e segurança
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_code varchar(6),
  price numeric(12,2) not null default 0,
  sector text not null check (sector in (
    'Chocolates','Confeitaria','Sorveteria','Restaurante',
    'Ocidental','Resfriados','Congelados'
  )),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_product_code_check check (product_code is null or product_code ~ '^[0-9]{1,6}$')
);

-- Migração segura para projetos que já tinham a tabela products.
alter table public.products add column if not exists product_code varchar(6);
alter table public.products drop constraint if exists products_product_code_check;
alter table public.products add constraint products_product_code_check
check (product_code is null or product_code ~ '^[0-9]{1,6}$');

create index if not exists products_active_sector_idx
on public.products(active, sector);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email)
  values (new.id,new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "public active products" on public.products;
create policy "public active products"
on public.products for select
to anon, authenticated
using (active = true or public.is_admin());

drop policy if exists "admin insert products" on public.products;
create policy "admin insert products"
on public.products for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admin update products" on public.products;
create policy "admin update products"
on public.products for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin delete products" on public.products;
create policy "admin delete products"
on public.products for delete
to authenticated
using (public.is_admin());

-- Storage para imagens
insert into storage.buckets (id, name, public)
values ('product-images','product-images',true)
on conflict (id) do update set public = true;

drop policy if exists "public product images" on storage.objects;
create policy "public product images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

drop policy if exists "admin upload product images" on storage.objects;
create policy "admin upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin update product images" on storage.objects;
create policy "admin update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "admin delete product images" on storage.objects;
create policy "admin delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_admin());

-- Extensões do catálogo: estoque, promoção e WhatsApp
alter table public.products add column if not exists in_stock boolean not null default true;
alter table public.products add column if not exists promo_price numeric(12,2);
create table if not exists public.site_settings (key text primary key, value text not null);
insert into public.site_settings(key,value) values ('whatsapp_orders','5581971178793') on conflict (key) do nothing;
alter table public.site_settings enable row level security;
drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "admin manage settings" on public.site_settings;
create policy "admin manage settings" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
