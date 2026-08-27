# MacroFood — confirmação de e-mail/celular

Esta versão mantém o cadastro sem confirmação imediata e faz a confirmação dentro de **Minha conta**.

## 1. Atualizar o banco no Supabase

1. Abra o projeto no Supabase.
2. Entre em **SQL Editor**.
3. Crie um novo query.
4. Abra o arquivo `supabase.sql` deste ZIP e copie todo o conteúdo.
5. Cole no SQL Editor e clique em **Run**.
6. Aguarde terminar sem erros.

O SQL cria a tabela `contact_verifications` e duas funções protegidas:
- `mark_email_contact_verified()`
- `mark_phone_contact_verified()`

O cliente não recebe permissão para alterar diretamente esses campos.

## 2. Configurar o cadastro para continuar sem confirmação

No Supabase:

**Authentication → Providers → Email**

- Email provider: **ON**
- Confirm email: **OFF**

Isso permite que o cliente crie a conta e entre normalmente. A confirmação para compras será feita depois em **Minha conta**.

## 3. Configurar o código de confirmação por e-mail

Ainda no Supabase:

**Authentication → Email Templates → Reauthentication**

O corpo do e-mail precisa conter `{{ .Token }}`. Exemplo:

```html
<h2>Confirmação da MacroFood</h2>
<p>Seu código para confirmar o e-mail é:</p>
<h1>{{ .Token }}</h1>
<p>Digite esse código na área Minha conta do site.</p>
```

O fluxo usa `auth.reauthenticate()` para enviar o código e `verifyOtp` com o tipo `reauthentication` para validar o código.

## 4. Configurar celular/SMS

Para confirmação de celular:

**Authentication → Providers → Phone**

- Ative Phone.
- Configure um provedor de SMS compatível, como Twilio, MessageBird ou Vonage.
- Salve a configuração.

O site usa `updateUser({ phone })` e depois `verifyOtp({ phone, token, type: 'phone_change' })`.

## 5. Testar

### E-mail

1. Crie/entre em uma conta.
2. Vá em **Minha conta**.
3. Clique em **Enviar código por e-mail**.
4. Abra o e-mail recebido.
5. Digite o código.
6. A tela deve mostrar **E-mail confirmado**.
7. Adicione um produto ao carrinho e tente finalizar.
8. A compra deve ser permitida.

### Celular

1. Entre em **Minha conta**.
2. Informe o celular com DDD.
3. Clique em **Enviar código SMS**.
4. Digite o código recebido.
5. A tela deve mostrar **Celular confirmado**.
6. A compra deve ser liberada.

## 6. Regra da compra

O cliente pode comprar quando pelo menos um destes estiver confirmado:

- `email_verified = true`
- `phone_verified = true`

O site não usa mais somente `email_confirmed_at`/`phone_confirmed_at` do Auth para decidir se a compra pode ser feita, porque o cadastro foi configurado para não exigir confirmação imediatamente.

## Importante

Não coloque a `service_role` key no `config.js` ou em qualquer arquivo público do GitHub. O site usa apenas a chave pública/publishable do Supabase.
