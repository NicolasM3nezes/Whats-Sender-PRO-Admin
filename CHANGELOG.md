# Changelog

## 1.1.0 — 2026-08-20
- Sistema passou a ser área exclusiva do Owner no frontend e no backend.
- Gestão de releases em Sistema → Atualizações.
- Publicação por testadores, empresa, percentual ou todos.
- Métricas de download, instalação, falha e adoção de versão.
- Ações de editar, tornar obrigatória, alterar rollout e retirar release.
- Nova área Operação para Owner/Admin/Support.
- Heartbeat dos computadores, versões instaladas, Windows/Chrome e estado técnico.
- Campanhas agregadas no Admin sem conteúdo de mensagens ou telefones.
- Erros técnicos recentes sem PII.
- Edge Functions `release-console`, `desktop-telemetry` e `operations-console`.
- Tabelas de telemetria com RLS e sem acesso direto pelo cliente.
- `release-admin` restrito somente ao Owner.
- `rls_auto_enable()` removida da superfície pública.
- `is_platform_admin()` movida para schema privado.

## 1.0.0 — 2026-08-19
- Painel reorganizado em múltiplos módulos.
- Recuperação de senha completa no domínio.
- Criação de senha para administradores convidados.
- Minha Conta com alteração de senha e gestão de sessões.
- Gestão de administradores e perfis.
- Busca automática de CNPJ e suporte a CNPJ alfanumérico.
- Edição de cadastro da empresa.
- Nome amigável para máquinas.
- Pagamentos manuais.
- Auditoria administrativa.
- Controle de versão e modo manutenção.
- Edge Function `admin-console` para ações complementares.
