# MacroFood — versão reconstruída do catálogo

Esta versão foi reorganizada para corrigir o problema em que o layout não correspondia ao mockup e partes do catálogo/funções não apareciam.

## Principais correções
- Layout do catálogo reconstruído com laranja como cor dominante.
- Desktop e celular com estruturas próprias e responsivas.
- Tema claro/escuro salvo no navegador do cliente.
- Banner principal com suporte a até 10 banners e fallback visual quando ainda não há banner cadastrado.
- Faixa de benefícios, promoções, novidades, categorias e todos os produtos.
- Carrinho flutuante e carrinho em formato de gaveta.
- Carregamento de produtos em páginas de 500 registros para não parar no limite padrão de consulta.
- Ranking de Mais Vendidos usando pedidos finalizados, com fallback local caso a RPC ainda não exista.
- Cadastro de produto com código de até 6 dígitos, unidade/kg, novidade, promoção, atacado e remoção de fundo.
- Pedidos com os novos status, exclusão pelo administrador, alteração de itens/peso e formas de recebimento.
- Entrega, retirada em loja e Uber podem ser ativadas/desativadas no painel.
- Para Uber, o cliente recebe o contato +55 (81) 97117-8793.
- SQL corrigido: removido o `END IF` inválido da função de alteração de pedido.

## Instalação
1. Suba os arquivos desta pasta para o mesmo diretório publicado pelo GitHub Pages/host.
2. Mantenha `config.js` com o URL e a chave anon do Supabase.
3. No Supabase SQL Editor, execute o arquivo `supabase.sql` completo em uma nova query.
4. Depois de publicar, faça um hard refresh no navegador (Ctrl+F5).

## Observação sobre fotos
A remoção de fundo é feita no navegador, sem depender de API paga. Ela funciona melhor com fundo uniforme/contrastante.
