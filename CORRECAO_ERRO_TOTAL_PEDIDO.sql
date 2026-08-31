-- MacroFood: correção definitiva do erro
-- "null value in column total of relation orders violates not-null constraint"
--
-- Execute ESTE arquivo no Supabase > SQL Editor uma única vez.
-- O código do site também foi corrigido para nunca enviar NaN/null como total.

alter table public.orders
  alter column total set default 0;

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
begin
  if auth.uid() is null or new.user_id is null or new.user_id <> auth.uid() then
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

    if qty is null or qty <= 0 or qty > 9999 or qty <> trunc(qty) then
      raise exception 'Quantidade inválida';
    end if;

    select * into p
      from public.products
     where id=pid and coalesce(active,true)=true
     limit 1;

    if not found then
      raise exception 'Produto não disponível';
    end if;

    if p.price is null or p.price <= 0 then
      raise exception 'Produto "%" está sem preço válido cadastrado', p.name;
    end if;

    normal_price := case
      when p.promo_price is not null
       and p.promo_price > 0
       and p.promo_price < p.price
      then p.promo_price
      else p.price
    end;

    if normal_price is null or normal_price <= 0 then
      raise exception 'Produto "%" está sem preço válido cadastrado', p.name;
    end if;

    wholesale_price := p.wholesale_price;
    wholesale_qty := p.wholesale_qty;
    wholesale_mode := p.wholesale_mode;

    valid_wholesale :=
      wholesale_price is not null
      and wholesale_price > 0
      and wholesale_qty is not null
      and wholesale_qty > 0
      and wholesale_price < normal_price;

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

    if expected_subtotal is null or expected_subtotal <= 0 then
      raise exception 'Não foi possível calcular o preço do produto "%"', p.name;
    end if;

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

-- Diagnóstico opcional: produtos sem preço não poderão ser vendidos até serem corrigidos.
-- SELECT id, name, price FROM public.products WHERE price IS NULL OR price <= 0;
