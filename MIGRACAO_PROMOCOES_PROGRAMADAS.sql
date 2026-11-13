-- Macrofood: categorias principais e promoções programadas por quantidade/período
begin;

alter table public.products add column if not exists promo_mode text;
alter table public.products add column if not exists promo_qty numeric(10,3);
alter table public.products add column if not exists promo_starts_at timestamptz;
alter table public.products add column if not exists promo_ends_at timestamptz;

alter table public.products drop constraint if exists products_promo_mode_check;
alter table public.products add constraint products_promo_mode_check
  check (promo_mode is null or promo_mode in ('threshold','block'));

-- Cria somente as categorias principais que ainda não existem, respeitando nomes equivalentes.
insert into public.categories(name)
select v.name
from (values
  ('Confeitaria', array['confeitaria']::text[]),
  ('Sorveteria', array['sorveteria']::text[]),
  ('Panificação', array['panificação','panificacao','padaria']::text[]),
  ('Restaurante', array['restaurante']::text[]),
  ('Ocidental', array['ocidental']::text[]),
  ('Bebidas', array['bebidas','bebidas e bomboniere']::text[]),
  ('Resfriado', array['resfriado','frios','laticínios','laticinios']::text[]),
  ('Congelados', array['congelados']::text[])
) as v(name, aliases)
where not exists (
  select 1 from public.categories c
  where lower(trim(c.name)) = any(v.aliases)
)
on conflict(name) do nothing;

create or replace function public.product_price_total(target_product_id uuid, requested_qty numeric)
returns numeric
language plpgsql
security definer
set search_path=public
as $$
declare
  p public.products%rowtype;
  base_price numeric;
  promo_units numeric := 0;
  regular_units numeric := 0;
  wholesale_units numeric := 0;
  wholesale_price numeric;
  wholesale_qty numeric;
  result_total numeric;
begin
  if requested_qty is null or requested_qty <= 0 then
    raise exception 'Quantidade inválida';
  end if;

  select * into p from public.products where id=target_product_id and coalesce(active,true)=true;
  if not found then raise exception 'Produto não disponível'; end if;
  base_price := p.price;
  if base_price is null or base_price <= 0 then raise exception 'Produto % está sem preço válido cadastrado',p.name; end if;

  if p.promo_price is not null and p.promo_price > 0 and p.promo_price < base_price
     and (p.promo_starts_at is null or now() >= p.promo_starts_at)
     and (p.promo_ends_at is null or now() <= p.promo_ends_at) then
    if p.promo_qty is null or p.promo_qty <= 0 then
      promo_units := requested_qty;
    elsif p.promo_mode = 'block' then
      promo_units := floor(requested_qty / p.promo_qty) * p.promo_qty;
    elsif requested_qty >= p.promo_qty then
      promo_units := requested_qty;
    end if;
    if promo_units > 0 then
      regular_units := requested_qty - promo_units;
      result_total := (promo_units * p.promo_price) + (regular_units * base_price);
      return round(result_total,2);
    end if;
  end if;

  wholesale_price := p.wholesale_price;
  wholesale_qty := p.wholesale_qty;
  if wholesale_price is not null and wholesale_price > 0
     and wholesale_qty is not null and wholesale_qty > 0
     and wholesale_price < base_price then
    if p.wholesale_mode = 'block' then
      wholesale_units := floor(requested_qty / wholesale_qty) * wholesale_qty;
    elsif p.wholesale_mode = 'threshold' and requested_qty >= wholesale_qty then
      wholesale_units := requested_qty;
    end if;
  end if;
  result_total := ((requested_qty - wholesale_units) * base_price)
               + (wholesale_units * coalesce(wholesale_price,0));
  return round(result_total,2);
end;
$$;

revoke all on function public.product_price_total(uuid,numeric) from public;
grant execute on function public.product_price_total(uuid,numeric) to authenticated;

