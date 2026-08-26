# Macrofood – catálogo + painel administrativo + pedidos

## Configuração
1. Abra `config.js` e informe `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
2. Execute o `supabase.sql` completo no SQL Editor do Supabase.
3. No Supabase, mantenha o bucket `product-images` e `banner-images` públicos para leitura.
4. Configure Authentication > URL Configuration com a URL publicada do site.
5. Para permitir login imediato sem confirmação de e-mail, desative Authentication > Providers > Email > Confirm email. Se deixar ativo, o cliente precisa confirmar o e-mail antes de entrar.

## Pedidos
- O cliente monta o carrinho e clica em **Fazer pedido**.
- O site pede **nome e WhatsApp** (obrigatórios) e observação opcional.
- O pedido é salvo na tabela `orders` do Supabase e **não é enviado automaticamente para o WhatsApp**.
- O administrador encontra os pedidos em **Painel > Pedidos**.
- Novo: pedido recebido → **Finalizar e avisar no WhatsApp** → status **Pronto para pagar**.
- O administrador pode **Marcar como pago** quando confirmar o pagamento.
- Depois de pago, há o botão **Entrar em contato pelo WhatsApp** para falar com o cliente e combinar entrega/retirada.
- O navegador abre o WhatsApp com uma mensagem pronta; o envio final é feito pelo administrador.

## Segurança
- Clientes podem inserir pedidos, mas só administradores podem listar, alterar ou cancelar pedidos.
- A senha dos clientes nunca fica visível no painel. A redefinição usa o fluxo seguro do Supabase Authentication.
- Não coloque a `service_role key` no frontend.
