# MacroFood — URLs corrigidas

Estrutura publicada pelo GitHub Pages:

- Catálogo: `/catalogo/`
- Login/Minha conta: `/catalogo/login/`
- Administração: `/catalogo/admin/`

O problema corrigido era um caminho relativo dentro de `login/index.html`/`auth.js`:
`admin/` era interpretado pelo navegador como `/catalogo/login/admin/`, que não existe.

Agora o painel administrativo é acessado por:
`/catalogo/admin/`

Os links de pedidos, suporte e retorno ao catálogo dentro da área de login também foram ajustados para respeitar a pasta `/login/`.

Não é necessário digitar `index.html` nessas URLs.
