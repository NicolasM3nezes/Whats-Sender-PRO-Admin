# Checklist de produção

## Supabase Auth
- [ ] Site URL aponta para o domínio real do painel.
- [ ] Redirect URL contém `/reset-password`.
- [ ] Redirect URL contém `/accept-invite`.
- [ ] SMTP próprio configurado para convites/recuperação.
- [ ] Proteção contra senhas vazadas habilitada quando disponível.
- [ ] Política de senha forte definida.
- [ ] MFA/passkeys avaliados para owners.

## GitHub / Vercel
- [ ] Repositório do Admin está privado.
- [ ] `.env` não foi commitado.
- [ ] Vercel contém apenas Publishable Key no frontend.
- [ ] Branch principal protegida quando houver mais desenvolvedores.
- [ ] Preview/staging usado para mudanças grandes.

## Supabase Security Advisor observado em 2026-08-19
O projeto apresentava avisos que devem ser revisados antes de ampliar o uso:

1. `public.rls_auto_enable()` é `SECURITY DEFINER` e aparecia executável por `anon`/`authenticated`.
   - Essa função é infraestrutura/event trigger e merece revisão específica antes de alterar os grants.

2. `public.is_platform_admin()` é `SECURITY DEFINER` e executável por `authenticated`.
   - Ela é usada nas políticas RLS de leitura administrativa, então não deve ser simplesmente revogada sem redesenhar as policies.

3. Leaked Password Protection estava desabilitado.
   - Recomenda-se habilitar a proteção de senhas comprometidas no Supabase Auth quando possível.

## Produto / licenciamento
- [ ] Definir versão mais recente.
- [ ] Definir versão mínima somente quando houver processo de atualização testado.
- [ ] Configurar URL de atualização.
- [ ] Configurar URL de suporte.
- [ ] Testar modo manutenção antes de usar em produção.
