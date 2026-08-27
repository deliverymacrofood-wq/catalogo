# Correção da versão atual — erro ao finalizar pedido

Foi corrigido o erro:

`null value in column "total" of relation "orders" violates not-null constraint`

## O que foi corrigido no site
- O total do carrinho agora é recalculado com números válidos.
- O sistema aceita preços no formato `24.90`, `24,90` e `R$ 24,90`.
- `NaN`, `undefined` e `null` não são enviados como total.
- Produtos sem preço válido são identificados antes de finalizar.
- O cálculo de atacado continua funcionando:
  - **A partir de 12:** 12 ou mais unidades recebem preço de atacado.
  - **A cada 12:** 12 recebem atacado; 13 = 12 atacado + 1 normal.
- O painel administrativo agora impede salvar produto sem preço válido.

## IMPORTANTE: Supabase

Atualizar os arquivos do GitHub **não altera o banco Supabase**.

Depois de publicar os arquivos, abra:

**Supabase → SQL Editor → New query**

Cole e execute o conteúdo de:

`CORRECAO_ERRO_TOTAL_PEDIDO.sql`

Isso garante que o banco também recalcule/valide o total e impede que um pedido seja salvo com total inválido.

## Depois de publicar no GitHub
1. Substitua os arquivos pelo conteúdo desta versão.
2. Faça commit/push.
3. Aguarde o GitHub Pages atualizar.
4. No celular/computador, faça uma atualização forçada da página.
5. Execute o SQL acima no Supabase.
6. Teste um produto sem atacado e um produto com atacado.

Se existir algum produto antigo com `price` nulo ou `0`, o SQL de diagnóstico no final do arquivo mostra quais são. Corrija o preço desse produto no painel administrativo.
