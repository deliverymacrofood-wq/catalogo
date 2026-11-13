-- MacroFood: preços promocionais separados para varejo e atacado
-- Execute uma única vez no SQL Editor do projeto Supabase conectado ao catálogo.
alter table public.products
  add column if not exists promo_wholesale_price numeric(12,2),
  add column if not exists promo_wholesale_qty numeric(12,3),
  add column if not exists promo_wholesale_mode text;

alter table public.products
  drop constraint if exists products_promo_wholesale_mode_check;

alter table public.products
  add constraint products_promo_wholesale_mode_check
  check (promo_wholesale_mode is null or promo_wholesale_mode in ('threshold','block'));

comment on column public.products.promo_wholesale_price is 'Preço promocional por unidade no atacado';
comment on column public.products.promo_wholesale_qty is 'Quantidade mínima ou tamanho do bloco para o preço promocional de atacado';
comment on column public.products.promo_wholesale_mode is 'threshold = a partir de X; block = a cada X';
