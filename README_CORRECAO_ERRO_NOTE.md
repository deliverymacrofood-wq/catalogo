# Correção do cadastro de produtos

O erro `Could not find the 'note' column of 'products' in the schema cache` acontece quando o banco usado pelo site ainda não recebeu a coluna `products.note`.

## Correção definitiva
Execute `MIGRACAO_PRODUTOS_NOTE.sql` no SQL Editor do Supabase.

O `admin.js` também recebeu uma proteção de compatibilidade: se o banco antigo ainda não tiver `note`, o produto é salvo sem a observação em vez de o cadastro inteiro falhar.
