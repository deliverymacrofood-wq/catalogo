# Chat por pedido

Esta versão adiciona um bate-papo exclusivo para cada pedido enquanto o pedido estiver em andamento.

## Importante: Supabase
No SQL Editor do Supabase, execute o bloco final do arquivo `supabase.sql` que começa com `-- Chat exclusivo de cada pedido`. Isso cria a tabela `order_chat_messages` e as políticas de segurança.

## Funcionamento
- Cliente logado vê **Falar sobre este pedido** em pedidos com status Novo, Pronto para pagar ou Pago.
- Administrador vê **Chat do pedido** nesses mesmos status.
- Mensagens são separadas por pedido e não se misturam com o suporte geral.
- O chat atualiza automaticamente a cada 4 segundos.
- Quando o pedido vira **Finalizado** ou **Cancelado**, não aparece mais a opção de enviar novas mensagens.
- O cliente só consegue enviar mensagens nos próprios pedidos.
- O administrador pode responder aos chats dos pedidos.
