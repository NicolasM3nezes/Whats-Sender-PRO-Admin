import React, { useEffect, useMemo, useState } from 'react'
import { adminApi, adminConsole } from '../lib/api'
import { dateBR, dateTimeBR, money, parseBRL } from '../lib/format'
import { Alert, ConfirmDialog, Detail, Empty, Field, Loading, Modal, PageHeader, Panel, StatusBadge, Toast } from '../components/ui'

function SubscriptionPanel({ data, busy, onRenew }) {
  const { organization, subscription, plan } = data
  const blocked = organization.status === 'suspended'
  return (
    <Panel>
      <h2>Assinatura</h2>
      <div className="detail-grid">
        <Detail label="Status"><StatusBadge status={blocked ? 'suspended' : subscription?.status} /></Detail>
        <Detail label="Plano" value={plan?.name || '—'} />
        <Detail label="Vencimento" value={dateBR(subscription?.current_period_end)} />
        <Detail label="Valor" value={money(subscription?.amount_cents)} />
      </div>
      <div className="actions compact-actions">
        <button className="secondary" disabled={busy} onClick={() => onRenew(30)}>+30 dias</button>
        <button className="secondary" disabled={busy} onClick={() => onRenew(90)}>+90 dias</button>
        <button className="secondary" disabled={busy} onClick={() => onRenew(365)}>+365 dias</button>
      </div>
    </Panel>
  )
}

function LicensePanel({ data, busy, onRotate, newKey }) {
  const { plan, license, devices } = data
  return (
    <Panel>
      <h2>Licença</h2>
      <div className="detail-grid">
        <Detail label="Chave" value={license?.key_prefix ? `${license.key_prefix}…` : '—'} />
        <Detail label="Status"><StatusBadge status={license?.status} /></Detail>
        <Detail label="Máquinas ativas" value={String(devices.filter(d => d.status === 'active').length)} />
        <Detail label="Limite" value={plan?.max_devices == null ? 'Ilimitado' : String(plan.max_devices)} />
      </div>
      <button className="ghost" disabled={busy} onClick={onRotate}>Gerar nova chave</button>
      {newKey && (
        <div className="new-key">
          <strong>Nova chave — copie agora</strong>
          <code>{newKey}</code>
          <button className="secondary" onClick={() => navigator.clipboard.writeText(newKey)}>Copiar</button>
        </div>
      )}
    </Panel>
  )
}

