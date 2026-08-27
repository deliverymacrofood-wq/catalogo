# MacroFood — Vendas por dia, unidade/kg e preço de atacado

## 1. Atualize o Supabase
Abra o SQL Editor do seu projeto Supabase e execute o arquivo `supabase.sql` completo desta versão.

Ele adiciona aos produtos:
- `unit`: `unidade` ou `kg`
- `wholesale_mode`: `threshold` (a partir de X) ou `block` (a cada X)
- `wholesale_qty`: quantidade X
- `wholesale_price`: preço de atacado

## 2. Total de vendas no Dashboard
No painel administrativo, o Dashboard ganhou uma consulta por dia. O valor soma somente pedidos com status `completed` (Finalizado).

## 3. Cadastro de produto
Em Produtos > Cadastrar produto:
- escolha se é vendido por Unidade ou Kg;
- opcionalmente informe preço de atacado;
- escolha se o atacado vale a partir de X unidades/kg ou a cada X unidades/kg;
- informe a quantidade X e o preço de atacado.

O catálogo passa a mostrar a unidade junto do preço e o carrinho calcula o preço de atacado conforme a quantidade.

## 4. GitHub Pages
Substitua os arquivos da versão anterior por todos os arquivos deste ZIP. Depois faça um recarregamento forçado do navegador para evitar cache antigo.
