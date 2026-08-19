import React, { useEffect, useState } from 'react'
import { adminManagement, sendPasswordRecovery } from '../lib/api'
import { dateTimeBR, roleLabel } from '../lib/format'
import { Alert, Empty, Field, Loading, Modal, PageHeader, Panel, RoleBadge, StatusBadge, Toast } from '../components/ui'

const assignableRoles = [
  ['admin', 'Administrador'],
  ['finance', 'Financeiro'],
  ['support', 'Suporte'],
  ['read_only', 'Somente leitura'],
]

function InviteModal({ onClose, reload, setToast }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'admin' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await adminManagement('invite', {
        ...form,
        redirect_to: `${window.location.origin}/accept-invite`,
      })
      setToast({ message: 'Convite enviado. O administrador definirá a própria senha.', type: 'success' })
      await reload()
      onClose()
    } catch (e) {
      const messages = {
        invalid_email: 'Informe um e-mail válido.',
        invalid_role: 'Perfil inválido.',
        admin_already_exists: 'Esse e-mail já está cadastrado como administrador.',
      }
      setError(messages[e.message] || e.message)
    } finally { setBusy(false) }
  }

  return (
    <Modal title="Convidar administrador" subtitle="A pessoa receberá um e-mail para criar a própria senha." onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Nome"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></Field>
        <Field label="E-mail"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></Field>
        <Field label="Perfil" className="span-2">
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {assignableRoles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </Field>
        <div className="permission-hint span-2">
          {form.role === 'admin' && 'Acesso amplo a empresas, licenças, suporte e auditoria.'}
          {form.role === 'finance' && 'Pode cadastrar empresas, renovar assinaturas e registrar pagamentos.'}
          {form.role === 'support' && 'Pode bloquear/desbloquear empresas e gerenciar máquinas.'}
          {form.role === 'read_only' && 'Consulta informações, sem operações de alteração.'}
        </div>
        <Alert>{error}</Alert>
        <div className="actions span-2"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Enviando…' : 'Enviar convite'}</button></div>
      </form>
    </Modal>
  )
}

function EditModal({ admin, onClose, reload, setToast }) {
  const [form, setForm] = useState({ name: admin.name || '', role: admin.role, active: admin.active })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await adminManagement('update', { user_id: admin.user_id, ...form })
      setToast({ message: 'Administrador atualizado.', type: 'success' })
      await reload(); onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Editar administrador" subtitle={admin.email} onClose={onClose}>
      <form className="form-grid" onSubmit={save}>
        <Field label="Nome"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Perfil"><select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>{assignableRoles.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></Field>
        <label className="switch-row span-2"><span><strong>Acesso ativo</strong><small>Desative sem apagar o histórico desse usuário.</small></span><input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} /></label>
        <Alert>{error}</Alert>
        <div className="actions span-2"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button></div>
      </form>
    </Modal>
  )
}

export default function AdminsPage() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [invite, setInvite] = useState(false)
  const [edit, setEdit] = useState(null)
  const [busyReset, setBusyReset] = useState('')
  const [toast, setToast] = useState(null)

  async function load() {
    setError('')
    try { setRows(await adminManagement('list')) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  async function sendReset(row) {
    if (!row.email) return
    setBusyReset(row.user_id)
    try {
      await sendPasswordRecovery(row.email)
      setToast({ message: `Link de redefinição enviado para ${row.email}.`, type: 'success' })
    } catch (e) { setToast({ message: e.message, type: 'error' }) }
    finally { setBusyReset('') }
  }

  return (
    <>
      <PageHeader title="Administradores" subtitle="Equipe, permissões e acesso ao painel." action={<button className="primary" onClick={() => setInvite(true)}>+ Convidar administrador</button>} />
      <Panel>
        <Alert>{error}</Alert>
        {!rows && !error ? <Loading compact /> : rows?.length === 0 ? <Empty>Nenhum administrador cadastrado.</Empty> : rows && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Administrador</th><th>Perfil</th><th>Último acesso</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.user_id}>
                    <td><strong>{row.name || row.email || 'Administrador'}</strong><small>{row.email || row.user_id}</small></td>
                    <td><RoleBadge role={row.role} /></td>
                    <td>{dateTimeBR(row.last_sign_in_at)}</td>
                    <td><StatusBadge status={row.active ? 'active' : 'revoked'} /></td>
                    <td className="align-right action-cell">
                      {row.role !== 'owner' && <button className="link-button" onClick={() => setEdit(row)}>Editar</button>}
                      <button className="link-button" disabled={!row.email || busyReset === row.user_id} onClick={() => sendReset(row)}>{busyReset === row.user_id ? 'Enviando…' : 'Redefinir senha'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel className="permissions-panel">
        <h2>Perfis de acesso</h2>
        <div className="permission-grid">
          <div><RoleBadge role="owner" /><p>Controle total, sistema e administradores.</p></div>
          <div><RoleBadge role="admin" /><p>Operação ampla e auditoria, sem alterar owners.</p></div>
          <div><RoleBadge role="finance" /><p>Empresas, renovações e pagamentos.</p></div>
          <div><RoleBadge role="support" /><p>Bloqueios e gerenciamento de máquinas.</p></div>
          <div><RoleBadge role="read_only" /><p>Consulta sem alterações.</p></div>
        </div>
      </Panel>
      {invite && <InviteModal onClose={() => setInvite(false)} reload={load} setToast={setToast} />}
      {edit && <EditModal admin={edit} onClose={() => setEdit(null)} reload={load} setToast={setToast} />}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </>
  )
}
