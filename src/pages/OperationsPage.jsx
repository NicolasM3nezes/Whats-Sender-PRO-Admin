import React, { useEffect, useMemo, useState } from 'react'
import { operationsConsole } from '../lib/api'
import { dateTimeBR } from '../lib/format'
import { Alert, Loading, Metric, PageHeader, Panel } from '../components/ui'

function online(lastHeartbeat) {
  if (!lastHeartbeat) return false
  return Date.now() - new Date(lastHeartbeat).getTime() <= 15 * 60 * 1000
}

function tone(status) {
  if (['completed', 'online', 'current'].includes(status)) return 'green'
  if (['running', 'stopped', 'outdated'].includes(status)) return 'amber'
  if (['failed', 'offline', 'error'].includes(status)) return 'red'
  return 'gray'
}

function Pill({ status, children }) {
  return <span className={`badge ${tone(status)}`}>{children}</span>
}

export default function OperationsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState('devices')

  async function load() {
    setBusy(true)
    setError('')
    try {
      setData(await operationsConsole('overview'))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [])

  const latest = data?.runtime?.latest_version || '—'
  const devices = data?.devices || []
  const campaigns = data?.campaigns || []
  const errors = data?.errors || []
  const summary = data?.summary || {}

  const versionCounts = useMemo(() => {
    const map = new Map()
    devices.forEach(d => map.set(d.app_version || 'Sem versão', (map.get(d.app_version || 'Sem versão') || 0) + 1))
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [devices])

  if (!data && !error) return <Loading label="Carregando operação…" />

  return (
    <>
      <PageHeader
        title="Operação"
        subtitle="Saúde dos computadores, versões, campanhas e erros técnicos. Nenhum conteúdo de mensagem ou telefone é coletado."
        action={<button className="ghost" onClick={load} disabled={busy}>{busy ? 'Atualizando…' : 'Atualizar'}</button>}
      />
      <Alert>{error}</Alert>

      <div className="metrics-grid">
        <Metric label="Dispositivos monitorados" value={summary.devices || 0} helper="Com telemetria ativa" />
        <Metric label="Online agora" value={summary.online || 0} helper="Heartbeat nos últimos 15 min" />
        <Metric label="Desatualizados" value={summary.outdated || 0} helper={`Versão atual: ${latest}`} />
        <Metric label="Campanhas 24h" value={summary.campaigns_24h || 0} helper="Execuções reportadas" />
        <Metric label="Erros 24h" value={summary.errors_24h || 0} helper="Somente códigos técnicos" />
      </div>

      <div className="company-grid">
        <Panel>
          <div className="panel-head"><div><h2>Adoção de versões</h2><p className="muted">Quantos PCs estão executando cada versão.</p></div></div>
          <div className="simple-list">
            {versionCounts.length === 0 && <span className="muted">Ainda não há heartbeats da v1.2.0.</span>}
            {versionCounts.map(([version, count]) => (
              <div className="list-row" key={version}>
                <div><strong>{version}</strong><span>{version === latest ? 'Versão mais recente' : 'Versão instalada'}</span></div>
                <Pill status={version === latest ? 'current' : 'outdated'}>{count} dispositivo{count === 1 ? '' : 's'}</Pill>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="panel-head"><div><h2>Privacidade operacional</h2><p className="muted">O painel recebe somente metadados necessários para suporte.</p></div></div>
          <div className="detail-grid single-col">
            <div className="detail"><span>Coletado</span><strong>Versão, Windows, Chrome, estado técnico e totais</strong></div>
            <div className="detail"><span>Não coletado</span><strong>Telefones, nomes dos contatos, mensagens e mídias</strong></div>
            <div className="detail"><span>Heartbeat</span><strong>A cada 5 minutos enquanto o app estiver aberto</strong></div>
          </div>
        </Panel>
      </div>

      <div className="tabs">
        <button className={tab === 'devices' ? 'active' : ''} onClick={() => setTab('devices')}>Computadores <span>{devices.length}</span></button>
        <button className={tab === 'campaigns' ? 'active' : ''} onClick={() => setTab('campaigns')}>Campanhas <span>{campaigns.length}</span></button>
        <button className={tab === 'errors' ? 'active' : ''} onClick={() => setTab('errors')}>Erros <span>{errors.length}</span></button>
      </div>

      {tab === 'devices' && <Panel>
        <div className="panel-head"><div><h2>Computadores</h2><p className="muted">Último estado técnico reportado por dispositivo.</p></div></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Empresa / computador</th><th>Versão</th><th>WhatsApp</th><th>Windows / Chrome</th><th>Último contato</th><th>Status</th></tr></thead>
          <tbody>{devices.map(d => {
            const isOnline = online(d.last_heartbeat_at)
            const isCurrent = !latest || latest === '—' || d.app_version === latest
            return <tr key={d.device_id}>
              <td><strong>{d.organization_name}</strong><small>{d.device_name}</small></td>
              <td><strong>{d.app_version || '—'}</strong><small>{isCurrent ? 'Atual' : `Atual: ${latest}`}</small></td>
              <td>{d.whatsapp_state || '—'}</td>
              <td><strong>{[d.os_name, d.os_version].filter(Boolean).join(' ') || '—'}</strong><small>Chrome {d.chrome_version || '—'}</small></td>
              <td>{dateTimeBR(d.last_heartbeat_at)}</td>
              <td><Pill status={isOnline ? 'online' : 'offline'}>{isOnline ? 'Online' : 'Offline'}</Pill></td>
            </tr>
          })}</tbody>
        </table></div>
      </Panel>}

      {tab === 'campaigns' && <Panel>
        <div className="panel-head"><div><h2>Campanhas recentes</h2><p className="muted">Somente nome da campanha e contadores operacionais.</p></div></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Campanha</th><th>Empresa</th><th>Resultado</th><th>Modo</th><th>Versão</th><th>Atualização</th></tr></thead>
          <tbody>{campaigns.map(c => <tr key={c.id}>
            <td><strong>{c.campaign_name || 'Campanha'}</strong><small>{c.device_name}</small></td>
            <td>{c.organization_name}</td>
            <td><strong>{c.sent_count} enviados • {c.failed_count} falhas</strong><small>{c.total_count} total • {c.remaining_count} restantes</small></td>
            <td><strong>{c.speed_mode || '—'}</strong><small>{c.media_mode || '—'}{c.test_mode ? ' • TESTE' : ''}</small></td>
            <td>{c.app_version || '—'}</td>
            <td><Pill status={c.status}>{String(c.status || '—').toUpperCase()}</Pill><small>{dateTimeBR(c.updated_at)}</small></td>
          </tr>)}</tbody>
        </table></div>
      </Panel>}

      {tab === 'errors' && <Panel>
        <div className="panel-head"><div><h2>Erros técnicos recentes</h2><p className="muted">Códigos para diagnóstico, sem conteúdo do cliente.</p></div></div>
        <div className="table-wrap"><table>
          <thead><tr><th>Horário</th><th>Evento</th><th>Código</th><th>Versão</th><th>Severidade</th></tr></thead>
          <tbody>{errors.map(e => <tr key={e.id}>
            <td>{dateTimeBR(e.created_at)}</td><td>{e.event_type}</td><td className="mono-small">{e.code || '—'}</td><td>{e.app_version || '—'}</td><td><Pill status="error">ERRO</Pill></td>
          </tr>)}</tbody>
        </table></div>
      </Panel>}
    </>
  )
}
