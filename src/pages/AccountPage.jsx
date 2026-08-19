import React, { useState } from 'react'
import { adminConsole, sendPasswordRecovery } from '../lib/api'
import { supabase } from '../lib/supabase'
import { dateTimeBR, roleLabel } from '../lib/format'
import { Alert, Field, PageHeader, Panel, PasswordStrength, RoleBadge, Toast } from '../components/ui'

export default function AccountPage({ me, onMeChanged, navigate }) {
  const [name, setName] = useState(me.name || '')
  const [profileBusy, setProfileBusy] = useState(false)
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' })
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(null)

  async function saveProfile(e) {
    e.preventDefault(); setProfileBusy(true); setError('')
    try {
      await adminConsole('profile.update', { name })
      await onMeChanged?.()
      setToast({ message: 'Perfil atualizado.', type: 'success' })
    } catch (e) { setError(e.message) } finally { setProfileBusy(false) }
  }

  async function changePassword(e) {
    e.preventDefault(); setError('')
    if (passwords.next.length < 8) return setError('A nova senha precisa ter pelo menos 8 caracteres.')
    if (passwords.next !== passwords.confirm) return setError('A confirmação da nova senha não confere.')
    setPasswordBusy(true)
    const { error } = await supabase.auth.updateUser({
      password: passwords.next,
      current_password: passwords.current,
    })
    setPasswordBusy(false)
    if (error) return setError(error.message || 'Não foi possível alterar a senha.')
    setPasswords({ current: '', next: '', confirm: '' })
    setToast({ message: 'Senha alterada com sucesso.', type: 'success' })
  }

  async function recovery() {
    try {
      await sendPasswordRecovery(me.email)
      setToast({ message: `Link de recuperação enviado para ${me.email}.`, type: 'success' })
    } catch (e) { setToast({ message: e.message, type: 'error' }) }
  }

  async function logout(scope) {
    const { error } = await supabase.auth.signOut({ scope })
    if (error) return setToast({ message: error.message, type: 'error' })
    if (scope !== 'others') navigate('/', { replace: true })
    else setToast({ message: 'As outras sessões foram encerradas. Esta sessão continua ativa.', type: 'success' })
  }

  return (
    <>
      <PageHeader title="Minha conta" subtitle="Perfil, senha e sessões administrativas." />
      <div className="company-grid">
        <Panel>
          <h2>Perfil</h2>
          <div className="account-summary">
            <div className="avatar-circle">{(me.name || me.email || 'A').slice(0, 1).toUpperCase()}</div>
            <div><strong>{me.name || me.email}</strong><span>{me.email}</span><RoleBadge role={me.role} /></div>
          </div>
          <form className="stack-lg" onSubmit={saveProfile}>
            <Field label="Nome"><input value={name} onChange={e => setName(e.target.value)} required /></Field>
            <button className="primary" disabled={profileBusy}>{profileBusy ? 'Salvando…' : 'Salvar perfil'}</button>
          </form>
        </Panel>

        <Panel>
          <h2>Informações de acesso</h2>
          <div className="detail-grid single-col">
            <div className="detail"><span>Perfil</span><strong>{roleLabel(me.role)}</strong></div>
            <div className="detail"><span>Último login</span><strong>{dateTimeBR(me.last_sign_in_at)}</strong></div>
            <div className="detail"><span>Conta criada</span><strong>{dateTimeBR(me.created_at)}</strong></div>
          </div>
          <button className="secondary" onClick={recovery}>Enviar link de recuperação para meu e-mail</button>
        </Panel>
      </div>

      <Panel className="form-panel wide">
        <h2>Alterar senha</h2>
        <p className="muted section-desc">A alteração é feita pelo Supabase Auth; a senha nunca é armazenada pelo painel.</p>
        <form className="form-grid" onSubmit={changePassword}>
          <Field label="Senha atual" className="span-2"><input type="password" autoComplete="current-password" value={passwords.current} onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))} required /></Field>
          <Field label="Nova senha"><input type="password" autoComplete="new-password" value={passwords.next} onChange={e => setPasswords(p => ({ ...p, next: e.target.value }))} required /><PasswordStrength password={passwords.next} /></Field>
          <Field label="Confirmar nova senha"><input type="password" autoComplete="new-password" value={passwords.confirm} onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))} required /></Field>
          <Alert>{error}</Alert>
          <div className="actions span-2"><button className="primary" disabled={passwordBusy}>{passwordBusy ? 'Alterando…' : 'Alterar senha'}</button></div>
        </form>
      </Panel>

      <Panel>
        <h2>Sessões</h2>
        <p className="muted section-desc">Se suspeitar de acesso indevido, encerre as outras sessões ou saia de todos os dispositivos.</p>
        <div className="security-actions">
          <button className="secondary" onClick={() => logout('others')}>Encerrar outras sessões</button>
          <button className="danger-button" onClick={() => logout('global')}>Sair de todos os dispositivos</button>
        </div>
      </Panel>
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </>
  )
}
