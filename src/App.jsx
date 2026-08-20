import React, { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { adminConsole } from './lib/api'
import { usePathname } from './lib/router'
import { Brand, Loading, RoleBadge } from './components/ui'
import { AcceptInvitePage, ForgotPasswordPage, LoginPage, ResetPasswordPage } from './pages/AuthPages'
import DashboardPage from './pages/DashboardPage'
import CompaniesPage from './pages/CompaniesPage'
import NewCompanyPage from './pages/NewCompanyPage'
import CompanyPage from './pages/CompanyPage'
import AdminsPage from './pages/AdminsPage'
import AuditPage from './pages/AuditPage'
import OperationsPage from './pages/OperationsPage'
import SystemPage from './pages/SystemPage'
import AccountPage from './pages/AccountPage'
import DownloadPage from './pages/DownloadPage'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('Admin UI error', error, info) }
  render() {
    if (this.state.error) return <main className="fatal-page"><section className="fatal-card"><div className="brand-mark">WS</div><h1>Algo saiu do esperado</h1><p>{this.state.error.message || 'Erro inesperado.'}</p><button className="primary" onClick={() => window.location.reload()}>Recarregar painel</button></section></main>
    return this.props.children
  }
}

function Unauthorized({ navigate }) {
  return <div className="state error-state"><strong>Acesso não permitido</strong><span>Seu perfil não possui permissão para esta área.</span><button className="secondary" onClick={() => navigate('/')}>Voltar ao início</button></div>
}

function Sidebar({ me, path, navigate }) {
  const items = [
    { path: '/', label: 'Visão geral', icon: '▦', show: true },
    { path: '/companies', label: 'Empresas', icon: '▤', show: true },
    { path: '/companies/new', label: 'Nova empresa', icon: '+', show: ['owner', 'admin', 'finance'].includes(me.role) },
    { path: '/operations', label: 'Operação', icon: '◉', show: ['owner', 'admin', 'support'].includes(me.role) },
    { path: '/admins', label: 'Administradores', icon: '♙', show: me.role === 'owner' },
    { path: '/audit', label: 'Auditoria', icon: '◎', show: ['owner', 'admin'].includes(me.role) },
    { path: '/system', label: 'Sistema', icon: '⚙', show: me.role === 'owner' },
  ]
  function active(item) {
    if (item.path === '/') return path === '/'
    if (item.path === '/companies') return path === '/companies' || /^\/companies\/[^/]+$/.test(path)
    return path === item.path
  }
  return <aside className="sidebar">
    <Brand compact />
    <nav>{items.filter(i => i.show).map(item => <button key={item.path} className={active(item) ? 'active' : ''} onClick={() => navigate(item.path)}><span className="nav-icon">{item.icon}</span>{item.label}</button>)}</nav>
    <div className="sidebar-foot">
      <button className={`account-mini ${path === '/account' ? 'active' : ''}`} onClick={() => navigate('/account')}><span className="avatar-mini">{(me.name || me.email || 'A').slice(0, 1).toUpperCase()}</span><span className="account-mini-copy"><strong>{me.name || me.email}</strong><small>{me.email}</small></span></button>
      <div className="sidebar-role"><RoleBadge role={me.role} /></div>
      <button className="sidebar-logout" onClick={() => supabase.auth.signOut({ scope: 'local' })}>Sair</button>
    </div>
  </aside>
}

function ProtectedApp({ session, me, refreshMe, path, navigate }) {
  const newCompanyAllowed = ['owner', 'admin', 'finance'].includes(me.role)
  const operationsAllowed = ['owner', 'admin', 'support'].includes(me.role)
  const auditAllowed = ['owner', 'admin'].includes(me.role)
  const systemAllowed = me.role === 'owner'

  let page
  if (path === '/') page = <DashboardPage navigate={navigate} me={me} />
  else if (path === '/companies') page = <CompaniesPage navigate={navigate} me={me} />
  else if (path === '/companies/new') page = newCompanyAllowed ? <NewCompanyPage navigate={navigate} /> : <Unauthorized navigate={navigate} />
  else if (/^\/companies\/[^/]+$/.test(path)) page = <CompanyPage id={path.split('/')[2]} navigate={navigate} me={me} />
  else if (path === '/operations') page = operationsAllowed ? <OperationsPage /> : <Unauthorized navigate={navigate} />
  else if (path === '/admins') page = me.role === 'owner' ? <AdminsPage /> : <Unauthorized navigate={navigate} />
  else if (path === '/audit') page = auditAllowed ? <AuditPage /> : <Unauthorized navigate={navigate} />
  else if (path === '/system') page = systemAllowed ? <SystemPage me={me} /> : <Unauthorized navigate={navigate} />
  else if (path === '/account') page = <AccountPage me={me} onMeChanged={refreshMe} navigate={navigate} />
  else page = <div className="state"><strong>Página não encontrada</strong><button className="secondary" onClick={() => navigate('/')}>Ir para o início</button></div>

  return <div className="app-shell"><Sidebar me={me} path={path} navigate={navigate} session={session} /><main className="content">{page}</main></div>
}

export default function App() {
  const [path, navigate] = usePathname()
  const [session, setSession] = useState(undefined)
  const [me, setMe] = useState(undefined)
  const [accessError, setAccessError] = useState('')

  async function refreshMe() {
    if (!session) return
    try { const data = await adminConsole('me'); setMe(data); setAccessError('') }
    catch (e) { setMe(null); setAccessError(e.message) }
  }

  useEffect(() => {
    const authUrl = `${window.location.search}${window.location.hash}`
    if (authUrl.includes('type=recovery')) navigate('/reset-password', { replace: true })
    if (authUrl.includes('type=invite')) navigate('/accept-invite', { replace: true })
    let mounted = true
    supabase.auth.getSession().then(({ data }) => { if (mounted) setSession(data.session) })
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession)
      if (event === 'PASSWORD_RECOVERY') navigate('/reset-password', { replace: true })
    })
    return () => { mounted = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (session) refreshMe()
    else if (session === null) setMe(null)
  }, [session?.access_token])

  if (path === '/download') return <DownloadPage />
  if (path === '/forgot-password') return <ForgotPasswordPage navigate={navigate} />
  if (path === '/reset-password') return <ResetPasswordPage session={session} navigate={navigate} />
  if (path === '/accept-invite') return <AcceptInvitePage session={session} navigate={navigate} />
  if (session === undefined) return <Loading label="Iniciando painel…" />
  if (!session) return <LoginPage navigate={navigate} />
  if (me === undefined) return <Loading label="Validando permissões…" />

  if (!me) return <main className="login-page"><section className="login-card"><Brand /><div className="eyebrow">ACESSO NEGADO</div><h1>Conta sem permissão</h1><p className="muted">A autenticação funcionou, mas esta conta não está ativa como administradora do sistema.</p>{accessError && <div className="alert error">{accessError}</div>}<button className="secondary full" onClick={() => supabase.auth.signOut({ scope: 'local' })}>Sair desta conta</button></section></main>

  return <ProtectedApp session={session} me={me} refreshMe={refreshMe} path={path} navigate={navigate} />
}

export { ErrorBoundary }
