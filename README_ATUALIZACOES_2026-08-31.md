# MacroFood — atualizações 31/08/2026

Foram implementadas as 11 alterações solicitadas.

## Importante: Supabase
Abra o arquivo `supabase.sql` e execute **todo o conteúdo** no SQL Editor do Supabase. A parte final do arquivo contém a migração das novas funções.

Ela cria/atualiza:
- novos status de pedido;
- forma de recebimento (entrega, retirada em loja, Uber);
- controles de disponibilidade;
- venda por kg com até 3 casas decimais;
- edição do peso e recálculo do pedido pelo administrador;
- produtos marcados como novidade;
- ranking público de produtos mais vendidos;
- limite de 10 banners;
- função de pedidos em manutenção.

## Remoção de fundo
No cadastro/edição de produto, use a opção **“Remover fundo automaticamente”**. No celular, o campo de foto usa `capture="environment"` para facilitar a abertura da câmera.

A remoção é feita no próprio navegador por processamento de imagem, sem enviar a foto para um serviço externo.

## Novos status
O administrador pode selecionar:
- Pedido aceito
- Pedido em separação
- Pedido esperando pagamento
- Pedido pronto para retirada
- Pedido finalizado

Os pedidos antigos com status `ready_payment` são migrados para `waiting_payment`.

## Observação sobre kg
Produtos marcados como `Kg` aceitam pesos como `0,125`, `0,750` ou `1,250`. O administrador pode corrigir o peso durante a separação e o Supabase recalcula subtotal e total.
