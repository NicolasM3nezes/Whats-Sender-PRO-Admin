import React, { useEffect, useMemo, useState } from 'react'
import { adminConsole } from '../lib/api'
import { actionLabel, dateTimeBR } from '../lib/format'
import { Alert, Empty, Loading, Modal, PageHeader, Panel } from '../components/ui'

function LogDetail({ log, onClose }) {
  return (
    <Modal title={actionLabel(log.action)} subtitle={dateTimeBR(log.created_at)} onClose={onClose} width="760px">
      <div className="detail-grid">
        <div className="detail"><span>Administrador</span><strong>{log.actor_name || log.actor_email || 'Sistema'}</strong></div>
        <div className="detail"><span>Empresa</span><strong>{log.organization_name || '—'}</strong></div>
        <div className="detail"><span>Entidade</span><strong>{log.entity_type || '—'}</strong></div>
        <div className="detail"><span>ID</span><strong className="mono-small">{log.entity_id || '—'}</strong></div>
      </div>
      {log.metadata && Object.keys(log.metadata).length > 0 && <><h3>Detalhes</h3><pre className="json-box">{JSON.stringify(log.metadata, null, 2)}</pre></>}
      {(log.before_data || log.after_data) && (
        <div className="audit-compare">
          <div><h3>Antes</h3><pre className="json-box">{JSON.stringify(log.before_data || {}, null, 2)}</pre></div>
          <div><h3>Depois</h3><pre className="json-box">{JSON.stringify(log.after_data || {}, null, 2)}</pre></div>
        </div>
      )}
    </Modal>
  )
}

export default function AuditPage() {
  const [rows, setRows] = useState(null)
  const [q, setQ] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  async function load(search = q) {
    setError('')
    try { setRows(await adminConsole('audit.list', { q: search, limit: 150 })) }
    catch (e) { setError(e.message) }
  }

  useEffect(() => { load('') }, [])

  return (
    <>
      <PageHeader title="Auditoria" subtitle="Histórico de ações administrativas e alterações sensíveis." action={<button className="ghost" onClick={() => load()}>Atualizar</button>} />
      <Panel>
        <form className="search-row" onSubmit={e => { e.preventDefault(); load() }}>
          <input placeholder="Buscar por ação ou tipo de entidade…" value={q} onChange={e => setQ(e.target.value)} />
          <button className="secondary">Buscar</button>
          {q && <button type="button" className="ghost" onClick={() => { setQ(''); load('') }}>Limpar</button>}
        </form>
        <Alert>{error}</Alert>
        {!rows && !error ? <Loading compact /> : rows?.length === 0 ? <Empty>Nenhum evento encontrado.</Empty> : rows && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data</th><th>Ação</th><th>Administrador</th><th>Empresa</th><th></th></tr></thead>
              <tbody>
                {rows.map(log => (
                  <tr key={log.id} className="clickable-row" onClick={() => setSelected(log)}>
                    <td>{dateTimeBR(log.created_at)}</td>
                    <td><strong>{actionLabel(log.action)}</strong><small>{log.entity_type}</small></td>
                    <td>{log.actor_name || log.actor_email || log.actor_type || 'Sistema'}</td>
                    <td>{log.organization_name || '—'}</td>
                    <td className="align-right"><button className="link-button" onClick={e => { e.stopPropagation(); setSelected(log) }}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {selected && <LogDetail log={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
