# Macrofood PWA — instalação como aplicativo

Este projeto foi preparado como PWA (Progressive Web App), usando o catálogo existente.

## Publicar no GitHub Pages
1. Extraia o ZIP e envie **todo o conteúdo da pasta `catalogo-main`** para a raiz do repositório GitHub `catalogo` (mantendo as pastas `admin/` e `login/`).
2. Faça commit/push e aguarde o GitHub Pages publicar.
3. Abra `https://deliverymacrofood-wq.github.io/catalogo/` em HTTPS.
4. Android: abra no Chrome e use **Instalar** quando aparecer, ou menu ⋮ → Instalar aplicativo / Adicionar à tela inicial.
5. iPhone: abra o endereço no Safari → Compartilhar → **Adicionar à Tela de Início**.

## O que foi adicionado
- `manifest.webmanifest`: nome, ícones, cores e modo standalone.
- `icon-192.png` e `icon-512.png`: ícones do app.
- `sw.js`: cache de arquivos do site e fallback básico para navegação offline.
- `pwa.js`: registro do service worker e instruções de instalação.
- Metadados e script de PWA nas páginas HTML existentes.

## Observações importantes
- PWA requer HTTPS (GitHub Pages já oferece HTTPS).
- O catálogo e autenticação dependem do Supabase e da internet. O modo offline não permite consultar/atualizar dados dinâmicos, entrar na conta ou enviar pedidos sem conexão.
- O service worker não armazena respostas do Supabase/API em cache.
- O iPhone não usa o mesmo botão de instalação automática do Chrome; a instalação é pelo Safari e menu Compartilhar.
- Após atualizar arquivos do app, o service worker pode levar uma abertura/atualização para ativar a nova versão. Se necessário, feche e abra novamente o app.
