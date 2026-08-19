# Whats Sender PRO — Admin v1.0.0

Painel administrativo web do Whats Sender PRO.

## O que esta versão contém

### Autenticação e segurança
- Login com Supabase Auth.
- Recuperação de senha pelo próprio painel.
- Rota `/reset-password` para criar nova senha a partir do e-mail.
- Convite de administrador com rota `/accept-invite` para o convidado criar a própria senha.
- Alteração da própria senha informando a senha atual.
- Encerra outras sessões ou todas as sessões.
- Perfil administrativo e nome do usuário.
- Perfis: `owner`, `admin`, `finance`, `support`, `read_only`.
- Ações privilegiadas ficam em Edge Functions; a `service_role` não vai para o frontend.

### Empresas
- Dashboard com métricas.
- Lista e busca de empresas.
- Cadastro de empresa.
- Busca automática de CNPJ via backend.
- Compatibilidade com CNPJ alfanumérico.
- Edição de razão social, fantasia, CNPJ, e-mails, telefone e observações.
- Renovação +30, +90 e +365 dias.
- Bloquear/desbloquear empresa.
- Rotação de chave da licença.

### Máquinas
- Lista de dispositivos ativados.
- Último acesso, versão do app e sistema operacional.
- Nome amigável da máquina.
- Desvincular dispositivo.

### Financeiro
- Histórico de pagamentos.
- Registro manual de pagamento (PIX, cartão, boleto, transferência, dinheiro ou outro).
- Estrutura pronta para futuros gateways.

### Equipe
- Lista de administradores.
- Convite por e-mail.
- Alteração de perfil e status.
- Desativação sem apagar histórico.
- Envio de redefinição de senha.

### Auditoria
- Histórico de operações administrativas.
- Administrador responsável.
- Empresa relacionada.
- Dados antes/depois quando disponíveis.

### Sistema
- Versão mais recente do aplicativo.
- Versão mínima suportada.
- Modo manutenção.
- Mensagem de manutenção.
- URL de suporte.
- URL de atualização.
- Notas de versão.

## Backend

O frontend utiliza as Edge Functions existentes:
- `admin-api`
- `admin-management`
- `company-create-v2`
- `cnpj-lookup`

E a nova função complementar:
- `admin-console`

A função `admin-console` já foi implantada no projeto Supabase utilizado durante o desenvolvimento. O código-fonte também está em:

`supabase/functions/admin-console/index.ts`

## Variáveis de ambiente

Copie `.env.example` para `.env` no desenvolvimento local.

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Nunca coloque `service_role` em variável `VITE_*`.

## Rodar localmente

```powershell
Copy-Item .env.example .env
npm install
npm run check
npm run dev
```

## Build

```powershell
npm run build
```

A saída será criada em `dist/`.

## Publicar na Vercel

1. Suba o projeto para o repositório do painel.
2. Importe o repositório na Vercel.
3. Framework: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Configure:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
7. `vercel.json` já inclui o fallback necessário para rotas SPA.

Depois, cada push na branch de produção pode gerar novo deploy automaticamente.

## Configuração obrigatória do Supabase Auth

Em **Authentication → URL Configuration**:

### Site URL

Use o domínio final do painel:

```text
https://admin.seudominio.com
```

### Redirect URLs

Adicione pelo menos:

```text
https://admin.seudominio.com/reset-password
https://admin.seudominio.com/accept-invite
http://localhost:5173/reset-password
http://localhost:5173/accept-invite
```

Se usar previews da Vercel, adicione a URL de preview apropriada conforme sua política de segurança.

## Fluxo de recuperação de senha

1. Login → `Esqueci minha senha`.
2. O painel chama `resetPasswordForEmail`.
3. O Supabase envia o e-mail.
4. O link volta para `/reset-password`.
5. O Supabase cria a sessão de recuperação.
6. O painel chama `updateUser({ password })`.
7. O usuário volta para o login.

## Fluxo de convite de administrador

1. Owner → Administradores → Convidar.
2. `admin-management` usa Supabase Auth Invite.
3. O e-mail aponta para `/accept-invite`.
4. O convidado define a própria senha.
5. O perfil definido pelo owner controla as permissões do painel.

## Segurança

- `service_role` somente em Edge Functions.
- Frontend usa somente Publishable Key.
- Edge Functions administrativas exigem JWT válido.
- As funções conferem `public.admin_users` antes das operações.
- A senha dos usuários não é exibida nem armazenada pelo painel.
- Para redefinir senha de outro administrador, o owner envia um fluxo de recuperação em vez de conhecer a senha do usuário.

## Antes de produção em escala

Recomendado:
- deixar o repositório do painel privado;
- configurar SMTP próprio no Supabase para e-mails confiáveis;
- habilitar proteção contra senhas vazadas quando disponível no plano;
- revisar os Security Advisors do Supabase;
- ativar MFA/passkeys quando decidir elevar o nível de segurança;
- adicionar ambiente de staging antes de mudanças grandes.
