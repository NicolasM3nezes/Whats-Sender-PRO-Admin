import React, { useEffect, useState } from 'react'
import { adminApi, adminConsole } from '../lib/api'
import { dateBR, daysUntil, money } from '../lib/format'
import { Alert, Empty, Loading, Metric, PageHeader, Panel, StatusBadge } from '../components/ui'

export default function DashboardPage({ navigate, me }) {
  const [data, setData] = useState(null)
  const [system, setSystem] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    setError('')
    try {
      const [dashboard, runtime] = await Promise.all([
        adminApi('dashboard'),
        adminConsole('system.get').catch(() => null),
      ])
      setData(dashboard)
      setSystem(runtime)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [])

  if (!data && !error) return <Loading />

  const runtime = system?.settings

  return (
    <>
      <PageHeader
        title="Visão geral"
        subtitle="Operação comercial, licenciamento e saúde do produto."
        action={<button className="ghost" onClick={load}>Atualizar</button>}
      />

      <Alert>{error}</Alert>

      {runtime?.maintenance_mode && (
        <div className="maintenance-banner">
          <div><strong>Modo manutenção ativo</strong><span>{runtime.maintenance_message || 'O aplicativo está configurado para manutenção.'}</span></div>
          <StatusBadge status="suspended" />
        </div>
      )}

      {data && (
        <>
          <div className="metrics-grid">
            <Metric label="Empresas" value={data.companies} helper={`${data.active_companies} com assinatura ativa`} />
            <Metric label="Bloqueadas" value={data.blocked_companies} />
            <Metric label="Vencidas" value={data.expired_subscriptions} />
            <Metric label="Receita contratada" value={money(data.mrr_cents)} helper="mensal atual" />
            <Metric label="Recebido no mês" value={money(data.received_month_cents)} />
          </div>

          <div className="dashboard-grid">
            <Panel>
              <div className="panel-head">
                <div><h2>Vencem nos próximos 7 dias</h2><p className="muted">Prioridade para cobrança e renovação.</p></div>
              </div>
              {data.expiring_7_days?.length ? (
                <div className="simple-list">
                  {data.expiring_7_days.map(item => {
                    const days = daysUntil(item.current_period_end)
                    return (
                      <button className="list-row button-row" key={item.organization_id} onClick={() => navigate(`/companies/${item.organization_id}`)}>
                        <div><strong>{item.company_name}</strong><span>Vence em {dateBR(item.current_period_end)}</span></div>
                        <span className={`days-pill ${days != null && days <= 2 ? 'urgent' : ''}`}>{days ?? '—'} dias</span>
                      </button>
                    )
                  })}
                </div>
              ) : <Empty>Nenhuma assinatura vence nos próximos 7 dias.</Empty>}
            </Panel>

            <Panel>
              <div className="panel-head"><div><h2>Versão do produto</h2><p className="muted">Controle central do aplicativo instalado.</p></div></div>
              <div className="detail-grid single-col">
                <div className="detail"><span>Versão mais recente</span><strong>{runtime?.latest_version || 'Não definida'}</strong></div>
                <div className="detail"><span>Versão mínima aceita</span><strong>{runtime?.minimum_supported_version || 'Não definida'}</strong></div>
                <div className="detail"><span>Última alteração</span><strong>{runtime?.updated_at ? dateBR(runtime.updated_at) : '—'}</strong></div>
              </div>
              {['owner', 'admin'].includes(me?.role) && <button className="secondary full" onClick={() => navigate('/system')}>Abrir configurações do sistema</button>}
            </Panel>
          </div>
        </>
      )}
    </>
  )
}
