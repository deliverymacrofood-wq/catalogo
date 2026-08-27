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
alter table public.profiles add column if not exists phone text;

-- Compatibilidade com versões anteriores.
alter table public.products add column if not exists product_code varchar(6);
alter table public.products add column if not exists in_stock boolean not null default true;
alter table public.products add column if not exists promo_price numeric(12,2);
alter table public.products add column if not exists is_featured boolean not null default false;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists active boolean not null default true;
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists updated_at timestamptz not null default now();
alter table public.products add column if not exists unit text not null default 'unidade';
alter table public.products add column if not exists wholesale_mode text;
alter table public.products add column if not exists wholesale_qty integer;
alter table public.products add column if not exists wholesale_price numeric(12,2);
alter table public.products drop constraint if exists products_unit_check;
alter table public.products add constraint products_unit_check check (unit in ('unidade','kg'));
alter table public.products drop constraint if exists products_wholesale_mode_check;
alter table public.products add constraint products_wholesale_mode_check check (wholesale_mode is null or wholesale_mode in ('threshold','block'));
alter table public.products drop constraint if exists products_sector_check;

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

-- Categorias personalizáveis do catálogo.
create table if not exists public.categories(
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.categories(name) values
('Chocolates'),('Confeitaria'),('Sorveteria'),('Padaria'),('Restaurante'),('Ocidental'),('Frios'),('Congelados')
on conflict(name) do nothing;

alter table public.categories enable row level security;
drop policy if exists "public read categories" on public.categories;
create policy "public read categories" on public.categories for select to anon,authenticated using(true);
drop policy if exists "admins manage categories" on public.categories;
create policy "admins manage categories" on public.categories for all to authenticated using(public.is_admin()) with check(public.is_admin());

alter table public.profiles enable row level security;
alter table public.products enable row level security;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using(id=auth.uid());
-- IMPORTANTE: clientes não podem mais alterar diretamente o próprio perfil.
-- Isso impede que um cliente transforme sua conta em administrador alterando `role`.
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;

create or replace function public.update_my_profile(
  p_nickname text default null,
  p_avatar_url text default null,
  p_phone text default null
)
returns public.profiles
language plpgsql
security definer
set search_path=public
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;

  if p_nickname is not null and (char_length(trim(p_nickname)) < 2 or char_length(trim(p_nickname)) > 30) then
    raise exception 'Apelido inválido';
  end if;

  if p_phone is not null and char_length(regexp_replace(p_phone, '\D', '', 'g')) > 0
     and char_length(regexp_replace(p_phone, '\D', '', 'g')) not between 10 and 13 then
    raise exception 'Celular inválido';
  end if;

  update public.profiles
     set nickname = case when p_nickname is null then nickname else nullif(trim(p_nickname),'') end,
         avatar_url = case when p_avatar_url is null then avatar_url else p_avatar_url end,
         phone = case when p_phone is null then phone else nullif(trim(p_phone),'') end
   where id=auth.uid()
   returning * into result;

  if result.id is null then
    raise exception 'Perfil não encontrado';
  end if;
  return result;
end;
$$;
revoke all on function public.update_my_profile(text,text,text) from public;
grant execute on function public.update_my_profile(text,text,text) to authenticated;

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

-- Proteção de integridade dos pedidos: o cliente não pode manipular preço, subtotal
-- ou total no navegador. O banco recalcula tudo usando os preços cadastrados.
create or replace function public.validate_order_totals()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  item jsonb;
  p public.products%rowtype;
  pid uuid;
  qty numeric;
  normal_price numeric;
  wholesale_price numeric;
  wholesale_qty integer;
  wholesale_mode text;
  valid_wholesale boolean;
  w_qty numeric;
  n_qty numeric;
  expected_subtotal numeric;
  expected_total numeric := 0;
  supplied_subtotal numeric;
  supplied_total numeric;
  item_count integer := 0;
begin
  if auth.uid() is null or new.user_id is null or new.user_id <> auth.uid() then
    raise exception 'Pedido inválido: usuário não autenticado';
  end if;

  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) < 1 or jsonb_array_length(new.items) > 100 then
    raise exception 'Itens do pedido inválidos';
  end if;

  for item in select value from jsonb_array_elements(new.items) loop
    item_count := item_count + 1;
    begin
      pid := (item->>'product_id')::uuid;
      qty := (item->>'qty')::numeric;
    exception when others then
      raise exception 'Produto ou quantidade inválidos';
    end;

    if qty <= 0 or qty > 9999 or qty <> trunc(qty) then
      raise exception 'Quantidade inválida';
    end if;

    select * into p from public.products where id=pid and coalesce(active,true)=true limit 1;
    if not found then
      raise exception 'Produto não disponível';
    end if;

    if p.price is null or p.price <= 0 then
      raise exception 'Produto % está sem preço válido cadastrado', p.name;
    end if;

    normal_price := case when p.promo_price is not null and p.promo_price > 0 and p.promo_price < p.price then p.promo_price else p.price end;
    if normal_price is null or normal_price <= 0 then
      raise exception 'Produto % está sem preço válido cadastrado', p.name;
    end if;

    wholesale_price := p.wholesale_price;
    wholesale_qty := p.wholesale_qty;
    wholesale_mode := p.wholesale_mode;
    valid_wholesale := wholesale_price is not null and wholesale_price > 0 and wholesale_qty is not null and wholesale_qty > 0 and wholesale_price < normal_price;

    if valid_wholesale and wholesale_mode='block' then
      w_qty := floor(qty / wholesale_qty) * wholesale_qty;
      n_qty := qty - w_qty;
    elsif valid_wholesale and wholesale_mode='threshold' and qty >= wholesale_qty then
      w_qty := qty;
      n_qty := 0;
    else
      w_qty := 0;
      n_qty := qty;
    end if;

    expected_subtotal := round((n_qty * normal_price) + (w_qty * coalesce(wholesale_price, 0)),2);
    supplied_subtotal := round(coalesce((item->>'subtotal')::numeric, -1),2);
    if supplied_subtotal <> expected_subtotal then
      raise exception 'Preço do pedido inválido para o produto %', p.name;
    end if;

    expected_total := expected_total + expected_subtotal;
  end loop;

  expected_total := round(expected_total,2);
  if expected_total is null or expected_total <= 0 then
    raise exception 'Não foi possível calcular o total do pedido';
  end if;

  supplied_total := round(coalesce(new.total,-1),2);
  if supplied_total <> expected_total then
    raise exception 'Total do pedido inválido';
  end if;

  new.total := expected_total;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.validate_order_totals() from public;
