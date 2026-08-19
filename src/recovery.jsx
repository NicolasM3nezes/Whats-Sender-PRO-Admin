import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase } from './supabase'
import './styles.css'

function RecoveryPage() {
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const urlError = params.get('error_description')

    if (urlError) {
      setError(decodeURIComponent(urlError.replace(/\+/g, ' ')))
      return
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setError('Não foi possível validar o link de recuperação.')
        return
      }
      if (data.session) setReady(true)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    return () => data.subscription.unsubscribe()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não são iguais.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) {
      setError('Não foi possível alterar a senha. Solicite um novo link de recuperação.')
      return
    }

    setSuccess(true)
    window.history.replaceState({}, document.title, '/')
  }

  async function goToLogin() {
    await supabase.auth.signOut()
    window.location.replace('/')
  }

  if (success) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark">WS</div>
          <div className="eyebrow">SENHA ATUALIZADA</div>
          <h1>Senha alterada</h1>
          <p className="muted">Sua nova senha foi salva com sucesso.</p>
          <button className="primary" onClick={goToLogin}>Ir para o login</button>
        </section>
      </main>
    )
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">WS</div>
        <div className="eyebrow">RECUPERAÇÃO DE SENHA</div>
        <h1>Defina uma nova senha</h1>
        <p className="muted">Escolha a nova senha que você usará para acessar o painel.</p>

        {!ready && !error ? (
          <div className="state" style={{ minHeight: 120 }}>
            <div className="spinner" />
            <span>Validando link…</span>
          </div>
        ) : (
          <form className="stack-lg" onSubmit={submit}>
            <label>
              <span>Nova senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={!ready}
                required
              />
            </label>
            <label>
              <span>Confirmar nova senha</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                disabled={!ready}
                required
              />
            </label>

            {error && <div className="alert error">{error}</div>}

            {ready ? (
              <button className="primary" disabled={loading}>
                {loading ? 'Salvando…' : 'Salvar nova senha'}
              </button>
            ) : (
              <button type="button" className="secondary" onClick={() => window.location.replace('/')}>Voltar ao login</button>
            )}
          </form>
        )}
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(<RecoveryPage />)
