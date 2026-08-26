-- MACROFOOD - banco e segurança
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  nickname text,
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  product_code varchar(6),
  price numeric(12,2) not null default 0,
  sector text not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_product_code_check check (product_code is null or product_code ~ '^[0-9]{1,6}$')
);

-- Perfil do cliente: apelido exibido no catálogo.
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists avatar_url text;

-- Compatibilidade com versões anteriores.
alter table public.products add column if not exists product_code varchar(6);
alter table public.products add column if not exists in_stock boolean not null default true;
alter table public.products add column if not exists promo_price numeric(12,2);
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.products drop constraint if exists products_sector_check;
alter table public.products add constraint products_sector_check check (sector in (
  'Chocolates','Confeitaria','Sorveteria','Padaria','Restaurante','Ocidental','Frios','Congelados'
));

create index if not exists products_active_sector_idx on public.products(active, sector);
-- Reparo/compatibilidade do catálogo público.
update public.products set active=true where active is null;
grant select on public.products to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,nickname) values(new.id,new.email,nullif(trim(new.raw_user_meta_data->>'nickname'),'')) on conflict(id) do update set email=excluded.email, nickname=coalesce(public.profiles.nickname, excluded.nickname);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

alter table public.profiles enable row level security;
alter table public.products enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using(id=auth.uid());
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

drop policy if exists "public active products" on public.products;
create policy "public active products" on public.products for select to anon,authenticated using(coalesce(active,true)=true or public.is_admin());

drop policy if exists "admin insert products" on public.products;
create policy "admin insert products" on public.products for insert to authenticated with check(public.is_admin());
drop policy if exists "admin update products" on public.products;
create policy "admin update products" on public.products for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admin delete products" on public.products;
create policy "admin delete products" on public.products for delete to authenticated using(public.is_admin());

insert into storage.buckets(id,name,public) values('avatars','avatars',true) on conflict(id) do update set public=true;
drop policy if exists "public avatar images" on storage.objects;
create policy "public avatar images" on storage.objects for select to public using(bucket_id='avatars');
drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar" on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar" on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text) with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "users delete own avatar" on storage.objects;
create policy "users delete own avatar" on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
insert into storage.buckets(id,name,public) values('product-images','product-images',true) on conflict(id) do update set public=true;
drop policy if exists "public product images" on storage.objects;
create policy "public product images" on storage.objects for select to public using(bucket_id='product-images');
drop policy if exists "admin upload product images" on storage.objects;
create policy "admin upload product images" on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_admin());
drop policy if exists "admin update product images" on storage.objects;
create policy "admin update product images" on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_admin()) with check(bucket_id='product-images' and public.is_admin());
drop policy if exists "admin delete product images" on storage.objects;
create policy "admin delete product images" on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_admin());

create table if not exists public.site_settings(key text primary key,value text not null);
insert into public.site_settings(key,value) values('whatsapp_orders','5581971178793') on conflict(key) do nothing;
alter table public.site_settings enable row level security;
drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings for select to anon,authenticated using(true);
drop policy if exists "admin manage settings" on public.site_settings;
create policy "admin manage settings" on public.site_settings for all to authenticated using(public.is_admin()) with check(public.is_admin());

-- Avaliações: qualquer usuário autenticado pode avaliar e atualizar sua própria nota.
create table if not exists public.product_reviews(
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check(rating between 1 and 5),
  created_at timestamptz not null default now(),
  unique(product_id,user_id)
);
create index if not exists product_reviews_product_idx on public.product_reviews(product_id);

alter table public.product_reviews enable row level security;
drop policy if exists "public read reviews" on public.product_reviews;
create policy "public read reviews" on public.product_reviews for select to anon,authenticated using(true);
drop policy if exists "users insert own reviews" on public.product_reviews;
create policy "users insert own reviews" on public.product_reviews for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "users update own reviews" on public.product_reviews;
create policy "users update own reviews" on public.product_reviews for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "users delete own reviews" on public.product_reviews;
create policy "users delete own reviews" on public.product_reviews for delete to authenticated using(user_id=auth.uid());

