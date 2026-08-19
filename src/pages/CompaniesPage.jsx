import React, { useEffect, useState } from 'react'
import { adminApi } from '../lib/api'
import { dateBR } from '../lib/format'
import { Alert, Empty, Loading, PageHeader, Panel, StatusBadge } from '../components/ui'

export default function CompaniesPage({ navigate }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')

  async function load(search = q) {
    setError('')
    try {
      setRows(await adminApi('companies.list', { q: search }))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load('') }, [])

  return (
    <>
      <PageHeader
        title="Empresas"
        subtitle="Clientes, assinaturas, licenças e dispositivos."
        action={<button className="primary" onClick={() => navigate('/companies/new')}>+ Nova empresa</button>}
      />

      <Panel>
        <form className="search-row" onSubmit={e => { e.preventDefault(); load() }}>
          <input placeholder="Buscar por empresa ou CNPJ…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="secondary">Buscar</button>
          {q && <button type="button" className="ghost" onClick={() => { setQ(''); load('') }}>Limpar</button>}
        </form>

        <Alert>{error}</Alert>
        {!rows && !error ? <Loading compact /> : rows?.length === 0 ? <Empty>Nenhuma empresa encontrada.</Empty> : rows && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Empresa</th><th>Plano</th><th>Vencimento</th><th>Máquinas</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {rows.map(row => {
                  const end = row.subscription?.current_period_end
                  const expired = end && new Date(end) < new Date()
                  const status = row.status === 'suspended' ? 'suspended' : expired ? 'expired' : row.subscription?.status
                  return (
                    <tr key={row.id} className="clickable-row" onClick={() => navigate(`/companies/${row.id}`)}>
                      <td><strong>{row.trade_name || row.legal_name}</strong><small>{row.document_number || row.email || 'Sem documento'}</small></td>
                      <td>{row.plan?.name || '—'}</td>
                      <td className={expired ? 'danger-text' : ''}>{dateBR(end)}</td>
                      <td>{row.active_devices}</td>
                      <td><StatusBadge status={status} /></td>
                      <td className="align-right"><button className="link-button" onClick={e => { e.stopPropagation(); navigate(`/companies/${row.id}`) }}>Abrir</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
