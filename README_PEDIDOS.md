# MacroFood — Meus pedidos e cadastro no pedido

## Novidades
- Cliente logado pode acessar `pedidos.html` em **Meus pedidos**.
- O cliente acompanha os status do pedido.
- O cliente pode cancelar enquanto o pedido estiver em `Novo`, `Pronto para pagar` ou `Pago`.
- Ao finalizar um pedido, o sistema pergunta se o cliente já possui cadastro no WhatsApp de vendas.
- Com cadastro: solicita apenas Nome e CPF.
- Sem cadastro + CPF: Nome, CPF, CEP e celular/WhatsApp são obrigatórios; e-mail é opcional.
- Sem cadastro + CNPJ: somente CNPJ é obrigatório; os demais dados ficam disponíveis para preenchimento.
- Os dados ficam registrados no pedido para o administrador consultar.

## Supabase
Execute o `supabase.sql` completo no SQL Editor do Supabase.
