# Segurança

## Nunca colocar no frontend
- `SUPABASE_SERVICE_ROLE_KEY`
- secret keys do Supabase
- credenciais de gateway
- senhas de administradores

## Permitido no frontend
- URL do projeto Supabase
- Publishable Key (`sb_publishable_...`)

## Autorização
O painel considera o Supabase Auth para autenticação e `public.admin_users` para autorização administrativa.

## Senhas
- Recuperação: e-mail do Supabase + `updateUser`.
- Usuário logado: `updateUser` com senha atual.
- Outro administrador: enviar recuperação; não definir/armazenar senha conhecida pelo owner.

## Sessões
O usuário pode encerrar outras sessões ou todas as sessões pelo Supabase Auth.
