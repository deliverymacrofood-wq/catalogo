-- MacroFood: correção do erro ao cadastrar produto
-- Execute no SQL Editor do Supabase.

alter table public.products add column if not exists note text;

-- Solicita ao PostgREST/Supabase que recarregue o schema em cache.
notify pgrst, 'reload schema';