function DevicesTab({ organizationId, devices, canManage, reload, setToast }) {
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null)

  async function rename(device) {
    const current = device.nickname || device.hostname || ''
    const nickname = window.prompt('Nome amigável para este computador:', current)
    if (nickname === null) return
    setBusy(device.id)
    try {
      await adminConsole('devices.rename', { organization_id: organizationId, device_id: device.id, nickname })
      setToast({ message: 'Nome da máquina atualizado.', type: 'success' })
      await reload()
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    } finally { setBusy('') }
  }

  async function revoke() {
    const device = confirm
    if (!device) return
    setBusy(device.id)
    try {
      await adminApi('devices.revoke', { organization_id: organizationId, device_id: device.id, reason: 'Desvinculado pelo painel administrativo' })
      setToast({ message: 'Máquina desvinculada.', type: 'success' })
      setConfirm(null)
      await reload()
    } catch (e) {
      setToast({ message: e.message, type: 'error' })
    } finally { setBusy('') }
  }

  return (
    <Panel>
      <div className="panel-head"><div><h2>Máquinas</h2><p className="muted">Computadores que já ativaram esta licença.</p></div></div>
      {devices.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Computador</th><th>Sistema</th><th>App</th><th>Último acesso</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {devices.map(d => (
                <tr key={d.id}>
                  <td><strong>{d.nickname || d.hostname || 'Computador'}</strong><small>{d.nickname && d.hostname ? d.hostname : d.installation_id?.slice(0, 8)}</small></td>
                  <td>{[d.os_name, d.os_version].filter(Boolean).join(' ') || '—'}</td>
                  <td>{d.app_version || '—'}</td>
                  <td>{dateTimeBR(d.last_seen_at)}</td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="align-right action-cell">
                    {canManage && <button className="link-button" disabled={busy === d.id} onClick={() => rename(d)}>Renomear</button>}
                    {canManage && d.status === 'active' && <button className="link-button danger-text" disabled={busy === d.id} onClick={() => setConfirm(d)}>Desvincular</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty>Nenhuma máquina ativada ainda.</Empty>}
      {confirm && <ConfirmDialog title="Desvincular máquina" message={`A máquina “${confirm.nickname || confirm.hostname || 'Computador'}” perderá o acesso e precisará ser ativada novamente.`} confirmLabel="Desvincular" danger busy={busy === confirm.id} onCancel={() => setConfirm(null)} onConfirm={revoke} />}
    </Panel>
  )
}

function PaymentModal({ organizationId, onClose, reload, setToast }) {
  const [form, setForm] = useState({ amount: '199,00', method: 'pix', status: 'paid', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const amount = parseBRL(form.amount)
      await adminConsole('payments.add', {
        organization_id: organizationId,
        amount_cents: Math.round(amount * 100),
        method: form.method,
        status: form.status,
        notes: form.notes,
      })
      setToast({ message: 'Pagamento registrado.', type: 'success' })
      await reload()
      onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Modal title="Registrar pagamento" subtitle="Registro manual para controle financeiro." onClose={onClose}>
      <form className="form-grid" onSubmit={submit}>
        <Field label="Valor (R$)"><input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required /></Field>
        <Field label="Método"><select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}><option value="pix">PIX</option><option value="card">Cartão</option><option value="boleto">Boleto</option><option value="transfer">Transferência</option><option value="cash">Dinheiro</option><option value="other">Outro</option></select></Field>
        <Field label="Status"><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}><option value="paid">Pago</option><option value="pending">Pendente</option><option value="failed">Falhou</option><option value="canceled">Cancelado</option></select></Field>
        <Field label="Observação" className="span-2"><textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows="3" /></Field>
        <Alert>{error}</Alert>
        <div className="actions span-2"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Registrar pagamento'}</button></div>
      </form>
    </Modal>
  )
}

function PaymentsTab({ organizationId, payments, canManage, reload, setToast }) {
  const [modal, setModal] = useState(false)
  return (
    <Panel>
      <div className="panel-head">
        <div><h2>Pagamentos</h2><p className="muted">Histórico financeiro manual e futuro gateway.</p></div>
        {canManage && <button className="secondary" onClick={() => setModal(true)}>+ Registrar pagamento</button>}
      </div>
      {payments.length ? (
        <div className="table-wrap"><table><thead><tr><th>Data</th><th>Método</th><th>Valor</th><th>Status</th><th>Observação</th></tr></thead><tbody>
          {payments.map(p => <tr key={p.id}><td>{dateBR(p.paid_at || p.created_at)}</td><td>{String(p.method || p.provider || '—').toUpperCase()}</td><td>{money(p.amount_cents)}</td><td><StatusBadge status={p.status} /></td><td>{p.notes || '—'}</td></tr>)}
        </tbody></table></div>
      ) : <Empty>Nenhum pagamento registrado.</Empty>}
      {modal && <PaymentModal organizationId={organizationId} onClose={() => setModal(false)} reload={reload} setToast={setToast} />}
    </Panel>
  )
}

function RegistrationTab({ organization, canEdit, reload, setToast }) {
  const [form, setForm] = useState(() => ({
    legal_name: organization.legal_name || '', trade_name: organization.trade_name || '',
    document_number: organization.document_number || '', email: organization.email || '',
    billing_email: organization.billing_email || '', phone: organization.phone || '', notes: organization.notes || '',
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm({
      legal_name: organization.legal_name || '', trade_name: organization.trade_name || '', document_number: organization.document_number || '',
      email: organization.email || '', billing_email: organization.billing_email || '', phone: organization.phone || '', notes: organization.notes || '',
    })
  }, [organization.id, organization.updated_at])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await adminConsole('companies.update', { organization_id: organization.id, ...form })
      setToast({ message: 'Cadastro da empresa atualizado.', type: 'success' })
      await reload()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <Panel className="form-panel wide">
      <div className="panel-head"><div><h2>Cadastro da empresa</h2><p className="muted">Dados comerciais, cobrança e observações internas.</p></div></div>
      <form className="form-grid" onSubmit={save}>
        <Field label="Razão social *" className="span-2"><input disabled={!canEdit} value={form.legal_name} onChange={e => set('legal_name', e.target.value)} required /></Field>
        <Field label="Nome fantasia"><input disabled={!canEdit} value={form.trade_name} onChange={e => set('trade_name', e.target.value)} /></Field>
        <Field label="CNPJ"><input disabled={!canEdit} value={form.document_number} onChange={e => set('document_number', e.target.value.toUpperCase())} /></Field>
        <Field label="E-mail de contato"><input disabled={!canEdit} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="E-mail de cobrança"><input disabled={!canEdit} type="email" value={form.billing_email} onChange={e => set('billing_email', e.target.value)} /></Field>
        <Field label="Telefone"><input disabled={!canEdit} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Observações internas" className="span-2"><textarea disabled={!canEdit} rows="5" value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
        <Alert>{error}</Alert>
        {canEdit && <div className="actions span-2"><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</button></div>}
      </form>
    </Panel>
  )
}

export default function CompanyPage({ id, navigate, me }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [tab, setTab] = useState('summary')
  const [toast, setToast] = useState(null)
  const [blockConfirm, setBlockConfirm] = useState(null)

  const canFinance = ['owner', 'admin', 'finance'].includes(me.role)
  const canSupport = ['owner', 'admin', 'support'].includes(me.role)
  const canLicense = ['owner', 'admin'].includes(me.role)

  async function load() {
    setError('')
    try { setData(await adminApi('companies.get', { organization_id: id })) }
    catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [id])

  async function renew(days) {
    const amount = window.prompt(`Valor recebido para +${days} dias (R$):`, '199,00')
    if (amount === null) return
    setBusy(true)
    try {
      await adminApi('companies.renew', { organization_id: id, days, amount_cents: Math.round(parseBRL(amount) * 100), method: 'pix', notes: `Renovação manual +${days} dias` })
      setToast({ message: `Assinatura renovada por ${days} dias.`, type: 'success' })
      await load()
    } catch (e) { setToast({ message: e.message, type: 'error' }) } finally { setBusy(false) }
  }

  async function setBlocked(blocked) {
    setBusy(true)
    try {
      await adminApi('companies.set_blocked', { organization_id: id, blocked, reason: blocked ? 'Bloqueado pelo painel administrativo' : 'Regularizado pelo painel administrativo' })
      setToast({ message: blocked ? 'Empresa bloqueada.' : 'Empresa desbloqueada.', type: 'success' })
      setBlockConfirm(null)
      await load()
    } catch (e) { setToast({ message: e.message, type: 'error' }) } finally { setBusy(false) }
  }

  async function rotate() {
    if (!window.confirm('Gerar nova chave? A chave anterior deixará de ativar novos computadores.')) return
    setBusy(true)
    try {
      const result = await adminApi('licenses.rotate_key', { organization_id: id })
      setNewKey(result.license_key)
      setToast({ message: 'Nova chave gerada. Copie antes de sair da tela.', type: 'success' })
      await load()
    } catch (e) { setToast({ message: e.message, type: 'error' }) } finally { setBusy(false) }
  }

  if (!data && !error) return <Loading />
  if (error) return <><PageHeader title="Empresa" back={() => navigate('/companies')} /><Alert>{error}</Alert></>

  const { organization } = data
  const blocked = organization.status === 'suspended'

  return (
    <>
      <PageHeader
        title={organization.trade_name || organization.legal_name}
        subtitle={organization.document_number || organization.legal_name}
        back={() => navigate('/companies')}
        action={canSupport ? (blocked
          ? <button className="primary" disabled={busy} onClick={() => setBlockConfirm(false)}>Desbloquear empresa</button>
          : <button className="danger-button" disabled={busy} onClick={() => setBlockConfirm(true)}>Bloquear empresa</button>) : null}
      />

      <div className="tabs">
        <button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Resumo</button>
        <button className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')}>Máquinas <span>{data.devices.length}</span></button>
        <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Pagamentos <span>{data.payments.length}</span></button>
        <button className={tab === 'registration' ? 'active' : ''} onClick={() => setTab('registration')}>Cadastro</button>
      </div>

      {tab === 'summary' && (
        <div className="company-grid">
          <SubscriptionPanel data={data} busy={busy || !canFinance} onRenew={renew} />
          <LicensePanel data={data} busy={busy || !canLicense} onRotate={rotate} newKey={newKey} />
          <Panel className="span-grid">
            <h2>Contato e observações</h2>
            <div className="detail-grid four-cols">
              <Detail label="E-mail" value={organization.email || '—'} />
              <Detail label="Cobrança" value={organization.billing_email || '—'} />
              <Detail label="Telefone" value={organization.phone || '—'} />
              <Detail label="Criada em" value={dateBR(organization.created_at)} />
            </div>
            {organization.notes && <div className="notes-box">{organization.notes}</div>}
            {canFinance && <button className="ghost" onClick={() => setTab('registration')}>Editar cadastro</button>}
          </Panel>
        </div>
      )}
      {tab === 'devices' && <DevicesTab organizationId={id} devices={data.devices} canManage={canSupport} reload={load} setToast={setToast} />}
      {tab === 'payments' && <PaymentsTab organizationId={id} payments={data.payments} canManage={canFinance} reload={load} setToast={setToast} />}
      {tab === 'registration' && <RegistrationTab organization={organization} canEdit={canFinance} reload={load} setToast={setToast} />}

      {blockConfirm !== null && (
        <ConfirmDialog
          title={blockConfirm ? 'Bloquear empresa' : 'Desbloquear empresa'}
          message={blockConfirm ? 'Todos os computadores desta empresa serão impedidos de iniciar novos disparos na próxima validação de licença.' : 'A empresa voltará a validar a licença normalmente.'}
          confirmLabel={blockConfirm ? 'Bloquear' : 'Desbloquear'}
          danger={blockConfirm}
          busy={busy}
          onCancel={() => setBlockConfirm(null)}
          onConfirm={() => setBlocked(blockConfirm)}
        />
      )}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </>
  )
}
