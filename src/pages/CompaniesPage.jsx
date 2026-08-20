import React, { useEffect, useState } from 'react'
import { adminApi } from '../lib/api'
import { dateBR, daysUntil } from '../lib/format'
import { Alert, Empty, Loading, PageHeader, Panel, StatusBadge } from '../components/ui'

function rowState(row) {
  const end = row.subscription?.current_period_end
  const days = daysUntil(end)
  const expired = days != null && days < 0
  const blocked = row.status === 'suspended'
  const status = blocked ? 'suspended' : expired ? 'expired' : row.subscription?.status
  const attention = !blocked && !expired && (row.subscription?.status === 'past_due' || (days != null && days <= 7))
  return { days, expired, blocked, status, attention }
}

function dueLabel(end) {
  const days = daysUntil(end)
  if (!end || days == null) return 'Sem vencimento'
  if (days < 0) return `Vencida há ${Math.abs(days)}d`
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `${days} dias`
}

export default function CompaniesPage({ navigate, me }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')
  const canCreate = ['owner', 'admin', 'finance'].includes(me?.role)

  async function load(search = q) {
    setError('')
    try { setRows(await adminApi('companies.list', { q: search })) }
    catch (e) { setError(e.message) }
  }

  useEffect(() => { load('') }, [])

  const visible = (rows || [])
    .filter(row => {
      const s = rowState(row)
      if (filter === 'active') return !s.blocked && !s.expired && ['active', 'trialing'].includes(row.subscription?.status)
      if (filter === 'attention') return s.attention
      if (filter === 'expired') return s.expired
      if (filter === 'blocked') return s.blocked
      return true
    })
    .sort((a, b) => {
      const aa = a.subscription?.current_period_end ? new Date(a.subscription.current_period_end).getTime() : Number.MAX_SAFE_INTEGER
      const bb = b.subscription?.current_period_end ? new Date(b.subscription.current_period_end).getTime() : Number.MAX_SAFE_INTEGER
      return aa - bb
    })

  const counts = (rows || []).reduce((acc, row) => {
    const s = rowState(row)
    acc.all++
    if (s.blocked) acc.blocked++
    else if (s.expired) acc.expired++
    else if (s.attention) acc.attention++
    else if (['active', 'trialing'].includes(row.subscription?.status)) acc.active++
    return acc
  }, { all: 0, active: 0, attention: 0, expired: 0, blocked: 0 })

  return <>
    <PageHeader title="Empresas" subtitle="Clientes, assinaturas, vencimentos, licenças e dispositivos." action={canCreate ? <button className="primary" onClick={() => navigate('/companies/new')}>+ Nova empresa</button> : null} />

    <Panel>
      <form className="search-row" onSubmit={e => { e.preventDefault(); load() }}>
        <input placeholder="Buscar por empresa ou CNPJ…" value={q} onChange={e => setQ(e.target.value)} />
        <button className="secondary">Buscar</button>
        {q && <button type="button" className="ghost" onClick={() => { setQ(''); load('') }}>Limpar</button>}
      </form>

      <div className="tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas <span>{counts.all}</span></button>
        <button className={filter === 'attention' ? 'active' : ''} onClick={() => setFilter('attention')}>Atenção <span>{counts.attention}</span></button>
        <button className={filter === 'expired' ? 'active' : ''} onClick={() => setFilter('expired')}>Vencidas <span>{counts.expired}</span></button>
        <button className={filter === 'blocked' ? 'active' : ''} onClick={() => setFilter('blocked')}>Bloqueadas <span>{counts.blocked}</span></button>
        <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Ativas <span>{counts.active}</span></button>
      </div>

      <Alert>{error}</Alert>
      {!rows && !error ? <Loading compact /> : visible.length === 0 ? <Empty>Nenhuma empresa neste filtro.</Empty> : <div className="table-wrap">
        <table>
          <thead><tr><th>Empresa</th><th>Plano</th><th>Vencimento</th><th>Situação</th><th>Máquinas</th><th>Status</th><th></th></tr></thead>
          <tbody>{visible.map(row => {
            const state = rowState(row)
            return <tr key={row.id} className="clickable-row" onClick={() => navigate(`/companies/${row.id}`)}>
              <td><strong>{row.trade_name || row.legal_name}</strong><small>{row.document_number || row.email || 'Sem documento'}</small></td>
              <td>{row.plan?.name || '—'}</td>
              <td className={state.expired ? 'danger-text' : ''}>{dateBR(row.subscription?.current_period_end)}</td>
              <td className={state.expired ? 'danger-text' : ''}>{dueLabel(row.subscription?.current_period_end)}</td>
              <td>{row.active_devices}</td>
              <td><StatusBadge status={state.status} /></td>
              <td className="align-right"><button className="link-button" onClick={e => { e.stopPropagation(); navigate(`/companies/${row.id}`) }}>Abrir</button></td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </Panel>
  </>
}
