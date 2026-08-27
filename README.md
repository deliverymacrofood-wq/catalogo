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

## Confirmação de conta por e-mail ou celular

O cadastro agora permite escolher **Confirmar por e-mail** ou **Confirmar por celular (SMS)**.

### E-mail
No Supabase, em Authentication > URL Configuration, adicione a URL pública do `login.html` em Redirect URLs (por exemplo, `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/login.html`). O e-mail de confirmação deve estar habilitado.

### Celular
No Supabase, em Authentication > Providers, habilite **Phone** e configure um provedor de SMS. Sem um provedor SMS configurado, o Supabase não consegue enviar o código e o cadastro por celular não funcionará.

Depois de alterar o banco, execute o `supabase.sql` para adicionar o campo `profiles.phone`.


## Nova regra de confirmação de conta
- O cadastro não pede mais confirmação de e-mail ou celular.
- Para permitir criação de conta sem confirmação imediata, no Supabase vá em Authentication > Providers > Email e desative a exigência de confirmação de e-mail.
- O cliente confirma e-mail ou celular posteriormente em Minha conta.
- O checkout bloqueia a compra se nenhum dos dois estiver confirmado e encaminha o cliente para Minha conta.
- Para confirmação por SMS, configure um provedor SMS no Supabase.

## Segurança reforçada

Esta versão adiciona duas proteções importantes no Supabase:

1. **Escalada de privilégio bloqueada:** clientes não conseguem alterar diretamente `profiles.role`. A atualização do perfil passa pela função `update_my_profile`, que só permite apelido, foto e telefone.
2. **Pedido protegido no banco:** o Supabase recalcula o preço, atacado e total dos pedidos antes de gravar. Assim, alterar valores no navegador não permite comprar por preço falsificado.

### Configurações recomendadas no Supabase
- Nunca coloque a chave `service_role` no GitHub ou em JavaScript do navegador. O site deve usar somente a chave `anon`/publishable.
- Mantenha **RLS (Row Level Security)** ativado nas tabelas do projeto.
- Em Authentication, mantenha proteção contra senhas vazadas habilitada quando disponível e use uma senha forte para administradores.
- Não transforme nenhum cliente em administrador pelo site. A promoção para `role='admin'` deve ser feita somente por um administrador confiável no banco/console.
- Depois de aplicar o `supabase.sql`, teste uma conta de cliente tentando alterar o perfil: ela deve conseguir alterar apenas apelido/foto/telefone e nunca `role`.

### Aplicação
Execute o arquivo `supabase.sql` no **Supabase > SQL Editor**. Depois publique os arquivos do ZIP no GitHub.
