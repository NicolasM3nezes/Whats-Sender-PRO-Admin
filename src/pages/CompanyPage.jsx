import React, { useEffect, useState } from 'react'
import { adminApi, adminConsole, companyBilling } from '../lib/api'
import { dateBR, dateTimeBR, money, parseBRL } from '../lib/format'
import { Alert, ConfirmDialog, Detail, Empty, Field, Loading, Modal, PageHeader, Panel, StatusBadge, Toast } from '../components/ui'

const toInputDate = value => {
  if (!value) return ''
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const toIso = (value, end = false) => value ? new Date(`${value}T${end ? '23:59:59' : '00:00:00'}`).toISOString() : null
const brlInput = cents => (Number(cents || 0) / 100).toFixed(2).replace('.', ',')

function expiryLabel(value) {
  if (!value) return 'Sem vencimento definido'
  const ms = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(ms)) return '—'
  const days = Math.ceil(ms / 86400000)
  if (days < 0) return `Vencida há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `${days} dias restantes`
}

function lastSeenFor(devices = []) {
  const dates = devices.map(d => d.last_seen_at).filter(Boolean).map(v => new Date(v).getTime()).filter(Number.isFinite)
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null
}

function SubscriptionEditModal({ organizationId, billing, onClose, reload, setToast }) {
  const s = billing.subscription || {}
  const [form, setForm] = useState({
    plan_id: s.plan_id || '', status: s.status || 'active', amount: brlInput(s.amount_cents),
    current_period_start: toInputDate(s.current_period_start), current_period_end: toInputDate(s.current_period_end),
    grace_until: toInputDate(s.grace_until), trial_ends_at: toInputDate(s.trial_ends_at),
    billing_day: s.billing_day == null ? '' : String(s.billing_day), cancel_at_period_end: Boolean(s.cancel_at_period_end),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await companyBilling('subscription.update', {
        organization_id: organizationId,
        plan_id: form.plan_id,
        status: form.status,
        amount_cents: Math.round(parseBRL(form.amount) * 100),
        current_period_start: toIso(form.current_period_start),
        current_period_end: toIso(form.current_period_end, true),
        grace_until: toIso(form.grace_until, true),
        trial_ends_at: toIso(form.trial_ends_at, true),
        billing_day: form.billing_day,
        cancel_at_period_end: form.cancel_at_period_end,
      })
      setToast({ message: 'Assinatura atualizada com sucesso.', type: 'success' })
      await reload(); onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return <Modal title="Editar assinatura" subtitle="Plano, valor, vigência e situação de acesso." onClose={onClose} width="760px">
    <form className="form-grid" onSubmit={submit}>
      <Field label="Plano"><select value={form.plan_id} onChange={e => set('plan_id', e.target.value)} required><option value="">Selecione…</option>{billing.plans.map(p => <option key={p.id} value={p.id} disabled={p.status !== 'active'}>{p.name}{p.status !== 'active' ? ' (inativo)' : ''}</option>)}</select></Field>
      <Field label="Status"><select value={form.status} onChange={e => set('status', e.target.value)}><option value="active">Ativa</option><option value="trialing">Teste</option><option value="past_due">Pagamento pendente</option><option value="suspended">Suspensa</option><option value="canceled">Cancelada</option><option value="expired">Expirada</option></select></Field>
      <Field label="Valor (R$)"><input value={form.amount} onChange={e => set('amount', e.target.value)} required /></Field>
      <Field label="Dia de cobrança"><input type="number" min="1" max="31" placeholder="Ex.: 10" value={form.billing_day} onChange={e => set('billing_day', e.target.value)} /></Field>
      <Field label="Início do período"><input type="date" value={form.current_period_start} onChange={e => set('current_period_start', e.target.value)} required /></Field>
      <Field label="Vencimento"><input type="date" value={form.current_period_end} onChange={e => set('current_period_end', e.target.value)} /></Field>
      <Field label="Carência até"><input type="date" value={form.grace_until} onChange={e => set('grace_until', e.target.value)} /></Field>
      <Field label="Fim do teste"><input type="date" value={form.trial_ends_at} onChange={e => set('trial_ends_at', e.target.value)} /></Field>
      <label className="switch-row span-2"><span><strong>Cancelar ao final do período</strong><small>Mantém o acesso até o vencimento atual.</small></span><input type="checkbox" checked={form.cancel_at_period_end} onChange={e => set('cancel_at_period_end', e.target.checked)} /></label>
      <div className="span-2 notes-box">Status Suspensa, Cancelada ou Expirada pode bloquear novas validações. O bloqueio geral da empresa continua separado.</div>
      <Alert>{error}</Alert>
      <div className="actions span-2"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar assinatura'}</button></div>
    </form>
  </Modal>
}

function LicenseEditModal({ organizationId, billing, plan, onClose, reload, setToast }) {
  const l = billing.license || {}
  const [limit, setLimit] = useState(l.max_devices_override == null ? '' : String(l.max_devices_override))
  const [expiresAt, setExpiresAt] = useState(toInputDate(l.expires_at))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await companyBilling('license.update', { organization_id: organizationId, max_devices_override: limit, expires_at: toIso(expiresAt, true) })
      setToast({ message: 'Configurações da licença atualizadas.', type: 'success' })
      await reload(); onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return <Modal title="Configurar licença" subtitle="Exceções específicas desta empresa." onClose={onClose}>
    <form className="form-grid" onSubmit={submit}>
      <Field label="Limite de máquinas"><input type="number" min="1" max="1000" value={limit} onChange={e => setLimit(e.target.value)} placeholder={plan?.max_devices == null ? 'Vazio = ilimitado pelo plano' : `Vazio = ${plan.max_devices} do plano`} /></Field>
      <Field label="Expiração própria"><input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></Field>
      <div className="span-2 notes-box">Deixe vazio para usar a regra padrão do plano. Isso não altera outros clientes.</div>
      <Alert>{error}</Alert>
      <div className="actions span-2"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar licença'}</button></div>
    </form>
  </Modal>
}

function SubscriptionPanel({ data, billing, canEdit, busy, onEdit, onRenew }) {
  const { organization, subscription, plan } = data
  const latestPayment = data.payments?.[0]
  return <Panel>
    <div className="panel-head"><div><h2>Assinatura</h2><p className="muted">Plano, vigência e situação financeira.</p></div>{canEdit && <button className="ghost" disabled={busy || !billing} onClick={onEdit}>Editar</button>}</div>
    <div className="detail-grid">
      <Detail label="Status"><StatusBadge status={organization.status === 'suspended' ? 'suspended' : subscription?.status} /></Detail>
      <Detail label="Plano" value={plan?.name || '—'} />
      <Detail label="Vencimento" value={dateBR(subscription?.current_period_end)} />
      <Detail label="Valor" value={money(subscription?.amount_cents)} />
      <Detail label="Situação" value={expiryLabel(subscription?.current_period_end)} />
      <Detail label="Carência" value={subscription?.grace_until ? dateBR(subscription.grace_until) : 'Sem carência'} />
      <Detail label="Dia de cobrança" value={subscription?.billing_day ? `Dia ${subscription.billing_day}` : 'Não definido'} />
      <Detail label="Último pagamento"><StatusBadge status={latestPayment?.status || 'pending'} /></Detail>
    </div>
    {subscription?.cancel_at_period_end && <div className="notes-box">Cancelamento programado para o final do período atual.</div>}
    {canEdit && <div className="actions compact-actions"><button className="secondary" disabled={busy} onClick={() => onRenew(30)}>+30 dias</button><button className="secondary" disabled={busy} onClick={() => onRenew(90)}>+90 dias</button><button className="secondary" disabled={busy} onClick={() => onRenew(365)}>+365 dias</button></div>}
  </Panel>
}

function LicensePanel({ data, billing, canEdit, busy, newKey, onEdit, onRotate }) {
  const { plan, license, devices } = data
  const override = billing?.license?.max_devices_override ?? license?.max_devices_override
  const limit = override ?? plan?.max_devices
  return <Panel>
    <div className="panel-head"><div><h2>Licença</h2><p className="muted">Ativação, máquinas e exceções.</p></div>{canEdit && <button className="ghost" disabled={busy || !billing} onClick={onEdit}>Configurar</button>}</div>
    <div className="detail-grid">
      <Detail label="Chave" value={license?.key_prefix ? `${license.key_prefix}…` : '—'} />
      <Detail label="Status"><StatusBadge status={license?.status} /></Detail>
      <Detail label="Máquinas ativas" value={String(devices.filter(d => d.status === 'active').length)} />
      <Detail label="Limite" value={limit == null ? 'Ilimitado' : `${limit}${override != null ? ' (personalizado)' : ''}`} />
      <Detail label="Expiração" value={license?.expires_at ? dateBR(license.expires_at) : 'Sem expiração própria'} />
      <Detail label="Emitida em" value={dateBR(license?.issued_at)} />
    </div>
    {canEdit && <button className="ghost" disabled={busy} onClick={onRotate}>Gerar nova chave</button>}
    {newKey && <div className="new-key"><strong>Nova chave — copie agora</strong><code>{newKey}</code><button className="secondary" onClick={() => navigator.clipboard.writeText(newKey)}>Copiar</button></div>}
  </Panel>
}

function DevicesTab({ organizationId, devices, canManage, reload, setToast }) {
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null)

  async function rename(device) {
    const nickname = window.prompt('Nome amigável para este computador:', device.nickname || device.hostname || '')
    if (nickname === null) return
    setBusy(device.id)
    try { await adminConsole('devices.rename', { organization_id: organizationId, device_id: device.id, nickname }); setToast({ message: 'Nome atualizado.', type: 'success' }); await reload() }
    catch (e) { setToast({ message: e.message, type: 'error' }) } finally { setBusy('') }
  }

  async function revoke() {
    if (!confirm) return
    setBusy(confirm.id)
    try { await adminApi('devices.revoke', { organization_id: organizationId, device_id: confirm.id, reason: 'Desvinculado pelo painel administrativo' }); setToast({ message: 'Máquina desvinculada.', type: 'success' }); setConfirm(null); await reload() }
    catch (e) { setToast({ message: e.message, type: 'error' }) } finally { setBusy('') }
  }

  return <Panel>
    <div className="panel-head"><div><h2>Máquinas</h2><p className="muted">Computadores que ativaram esta licença.</p></div></div>
    {devices.length ? <div className="table-wrap"><table><thead><tr><th>Computador</th><th>Sistema</th><th>App</th><th>Último acesso</th><th>Status</th><th></th></tr></thead><tbody>{devices.map(d => <tr key={d.id}><td><strong>{d.nickname || d.hostname || 'Computador'}</strong><small>{d.nickname && d.hostname ? d.hostname : d.installation_id?.slice(0, 8)}</small></td><td>{[d.os_name, d.os_version].filter(Boolean).join(' ') || '—'}</td><td>{d.app_version || '—'}</td><td>{dateTimeBR(d.last_seen_at)}</td><td><StatusBadge status={d.status} /></td><td className="align-right action-cell">{canManage && <button className="link-button" disabled={busy === d.id} onClick={() => rename(d)}>Renomear</button>}{canManage && d.status === 'active' && <button className="link-button danger-text" disabled={busy === d.id} onClick={() => setConfirm(d)}>Desvincular</button>}</td></tr>)}</tbody></table></div> : <Empty>Nenhuma máquina ativada ainda.</Empty>}
    {confirm && <ConfirmDialog title="Desvincular máquina" message={`A máquina “${confirm.nickname || confirm.hostname || 'Computador'}” perderá o acesso e precisará ser ativada novamente.`} confirmLabel="Desvincular" danger busy={busy === confirm.id} onCancel={() => setConfirm(null)} onConfirm={revoke} />}
  </Panel>
}

function PaymentForm({ initial, title, subtitle, submitLabel, onSubmit, onClose }) {
  const [form, setForm] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  async function submit(e) { e.preventDefault(); setBusy(true); setError(''); try { await onSubmit(form); onClose() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return <Modal title={title} subtitle={subtitle} onClose={onClose}><form className="form-grid" onSubmit={submit}>
    <Field label="Valor (R$)"><input value={form.amount} onChange={e => set('amount', e.target.value)} required /></Field>
    <Field label="Método"><select value={form.method} onChange={e => set('method', e.target.value)}><option value="pix">PIX</option><option value="card">Cartão</option><option value="boleto">Boleto</option><option value="transfer">Transferência</option><option value="cash">Dinheiro</option><option value="other">Outro</option></select></Field>
    <Field label="Status"><select value={form.status} onChange={e => set('status', e.target.value)}><option value="pending">Pendente</option><option value="paid">Pago</option><option value="failed">Falhou</option><option value="refunded">Estornado</option><option value="canceled">Cancelado</option><option value="chargeback">Chargeback</option></select></Field>
    <Field label="Vencimento"><input type="date" value={form.due_at} onChange={e => set('due_at', e.target.value)} /></Field>
    {'paid_at' in form && <Field label="Pago em"><input type="date" value={form.paid_at} onChange={e => set('paid_at', e.target.value)} /></Field>}
    <Field label="Observação" className={'paid_at' in form ? '' : 'span-2'}><textarea rows="3" value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
    <Alert>{error}</Alert><div className="actions span-2"><button type="button" className="ghost" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Salvando…' : submitLabel}</button></div>
  </form></Modal>
}

function PaymentsTab({ organizationId, payments, subscription, canManage, reload, setToast }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)

  async function add(form) {
    await adminConsole('payments.add', { organization_id: organizationId, amount_cents: Math.round(parseBRL(form.amount) * 100), method: form.method, status: form.status, due_at: toIso(form.due_at, true), notes: form.notes })
    setToast({ message: 'Pagamento registrado.', type: 'success' }); await reload()
  }
  async function edit(form) {
    await companyBilling('payment.update', { organization_id: organizationId, payment_id: editing.id, amount_cents: Math.round(parseBRL(form.amount) * 100), method: form.method, status: form.status, due_at: toIso(form.due_at, true), paid_at: form.paid_at ? toIso(form.paid_at, true) : '', notes: form.notes })
    setToast({ message: 'Pagamento atualizado.', type: 'success' }); await reload()
  }

  return <Panel>
    <div className="panel-head"><div><h2>Pagamentos</h2><p className="muted">Histórico financeiro. Correções ficam na auditoria.</p></div>{canManage && <button className="secondary" onClick={() => setAdding(true)}>+ Registrar pagamento</button>}</div>
    {payments.length ? <div className="table-wrap"><table><thead><tr><th>Data</th><th>Método</th><th>Valor</th><th>Status</th><th>Observação</th><th></th></tr></thead><tbody>{payments.map(p => <tr key={p.id}><td>{dateBR(p.paid_at || p.due_at || p.created_at)}</td><td>{String(p.method || p.provider || '—').toUpperCase()}</td><td>{money(p.amount_cents)}</td><td><StatusBadge status={p.status} /></td><td>{p.notes || '—'}</td><td className="align-right">{canManage && <button className="link-button" onClick={() => setEditing(p)}>Editar</button>}</td></tr>)}</tbody></table></div> : <Empty>Nenhum pagamento registrado.</Empty>}
    {adding && <PaymentForm initial={{ amount: brlInput(subscription?.amount_cents || 19900), method: 'pix', status: 'paid', due_at: '', notes: '' }} title="Registrar pagamento" subtitle="Adicione um pagamento manual." submitLabel="Registrar pagamento" onSubmit={add} onClose={() => setAdding(false)} />}
    {editing && <PaymentForm initial={{ amount: brlInput(editing.amount_cents), method: editing.method || 'pix', status: editing.status || 'pending', due_at: toInputDate(editing.due_at), paid_at: toInputDate(editing.paid_at), notes: editing.notes || '' }} title="Editar pagamento" subtitle="Corrija o registro sem apagar o histórico." submitLabel="Salvar pagamento" onSubmit={edit} onClose={() => setEditing(null)} />}
  </Panel>
}

function RegistrationTab({ organization, canEdit, reload, setToast }) {
  const [form, setForm] = useState({ legal_name: organization.legal_name || '', trade_name: organization.trade_name || '', document_number: organization.document_number || '', email: organization.email || '', billing_email: organization.billing_email || '', phone: organization.phone || '', notes: organization.notes || '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  useEffect(() => setForm({ legal_name: organization.legal_name || '', trade_name: organization.trade_name || '', document_number: organization.document_number || '', email: organization.email || '', billing_email: organization.billing_email || '', phone: organization.phone || '', notes: organization.notes || '' }), [organization.id, organization.updated_at])
  async function save(e) { e.preventDefault(); setBusy(true); setError(''); try { await adminConsole('companies.update', { organization_id: organization.id, ...form }); setToast({ message: 'Cadastro atualizado.', type: 'success' }); await reload() } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return <Panel className="form-panel wide"><div className="panel-head"><div><h2>Cadastro da empresa</h2><p className="muted">Dados comerciais, cobrança e observações internas.</p></div></div><form className="form-grid" onSubmit={save}>
    <Field label="Razão social *" className="span-2"><input disabled={!canEdit} value={form.legal_name} onChange={e => set('legal_name', e.target.value)} required /></Field>
    <Field label="Nome fantasia"><input disabled={!canEdit} value={form.trade_name} onChange={e => set('trade_name', e.target.value)} /></Field>
    <Field label="CNPJ"><input disabled={!canEdit} value={form.document_number} onChange={e => set('document_number', e.target.value.toUpperCase())} /></Field>
    <Field label="E-mail"><input disabled={!canEdit} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
    <Field label="E-mail de cobrança"><input disabled={!canEdit} type="email" value={form.billing_email} onChange={e => set('billing_email', e.target.value)} /></Field>
    <Field label="Telefone"><input disabled={!canEdit} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
    <Field label="Observações" className="span-2"><textarea disabled={!canEdit} rows="5" value={form.notes} onChange={e => set('notes', e.target.value)} /></Field>
    <Alert>{error}</Alert>{canEdit && <div className="actions span-2"><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar alterações'}</button></div>}
  </form></Panel>
}

export default function CompanyPage({ id, navigate, me }) {
  const [data, setData] = useState(null)
  const [billing, setBilling] = useState(null)
  const [error, setError] = useState('')
  const [billingError, setBillingError] = useState('')
  const [busy, setBusy] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [tab, setTab] = useState('summary')
  const [toast, setToast] = useState(null)
  const [blockConfirm, setBlockConfirm] = useState(null)
  const [editSubscription, setEditSubscription] = useState(false)
  const [editLicense, setEditLicense] = useState(false)

  const canFinance = ['owner', 'admin', 'finance'].includes(me.role)
  const canSupport = ['owner', 'admin', 'support'].includes(me.role)
  const canLicense = ['owner', 'admin'].includes(me.role)

  async function load() {
    setError(''); setBillingError('')
    try {
      const company = await adminApi('companies.get', { organization_id: id })
      setData(company)
      if (canFinance || canLicense) {
        try { setBilling(await companyBilling('overview', { organization_id: id })) }
        catch (e) { setBillingError(e.message) }
      }
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [id, me.role])

  async function renew(days) {
    const amount = window.prompt(`Valor recebido para +${days} dias (R$):`, brlInput(data?.subscription?.amount_cents || 19900))
    if (amount === null) return
    setBusy(true)
    try { await adminApi('companies.renew', { organization_id: id, days, amount_cents: Math.round(parseBRL(amount) * 100), method: 'pix', notes: `Renovação manual +${days} dias` }); setToast({ message: `Assinatura renovada por ${days} dias.`, type: 'success' }); await load() }
    catch (e) { setToast({ message: e.message, type: 'error' }) } finally { setBusy(false) }
  }
  async function setBlocked(blocked) {
    setBusy(true)
    try { await adminApi('companies.set_blocked', { organization_id: id, blocked, reason: blocked ? 'Bloqueado pelo painel administrativo' : 'Regularizado pelo painel administrativo' }); setToast({ message: blocked ? 'Empresa bloqueada.' : 'Empresa desbloqueada.', type: 'success' }); setBlockConfirm(null); await load() }
    catch (e) { setToast({ message: e.message, type: 'error' }) } finally { setBusy(false) }
  }
  async function rotate() {
    if (!window.confirm('Gerar nova chave? A chave anterior deixará de ativar novos computadores.')) return
    setBusy(true)
    try { const r = await adminApi('licenses.rotate_key', { organization_id: id }); setNewKey(r.license_key); setToast({ message: 'Nova chave gerada. Copie antes de sair.', type: 'success' }); await load() }
    catch (e) { setToast({ message: e.message, type: 'error' }) } finally { setBusy(false) }
  }

  if (!data && !error) return <Loading />
  if (error) return <><PageHeader title="Empresa" back={() => navigate('/companies')} /><Alert>{error}</Alert></>

  const organization = data.organization
  const blocked = organization.status === 'suspended'
  const activeDevices = data.devices.filter(d => d.status === 'active').length
  const lastSeen = lastSeenFor(data.devices)

  return <>
    <PageHeader title={organization.trade_name || organization.legal_name} subtitle={organization.document_number || organization.legal_name} back={() => navigate('/companies')} action={canSupport ? (blocked ? <button className="primary" disabled={busy} onClick={() => setBlockConfirm(false)}>Desbloquear empresa</button> : <button className="danger-button" disabled={busy} onClick={() => setBlockConfirm(true)}>Bloquear empresa</button>) : null} />

    <div className="detail-grid four-cols">
      <Detail label="Empresa"><StatusBadge status={blocked ? 'suspended' : 'active'} /></Detail>
      <Detail label="Assinatura"><StatusBadge status={data.subscription?.status} /></Detail>
      <Detail label="Máquinas ativas" value={String(activeDevices)} />
      <Detail label="Último acesso" value={dateTimeBR(lastSeen)} />
    </div>

    <div className="tabs"><button className={tab === 'summary' ? 'active' : ''} onClick={() => setTab('summary')}>Resumo</button><button className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')}>Máquinas <span>{data.devices.length}</span></button><button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Pagamentos <span>{data.payments.length}</span></button><button className={tab === 'registration' ? 'active' : ''} onClick={() => setTab('registration')}>Cadastro</button></div>

    <Alert>{billingError}</Alert>
    {tab === 'summary' && <div className="company-grid">
      <SubscriptionPanel data={data} billing={billing} canEdit={canFinance} busy={busy} onEdit={() => setEditSubscription(true)} onRenew={renew} />
      <LicensePanel data={data} billing={billing} canEdit={canLicense} busy={busy} newKey={newKey} onEdit={() => setEditLicense(true)} onRotate={rotate} />
      <Panel className="span-grid"><div className="panel-head"><div><h2>Contato e relacionamento</h2><p className="muted">Dados rápidos para cobrança e suporte.</p></div>{canFinance && <button className="ghost" onClick={() => setTab('registration')}>Editar cadastro</button>}</div><div className="detail-grid four-cols"><Detail label="E-mail" value={organization.email || '—'} /><Detail label="Cobrança" value={organization.billing_email || '—'} /><Detail label="Telefone" value={organization.phone || '—'} /><Detail label="Cliente desde" value={dateBR(organization.created_at)} /></div>{organization.notes ? <div className="notes-box">{organization.notes}</div> : <div className="muted section-desc">Sem observações internas.</div>}</Panel>
    </div>}
    {tab === 'devices' && <DevicesTab organizationId={id} devices={data.devices} canManage={canSupport} reload={load} setToast={setToast} />}
    {tab === 'payments' && <PaymentsTab organizationId={id} payments={data.payments} subscription={data.subscription} canManage={canFinance} reload={load} setToast={setToast} />}
    {tab === 'registration' && <RegistrationTab organization={organization} canEdit={canFinance} reload={load} setToast={setToast} />}

    {editSubscription && billing && <SubscriptionEditModal organizationId={id} billing={billing} onClose={() => setEditSubscription(false)} reload={load} setToast={setToast} />}
    {editLicense && billing && <LicenseEditModal organizationId={id} billing={billing} plan={data.plan} onClose={() => setEditLicense(false)} reload={load} setToast={setToast} />}
    {blockConfirm !== null && <ConfirmDialog title={blockConfirm ? 'Bloquear empresa' : 'Desbloquear empresa'} message={blockConfirm ? 'Todos os computadores desta empresa serão impedidos de iniciar novos disparos na próxima validação.' : 'A empresa voltará a validar a licença normalmente.'} confirmLabel={blockConfirm ? 'Bloquear' : 'Desbloquear'} danger={blockConfirm} busy={busy} onCancel={() => setBlockConfirm(null)} onConfirm={() => setBlocked(blockConfirm)} />}
    <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
  </>
}