-- Corrige instalações antigas que usavam nomes de setor diferentes.
update public.products set sector='Frios' where sector='Resfriados';


-- Banners do topo: até 5 imagens publicadas no catálogo.
create table if not exists public.site_banners(
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  storage_path text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists site_banners_active_order_idx on public.site_banners(active,sort_order);

alter table public.site_banners enable row level security;
drop policy if exists "public read active banners" on public.site_banners;
create policy "public read active banners" on public.site_banners for select to anon,authenticated using(active=true or public.is_admin());
drop policy if exists "admin manage banners" on public.site_banners;
create policy "admin manage banners" on public.site_banners for all to authenticated using(public.is_admin()) with check(public.is_admin());

insert into storage.buckets(id,name,public) values('banner-images','banner-images',true) on conflict(id) do update set public=true;
drop policy if exists "public banner images" on storage.objects;
create policy "public banner images" on storage.objects for select to public using(bucket_id='banner-images');
drop policy if exists "admin upload banner images" on storage.objects;
create policy "admin upload banner images" on storage.objects for insert to authenticated with check(bucket_id='banner-images' and public.is_admin());
drop policy if exists "admin update banner images" on storage.objects;
create policy "admin update banner images" on storage.objects for update to authenticated using(bucket_id='banner-images' and public.is_admin()) with check(bucket_id='banner-images' and public.is_admin());
drop policy if exists "admin delete banner images" on storage.objects;
create policy "admin delete banner images" on storage.objects for delete to authenticated using(bucket_id='banner-images' and public.is_admin());


-- Administração de clientes: lista de perfis para o painel e exclusão segura via RPC.
alter table public.profiles add column if not exists created_at timestamptz not null default now();

drop policy if exists "admin read all profiles" on public.profiles;
create policy "admin read all profiles" on public.profiles for select to authenticated using(public.is_admin() or id=auth.uid());

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem remover clientes';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'O administrador não pode remover a própria conta';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;
revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- Pedidos recebidos diretamente pelo painel administrativo.
create table if not exists public.orders(
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated by default as identity unique,
  user_id uuid references auth.users(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  note text,
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0,
  status text not null default 'received' check(status in ('received','ready_payment','paid','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_status_created_idx on public.orders(status,created_at desc);
create index if not exists orders_user_idx on public.orders(user_id);

alter table public.orders enable row level security;
drop policy if exists "customers insert orders" on public.orders;
create policy "customers insert orders" on public.orders for insert to anon,authenticated with check(user_id is null or user_id=auth.uid());
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders" on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders" on public.orders for select to authenticated using(public.is_admin());
drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders" on public.orders for update to authenticated using(public.is_admin()) with check(public.is_admin());
drop policy if exists "admins delete orders" on public.orders;
create policy "admins delete orders" on public.orders for delete to authenticated using(public.is_admin());


-- Sugestões de produtos enviadas somente por clientes autenticados.
-- As fotos ficam em um bucket PRIVADO e só administradores conseguem lê-las.
create table if not exists public.product_suggestions(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_name text not null,
  note text,
  storage_path text not null,
  created_at timestamptz not null default now()
);
create index if not exists product_suggestions_created_idx on public.product_suggestions(created_at desc);
create index if not exists product_suggestions_user_idx on public.product_suggestions(user_id);

grant select, insert, delete on public.product_suggestions to authenticated;
alter table public.product_suggestions enable row level security;
drop policy if exists "clients insert own product suggestions" on public.product_suggestions;
create policy "clients insert own product suggestions" on public.product_suggestions for insert to authenticated
with check (user_id=auth.uid() and not public.is_admin());
drop policy if exists "admins read product suggestions" on public.product_suggestions;
create policy "admins read product suggestions" on public.product_suggestions for select to authenticated
using(public.is_admin());
drop policy if exists "admins delete product suggestions" on public.product_suggestions;
create policy "admins delete product suggestions" on public.product_suggestions for delete to authenticated
using(public.is_admin());

insert into storage.buckets(id,name,public) values('product-suggestions','product-suggestions',false) on conflict(id) do update set public=false;
drop policy if exists "clients upload own product suggestions" on storage.objects;
create policy "clients upload own product suggestions" on storage.objects for insert to authenticated
with check(bucket_id='product-suggestions' and (storage.foldername(name))[1]=auth.uid()::text and not public.is_admin());
drop policy if exists "admins read product suggestion images" on storage.objects;
create policy "admins read product suggestion images" on storage.objects for select to authenticated
using(bucket_id='product-suggestions' and public.is_admin());
drop policy if exists "admins delete product suggestion images" on storage.objects;
create policy "admins delete product suggestion images" on storage.objects for delete to authenticated
using(bucket_id='product-suggestions' and public.is_admin());

-- Atualização dos pedidos: cadastro comercial e acompanhamento pelo cliente.
alter table public.orders alter column customer_name drop not null;
alter table public.orders alter column customer_phone drop not null;
alter table public.orders add column if not exists sales_customer boolean not null default false;
alter table public.orders add column if not exists document_type text check (document_type in ('cpf','cnpj'));
alter table public.orders add column if not exists document_number text;
alter table public.orders add column if not exists zipcode text;

-- O cliente logado pode acompanhar apenas seus próprios pedidos.
drop policy if exists "customers read own orders" on public.orders;
create policy "customers read own orders" on public.orders for select to authenticated
using(user_id=auth.uid() or public.is_admin());

-- Cancelamento seguro: o cliente não pode alterar preço, itens ou outros dados do pedido.
create or replace function public.cancel_my_order(target_order_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  changed boolean := false;
begin
  update public.orders
     set status='cancelled', updated_at=now()
   where id=target_order_id
     and user_id=auth.uid()
     and status in ('received','ready_payment','paid');
  changed := found;
  return changed;
end;
$$;
revoke all on function public.cancel_my_order(uuid) from public;
grant execute on function public.cancel_my_order(uuid) to authenticated;

drop policy if exists "customers insert orders" on public.orders;
create policy "customers insert orders" on public.orders for insert to authenticated
with check(user_id=auth.uid());

-- Suporte ao cliente: chat privado entre cada cliente e os administradores.
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('user','admin')),
  message text not null check (char_length(trim(message)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists support_messages_user_created_idx on public.support_messages(user_id, created_at);
alter table public.support_messages enable row level security;
drop policy if exists "customers read own support messages" on public.support_messages;
create policy "customers read own support messages" on public.support_messages for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "customers send support messages" on public.support_messages;
create policy "customers send support messages" on public.support_messages for insert to authenticated with check(user_id=auth.uid() and sender_role='user');
drop policy if exists "admins send support messages" on public.support_messages;
create policy "admins send support messages" on public.support_messages for insert to authenticated with check(public.is_admin() and sender_role='admin');
drop policy if exists "admins delete support messages" on public.support_messages;
create policy "admins delete support messages" on public.support_messages for delete to authenticated using(public.is_admin());
grant select,insert,delete on public.support_messages to authenticated;

-- Suporte: estado da conversa (aberta/resolvida)
create table if not exists public.support_conversations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'open' check (status in ('open','resolved')),
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.support_conversations enable row level security;
drop policy if exists "customers read own support conversation" on public.support_conversations;
create policy "customers read own support conversation" on public.support_conversations for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "customers upsert own support conversation" on public.support_conversations;
create policy "customers upsert own support conversation" on public.support_conversations for insert to authenticated with check(user_id=auth.uid());
drop policy if exists "customers update own support conversation" on public.support_conversations;
create policy "customers update own support conversation" on public.support_conversations for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
drop policy if exists "admins manage support conversations" on public.support_conversations;
create policy "admins manage support conversations" on public.support_conversations for all to authenticated using(public.is_admin()) with check(public.is_admin());
grant select,insert,update on public.support_conversations to authenticated;
