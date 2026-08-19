# Whats Sender PRO — Painel Admin

Painel web administrativo ligado ao Supabase do produto.

## O que já existe
- Login administrativo via Supabase Auth
- Dashboard
- Lista e busca de empresas
- Nova empresa + geração de chave
- Renovação +30 / +90 / +365 dias
- Bloquear / desbloquear empresa
- Visualizar e desvincular máquinas
- Histórico de pagamentos
- Rotacionar chave de ativação

## Primeiro acesso
1. No Supabase Dashboard: Authentication → Users → Add user.
2. Crie o primeiro usuário administrativo com e-mail e senha.
3. Copie o UUID do usuário.
4. No SQL Editor:

```sql
insert into public.admin_users (user_id, role, active)
values ('UUID_DO_USUARIO', 'owner', true)
on conflict (user_id) do update
set role = 'owner', active = true;
```

## Rodar localmente
No Windows PowerShell:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite, normalmente http://localhost:5173.

## Publicar depois
Recomendado: Vercel.
- Build command: npm run build
- Output: dist
- Variáveis: VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
- Depois conectar um domínio como admin.seudominio.com

## Segurança
O frontend usa somente a Publishable Key. Toda ação sensível passa pela Edge Function admin-api, que exige JWT e verifica public.admin_users. A service role fica somente no backend.


## v0.2.0

### Administradores
- Menu Administradores visível somente para `owner`.
- Convite por e-mail com perfis: Administrador, Suporte, Financeiro e Somente leitura.
- Desativação e reativação individual sem apagar histórico.
- O owner não pode ser desativado por essa tela.
- Permissões sensíveis continuam validadas no backend, não apenas escondidas na interface.

### Convites
Antes de usar convites em produção, configure em Supabase → Authentication → URL Configuration:
- Site URL: URL pública do painel.
- Redirect URLs: inclua a URL pública do painel.

Em desenvolvimento local você pode adicionar `http://localhost:5173` para testar no mesmo computador.

### Busca automática de CNPJ
Na tela Nova empresa, informe o CNPJ e clique em `Buscar dados`.
A consulta preenche razão social, nome fantasia, e-mail e telefone quando disponíveis.
O backend também aceita o novo CNPJ alfanumérico.

A consulta gratuita usa CNPJ.ws e está sujeita ao limite público do provedor.
