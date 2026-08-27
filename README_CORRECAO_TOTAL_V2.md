# Correção definitiva do cálculo do total

Esta versão atualiza os produtos diretamente do Supabase no momento de finalizar o pedido, recalcula promoção/atacado e possui fallback para produtos antigos que só tenham preço normal.

## Supabase

Se você já executou o `CORRECAO_ERRO_TOTAL_PEDIDO.sql` anteriormente, não é necessário executar o SQL novamente para esta correção do navegador.

Caso o banco ainda não tenha o trigger de validação, execute o `CORRECAO_ERRO_TOTAL_PEDIDO.sql` no SQL Editor do Supabase.

## GitHub

Substitua os arquivos do projeto pelos arquivos desta pasta e publique. O `index.html` já está com uma nova versão do `app.js` para evitar cache do navegador.
