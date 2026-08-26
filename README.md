# MACROFOOD — Catálogo Online com Administração

Esta versão usa **Supabase** para:
- Login de administrador
- Banco de produtos
- Upload de imagens
- Preços
- Setores
- Catálogo público
- Controle de acesso por função (`admin`)
- Produtos ativos/inativos

## 1. Criar o banco

1. Crie um projeto no Supabase.
2. Abra **SQL Editor**.
3. Cole e execute o arquivo `supabase.sql`.

## 2. Criar o primeiro administrador

No Supabase, abra **Authentication > Users** e crie o usuário do administrador com e-mail e senha.

Depois, no SQL Editor, execute:

```sql
update public.profiles
set role = 'admin'
where email = 'SEU_EMAIL_AQUI';
```

O trigger do banco cria o perfil automaticamente quando o usuário é criado.

## 3. Colocar as credenciais

Abra `config.js` e informe:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Essas duas informações ficam em:
**Supabase > Project Settings > API**

## 4. Publicar

Você pode publicar estes arquivos em serviços como Netlify, Vercel, GitHub Pages ou outro servidor de hospedagem de páginas estáticas.

Arquivos principais:
- `index.html` — catálogo público
- `admin.html` — painel administrativo
- `config.js` — conexão com Supabase
- `app.js` — catálogo
- `admin.js` — administração
- `supabase.sql` — banco, segurança e storage

## 5. Segurança

A senha não fica no código. O login é feito pelo Supabase Auth.

O banco possui políticas RLS:
- visitantes podem visualizar somente produtos ativos;
- somente usuários com perfil `admin` podem cadastrar, editar, excluir e enviar imagens.

## Observação

Não coloque a `service_role key` no site. Use somente a `anon/publishable key` no `config.js`.
