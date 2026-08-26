# Macrofood - catálogo

## Recursos
- Carrinho e envio do pedido para WhatsApp.
- WhatsApp configurável pelo administrador.
- Avaliação de 1 a 5 estrelas e comentário sem login.
- Estoque: administrador marca produto com/sem estoque.
- Promoções: preço antigo + preço promocional.
- Banners no topo administráveis.
- Instagram e WhatsApp no rodapé.

## Configuração
1. Execute `supabase.sql` no SQL Editor do Supabase.
2. Confira `config.js`: a URL deve ser a Project URL, sem `/rest/v1/`.
3. Crie um usuário em Authentication > Users e dê `role = admin` na tabela `profiles`.
4. Abra `admin.html` para cadastrar produtos, promoções, banners e WhatsApp.