grant execute on function public.validate_order_totals() to authenticated;

drop trigger if exists trg_validate_order_totals on public.orders;
create trigger trg_validate_order_totals
before insert on public.orders
for each row execute function public.validate_order_totals();

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


-- Confirmação de contato feita depois do cadastro.
-- Não depende de "Confirm email" no cadastro: o cliente continua podendo criar a conta
-- e confirmar e-mail/celular somente em Minha conta antes de comprar.
create table if not exists public.contact_verifications(
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.contact_verifications enable row level security;
drop policy if exists "users read own contact verification" on public.contact_verifications;
create policy "users read own contact verification" on public.contact_verifications
  for select to authenticated using(user_id=auth.uid());

-- Não existe INSERT/UPDATE/DELETE direto para o cliente. Somente estas funções
-- SECURITY DEFINER podem gravar o resultado depois da verificação do Auth.
create or replace function public.mark_email_contact_verified()
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  claims jsonb;
  methods jsonb;
  item jsonb;
  recent_otp boolean := false;
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  claims := auth.jwt();
  methods := coalesce(claims->'amr','[]'::jsonb);
  for item in select * from jsonb_array_elements(methods) loop
    if item->>'method' = 'otp'
       and coalesce((item->>'timestamp')::bigint,0) >= extract(epoch from now() - interval '10 minutes') then
      recent_otp := true;
    end if;
  end loop;
  if not recent_otp then
    raise exception 'É necessário validar o código enviado pelo e-mail antes de confirmar.';
  end if;
  insert into public.contact_verifications(user_id,email_verified,email_verified_at,updated_at)
  values(auth.uid(),true,now(),now())
  on conflict(user_id) do update set email_verified=true,email_verified_at=now(),updated_at=now();
end;
$$;

create or replace function public.mark_phone_contact_verified()
returns void
language plpgsql
security definer
set search_path=public,auth
as $$
begin
  if auth.uid() is null then raise exception 'Não autenticado'; end if;
  if not exists(select 1 from auth.users where id=auth.uid() and phone_confirmed_at is not null) then
    raise exception 'O celular ainda não foi confirmado pelo Supabase.';
  end if;
  insert into public.contact_verifications(user_id,phone_verified,phone_verified_at,updated_at)
  values(auth.uid(),true,now(),now())
  on conflict(user_id) do update set phone_verified=true,phone_verified_at=now(),updated_at=now();
end;
$$;

grant execute on function public.mark_email_contact_verified() to authenticated;
grant execute on function public.mark_phone_contact_verified() to authenticated;
grant select on public.contact_verifications to authenticated;

-- Cria o registro automaticamente para contas novas.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,nickname,phone)
    values(new.id,new.email,nullif(trim(new.raw_user_meta_data->>'nickname'),''),new.phone)
    on conflict(id) do update set email=excluded.email, nickname=coalesce(public.profiles.nickname, excluded.nickname), phone=coalesce(excluded.phone, public.profiles.phone);
  insert into public.contact_verifications(user_id)
    values(new.id) on conflict(user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

insert into public.contact_verifications(user_id)
select id from auth.users
on conflict(user_id) do nothing;


-- Chat exclusivo de cada pedido: disponível enquanto o pedido estiver em andamento.
create table if not exists public.order_chat_messages(
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check(sender_role in ('user','admin')),
  message text not null check(char_length(trim(message)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists order_chat_messages_order_created_idx on public.order_chat_messages(order_id,created_at);
alter table public.order_chat_messages enable row level security;
drop policy if exists "customers read own order chat" on public.order_chat_messages;
create policy "customers read own order chat" on public.order_chat_messages for select to authenticated
using(exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid()));
drop policy if exists "admins read order chat" on public.order_chat_messages;
create policy "admins read order chat" on public.order_chat_messages for select to authenticated
using(public.is_admin());
drop policy if exists "customers send order chat" on public.order_chat_messages;
create policy "customers send order chat" on public.order_chat_messages for insert to authenticated
with check(sender_role='user' and user_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid() and o.status in ('received','ready_payment','paid')));
drop policy if exists "admins send order chat" on public.order_chat_messages;
create policy "admins send order chat" on public.order_chat_messages for insert to authenticated
with check(sender_role='admin' and public.is_admin() and exists(select 1 from public.orders o where o.id=order_id and o.status in ('received','ready_payment','paid')));
grant select,insert on public.order_chat_messages to authenticated;

-- Permite ao administrador alterar produtos/quantidades de pedidos ainda em separação.
-- O banco recalcula o total com o preço atual e as regras de atacado do produto.
create or replace function public.admin_update_order_items(target_order_id uuid, new_items jsonb)
returns public.orders
language plpgsql
security definer
set search_path=public
as $$
declare
  ord public.orders;
  item jsonb;
  p public.products%rowtype;
  pid uuid;
  qty integer;
  base_price numeric;
  wholesale_price numeric;
  wholesale_qty integer;
  w_qty integer;
  n_qty integer;
  subtotal numeric;
  total numeric := 0;
  rebuilt jsonb := '[]'::jsonb;
  item_count integer := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acesso negado: somente administradores podem alterar pedidos';
  end if;
  if jsonb_typeof(new_items) <> 'array' then
    raise exception 'Itens do pedido inválidos';
  end if;
  select * into ord from public.orders where id=target_order_id for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if ord.status not in ('received','ready_payment','paid') then
    raise exception 'Este pedido já não está em separação e não pode ser alterado';
  end if;
  if jsonb_array_length(new_items)=0 then raise exception 'O pedido precisa ter pelo menos um produto'; end if;
  if jsonb_array_length(new_items)>100 then raise exception 'Quantidade máxima de itens excedida'; end if;

  for item in select * from jsonb_array_elements(new_items) loop
    begin pid := (item->>'product_id')::uuid; exception when others then raise exception 'Produto inválido no pedido'; end;
    qty := floor(coalesce((item->>'qty')::numeric,0));
    if qty < 1 or qty > 9999 then raise exception 'Quantidade inválida'; end if;
    select * into p from public.products where id=pid and coalesce(active,true)=true limit 1;
    if not found then raise exception 'Produto não disponível'; end if;
    if p.price is null or p.price <= 0 then raise exception 'Produto % está sem preço válido cadastrado',p.name; end if;
    base_price := case when p.promo_price is not null and p.promo_price>0 and p.promo_price<p.price then p.promo_price else p.price end;
    wholesale_price := p.wholesale_price; wholesale_qty := p.wholesale_qty;
    if wholesale_price is not null and wholesale_price>0 and wholesale_qty is not null and wholesale_qty>0 and wholesale_price<base_price and p.wholesale_mode='block' then
      w_qty := floor(qty::numeric/wholesale_qty); w_qty := w_qty*wholesale_qty; n_qty := qty-w_qty;
    elsif wholesale_price is not null and wholesale_price>0 and wholesale_qty is not null and wholesale_qty>0 and wholesale_price<base_price and p.wholesale_mode='threshold' and qty>=wholesale_qty then
      w_qty := qty; n_qty := 0;
    else w_qty := 0; n_qty := qty; end if;
    subtotal := round((n_qty*base_price)+(w_qty*coalesce(wholesale_price,0)),2);
    if subtotal<=0 then raise exception 'Não foi possível calcular o preço do produto %',p.name; end if;
    total := total + subtotal;
    rebuilt := rebuilt || jsonb_build_array(jsonb_build_object('product_id',p.id,'name',p.name,'qty',qty,'unit',coalesce(p.unit,'unidade'),'unit_price',round(subtotal/qty,2),'subtotal',subtotal,'image_url',coalesce(p.image_url,'')));
    item_count := item_count+1;
  end loop;
  total := round(total,2);
  if total<=0 then raise exception 'Não foi possível calcular o total do pedido'; end if;
  update public.orders set items=rebuilt,total=total,updated_at=now() where id=target_order_id returning * into ord;
  return ord;
end;
$$;
revoke all on function public.admin_update_order_items(uuid,jsonb) from public;
grant execute on function public.admin_update_order_items(uuid,jsonb) to authenticated;
