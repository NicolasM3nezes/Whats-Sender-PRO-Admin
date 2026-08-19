import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { sendPasswordRecovery } from '../lib/api'
import { Alert, Brand, PasswordStrength } from '../components/ui'

function AuthCard({ eyebrow, title, subtitle, children }) {
  return (
    <main className="login-page">
      <section className="login-card">
        <Brand />
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
        {children}
      </section>
    </main>
  )
}

export function LoginPage({ navigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) setError(error.code === 'invalid_credentials' ? 'E-mail ou senha inválidos.' : error.message)
    setLoading(false)
  }

  return (
    <AuthCard eyebrow="WHATS SENDER PRO" title="Painel administrativo" subtitle="Empresas, licenças, vencimentos, equipe e segurança.">
      <form onSubmit={submit} className="stack-lg">
        <label><span>E-mail</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label><span>Senha</span><input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <div className="login-options">
          <button type="button" className="text-button" onClick={() => navigate('/forgot-password')}>Esqueci minha senha</button>
        </div>
        <Alert>{error}</Alert>
        <button className="primary full" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <p className="login-foot">Acesso restrito à administração.</p>
    </AuthCard>
  )
}

export function ForgotPasswordPage({ navigate }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await sendPasswordRecovery(email.trim())
      setSent(true)
    } catch (e) {
      setError(e.message || 'Não foi possível enviar o e-mail de recuperação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard eyebrow="RECUPERAÇÃO" title="Recuperar acesso" subtitle="Enviaremos um link para você definir uma nova senha.">
      {sent ? (
        <div className="stack-lg">
          <div className="success-box">
            <strong>E-mail enviado</strong>
            <span>Confira a caixa de entrada e também o spam. O link retornará para este painel.</span>
          </div>
          <button className="secondary full" onClick={() => navigate('/')}>Voltar ao login</button>
        </div>
      ) : (
        <form onSubmit={submit} className="stack-lg">
          <label><span>E-mail</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <Alert>{error}</Alert>
          <button className="primary full" disabled={loading}>{loading ? 'Enviando…' : 'Enviar link de recuperação'}</button>
          <button type="button" className="ghost full" onClick={() => navigate('/')}>Voltar</button>
        </form>
      )}
    </AuthCard>
  )
}

export function ResetPasswordPage({ session, navigate }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(Boolean(session))

  useEffect(() => {
    if (session) setReady(true)
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY' || next) setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [session])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não são iguais.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(error.message || 'Não foi possível alterar a senha.')
    setDone(true)
    window.history.replaceState({}, '', '/reset-password')
  }

  async function goLogin() {
    await supabase.auth.signOut({ scope: 'local' })
    navigate('/', { replace: true })
  }

  return (
    <AuthCard eyebrow="NOVA SENHA" title={done ? 'Senha atualizada' : 'Defina sua nova senha'} subtitle={done ? 'A alteração foi concluída.' : 'Use uma senha forte e exclusiva para o painel.'}>
      {done ? (
        <div className="stack-lg">
          <div className="success-box"><strong>Pronto</strong><span>Agora você já pode entrar usando a nova senha.</span></div>
          <button className="primary full" onClick={goLogin}>Ir para o login</button>
        </div>
      ) : !ready ? (
        <div className="stack-lg">
          <Alert>O link de recuperação não está mais válido ou a sessão ainda não foi criada. Solicite um novo link.</Alert>
          <button className="secondary full" onClick={() => navigate('/forgot-password')}>Solicitar novo link</button>
        </div>
      ) : (
        <form className="stack-lg" onSubmit={submit}>
          <label><span>Nova senha</span><input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
          <PasswordStrength password={password} />
          <label><span>Confirmar nova senha</span><input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
          <Alert>{error}</Alert>
          <button className="primary full" disabled={loading}>{loading ? 'Salvando…' : 'Salvar nova senha'}</button>
        </form>
      )}
    </AuthCard>
  )
}

export function AcceptInvitePage({ session, navigate }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(Boolean(session))

  useEffect(() => {
    if (session) setReady(true)
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (next) setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [session])

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (password !== confirm) return setError('As senhas não são iguais.')
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) return setError(error.message || 'Não foi possível criar a senha.')
    navigate('/', { replace: true })
  }

  return (
    <AuthCard eyebrow="CONVITE ACEITO" title="Crie sua senha" subtitle="Finalize seu acesso ao painel administrativo.">
      {!ready ? (
        <div className="stack-lg">
          <Alert>O convite não está válido ou expirou. Solicite um novo convite ao owner.</Alert>
          <button className="secondary full" onClick={() => navigate('/')}>Ir para o login</button>
        </div>
      ) : (
        <form className="stack-lg" onSubmit={submit}>
          <label><span>Nova senha</span><input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
          <PasswordStrength password={password} />
          <label><span>Confirmar senha</span><input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></label>
          <Alert>{error}</Alert>
          <button className="primary full" disabled={loading}>{loading ? 'Salvando…' : 'Criar senha e entrar'}</button>
        </form>
      )}
    </AuthCard>
  )
}