create or replace function public.validate_order_totals()
returns trigger
language plpgsql
security definer
set search_path=public
as $func$
declare
  item jsonb;
  p public.products%rowtype;
  pid uuid;
  qty numeric;
  normal_price numeric;
  wholesale_price numeric;
  wholesale_qty numeric;
  wholesale_mode text;
  valid_wholesale boolean;
  w_qty numeric;
  n_qty numeric;
  expected_subtotal numeric;
  expected_total numeric := 0;
  supplied_subtotal numeric;
  supplied_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Pedido inválido: usuário não autenticado';
  end if;

  if new.user_id is null or new.user_id <> auth.uid() then
    raise exception 'Pedido inválido: usuário não autenticado';
  end if;

  if jsonb_typeof(new.items) <> 'array'
     or jsonb_array_length(new.items) < 1
     or jsonb_array_length(new.items) > 100 then
    raise exception 'Itens do pedido inválidos';
  end if;

  for item in select value from jsonb_array_elements(new.items) loop
    begin
      pid := (item->>'product_id')::uuid;
      qty := (item->>'qty')::numeric;
    exception when others then
      raise exception 'Produto ou quantidade inválidos';
    end;

    if qty <= 0 or qty > 9999 then
      raise exception 'Quantidade inválida';
    end if;

    select * into p
    from public.products
    where id = pid and coalesce(active,true) = true
    limit 1;

    if not found then
      raise exception 'Produto não disponível';
    end if;

    if p.unit = 'kg' then
      if round(qty,3) <> qty then
        raise exception 'Peso inválido: use no máximo 3 casas decimais';
      end if;
    else
      if qty <> trunc(qty) then
        raise exception 'Quantidade de unidade inválida';
      end if;
    end if;

    if p.price is null or p.price <= 0 then
      raise exception 'Produto % está sem preço válido cadastrado', p.name;
    end if;

    expected_subtotal := public.product_price_total(pid, qty);

    supplied_subtotal := round(
      coalesce((item->>'subtotal')::numeric, -1),
      2
    );

    if supplied_subtotal <> expected_subtotal then
      raise exception 'Preço do pedido inválido para o produto %', p.name;
    end if;

    expected_total := expected_total + expected_subtotal;
  end loop;

  expected_total := round(expected_total,2);
  supplied_total := round(coalesce(new.total,-1),2);

  if expected_total <= 0 then
    raise exception 'Não foi possível calcular o total do pedido';
  end if;

  if supplied_total <> expected_total then
    raise exception 'Total do pedido inválido';
  end if;

  new.total := expected_total;
  new.updated_at := now();

  return new;
end;
$func$;

create or replace function public.admin_update_order_items(
  target_order_id uuid,
  new_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path=public
as $func$
declare
  ord public.orders;
  item jsonb;
  p public.products%rowtype;
  pid uuid;
  qty numeric;
  base_price numeric;
  wp numeric;
  wq numeric;
  wqty numeric;
  nqty numeric;
  subtotal numeric;
  order_total numeric := 0;
  rebuilt jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Acesso negado: somente administradores podem alterar pedidos';
  end if;

  select * into ord
  from public.orders
  where id = target_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  if ord.status not in (
    'received','accepted','separating',
    'waiting_payment','ready_pickup','paid'
  ) then
    raise exception 'Este pedido não pode mais ser alterado';
  end if;

  if jsonb_typeof(new_items) <> 'array'
     or jsonb_array_length(new_items) < 1
     or jsonb_array_length(new_items) > 100 then
    raise exception 'Itens do pedido inválidos';
  end if;

  for item in select value from jsonb_array_elements(new_items) loop
    begin
      pid := (item->>'product_id')::uuid;
      qty := (item->>'qty')::numeric;
    exception when others then
      raise exception 'Produto ou quantidade inválidos';
    end;

    if qty <= 0 or qty > 9999 then
      raise exception 'Quantidade inválida';
    end if;

    select * into p
    from public.products
    where id = pid and coalesce(active,true) = true
    limit 1;

    if not found then
      raise exception 'Produto não disponível';
    end if;

    if p.unit = 'kg' then
      if round(qty,3) <> qty then
        raise exception 'Peso inválido: use no máximo 3 casas decimais';
      end if;
    else
      if qty <> trunc(qty) then
        raise exception 'Quantidade de unidade inválida';
      end if;
    end if;

    subtotal := public.product_price_total(pid, qty);

    order_total := order_total + subtotal;

    rebuilt := rebuilt || jsonb_build_array(
      jsonb_build_object(
        'product_id', p.id,
        'name', p.name,
        'qty', qty,
        'unit', coalesce(p.unit,'unidade'),
        'unit_price', round(subtotal / qty,2),
        'subtotal', subtotal,
        'image_url', coalesce(p.image_url,'')
      )
    );
  end loop;

  order_total := round(order_total,2);

  update public.orders
  set items = rebuilt,
      total = order_total,
      updated_at = now()
  where id = target_order_id
  returning * into ord;

  return ord;
end;
$func$;

commit;
