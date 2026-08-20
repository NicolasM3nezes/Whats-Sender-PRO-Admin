import React, { useEffect, useMemo, useState } from 'react'
import { adminApi, adminConsole, releaseConsole } from '../lib/api'
import { dateTimeBR } from '../lib/format'
import { Alert, ConfirmDialog, Field, Loading, Metric, Modal, PageHeader, Panel, Toast } from '../components/ui'

function bytes(value) {
  const n = Number(value || 0)
  if (!n) return '0 MB'
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function ReleaseBadge({ status }) {
  const s = String(status || '').toLowerCase()
  const tone = s === 'published' ? 'green' : s === 'ready' ? 'amber' : s === 'withdrawn' ? 'red' : 'gray'
  const labels = { published: 'Publicada', ready: 'Pronta', draft: 'Rascunho', withdrawn: 'Retirada' }
  return <span className={`badge ${tone}`}>{labels[s] || status || '—'}</span>
}

function audienceLabel(rollout) {
  if (!rollout) return 'Sem liberação'
  if (rollout.audience === 'all') return 'Todos os clientes'
  if (rollout.audience === 'testers') return 'Somente testadores'
  if (rollout.audience === 'organization') return rollout.organization_name || 'Empresa específica'
  if (rollout.audience === 'percentage') return `${rollout.percentage || 0}% dos dispositivos`
  return rollout.audience || '—'
}

export default function SystemPage({ me }) {
  const [tab, setTab] = useState('updates')
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [overview, setOverview] = useState(null)
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)
  const [rolloutModal, setRolloutModal] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [withdrawTarget, setWithdrawTarget] = useState(null)

  async function load() {
    setError('')
    try {
      const [systemResult, releaseResult, companyRows] = await Promise.all([
        adminConsole('system.get'),
        releaseConsole('overview'),
        adminApi('companies.list', { q: '' }),
      ])

      setData(systemResult)
      setOverview(releaseResult)
      setCompanies(companyRows || [])

      const s = systemResult.settings || {}
      setForm({
        minimum_supported_version: s.minimum_supported_version || '',
        latest_version: s.latest_version || '',
        maintenance_mode: Boolean(s.maintenance_mode),
        maintenance_message: s.maintenance_message || '',
        support_url: s.support_url || '',
        update_url: s.update_url || '',
        release_notes: s.metadata?.release_notes || '',
      })
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { load() }, [])

  const releases = overview?.releases || []
  const summary = overview?.summary || {}
  const latest = overview?.runtime?.latest_version || form?.latest_version || '—'

  const companyOptions = useMemo(
    () => [...companies].sort((a, b) => String(a.trade_name || a.legal_name).localeCompare(String(b.trade_name || b.legal_name), 'pt-BR')),
    [companies],
  )

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function saveSystem(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await adminConsole('system.update', form)
      setToast({ message: 'Configurações do sistema atualizadas.', type: 'success' })
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function openRollout(release, mode) {
    const current = release.rollout || {}
    setRolloutModal({
      mode,
      release,
      audience: current.audience || 'testers',
      organization_id: current.organization_id || '',
      percentage: current.percentage || 10,
    })
  }

  async function submitRollout(e) {
    e.preventDefault()
    if (!rolloutModal) return
    setBusy(true)
    setError('')
    try {
      const payload = {
        release_id: rolloutModal.release.id,
        audience: rolloutModal.audience,
      }
      if (rolloutModal.audience === 'organization') payload.organization_id = rolloutModal.organization_id
      if (rolloutModal.audience === 'percentage') payload.percentage = Number(rolloutModal.percentage)

      await releaseConsole(rolloutModal.mode === 'publish' ? 'publish' : 'rollout.set', payload)
      setToast({
        message: rolloutModal.mode === 'publish' ? `Versão ${rolloutModal.release.version} publicada.` : 'Liberação da versão atualizada.',
        type: 'success',
      })
      setRolloutModal(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  function openEdit(release) {
    setEditModal({
      release,
      mandatory: Boolean(release.mandatory),
      release_notes: release.release_notes || '',
    })
  }

  async function submitEdit(e) {
    e.preventDefault()
    if (!editModal) return
    setBusy(true)
    setError('')
    try {
      await releaseConsole('release.update', {
        release_id: editModal.release.id,
        mandatory: editModal.mandatory,
        release_notes: editModal.release_notes,
      })
      setToast({ message: `Versão ${editModal.release.version} atualizada.`, type: 'success' })
      setEditModal(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmWithdraw() {
    if (!withdrawTarget) return
    setBusy(true)
    setError('')
    try {
      await releaseConsole('withdraw', { release_id: withdrawTarget.id })
      setToast({ message: `Versão ${withdrawTarget.version} retirada da distribuição.`, type: 'success' })
      setWithdrawTarget(null)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (me?.role !== 'owner') {
    return <div className="state error-state"><strong>Acesso exclusivo do Owner</strong><span>Somente o proprietário da plataforma pode acessar Sistema.</span></div>
  }

  if (!form && !overview && !error) return <Loading />

  return (
    <>
      <PageHeader
        title="Sistema"
        subtitle="Área exclusiva do Owner: atualizações, versões e configurações globais."
        action={<button className="ghost" onClick={load} disabled={busy}>Atualizar</button>}
      />

      <Alert>{error}</Alert>

      <div className="tabs">
        <button className={tab === 'updates' ? 'active' : ''} onClick={() => setTab('updates')}>Atualizações <span>{releases.length}</span></button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Configurações</button>
      </div>

      {tab === 'updates' && (
        <>
          <Panel>
            <div className="panel-head">
              <div>
                <h2>Publicação do Whats Sender PRO</h2>
                <p className="muted">O Publisher envia os arquivos grandes direto para o Storage. Aqui você controla quem recebe cada versão e acompanha o resultado.</p>
              </div>
              <span className="role-badge role-owner">Owner</span>
            </div>
            <div className="detail-grid four-cols">
              <div className="detail"><span>Versão publicada mais recente</span><strong>{latest}</strong></div>
              <div className="detail"><span>Versão mínima suportada</span><strong>{overview?.runtime?.minimum_supported_version || 'Não definida'}</strong></div>
              <div className="detail"><span>Modo manutenção</span><strong>{overview?.runtime?.maintenance_mode ? 'Ativo' : 'Desativado'}</strong></div>
              <div className="detail"><span>Fluxo de arquivos</span><strong>Publisher → Storage privado</strong></div>
            </div>
          </Panel>

          <div className="metrics-grid">
            <Metric label="Releases" value={summary.releases || 0} helper="Histórico total" />
            <Metric label="Publicadas" value={summary.published || 0} helper="Disponíveis em rollout" />
            <Metric label="Downloads concluídos" value={summary.download_completed || 0} helper="Eventos registrados" />
            <Metric label="Falhas" value={summary.failures || 0} helper="Instalação / rollback" />
            <Metric label={`Executando ${latest}`} value={summary.running_latest || 0} helper="Dispositivos ativos" />
          </div>

          <Panel>
            <div className="panel-head">
              <div>
                <h2>Histórico de versões</h2>
                <p className="muted">Publique primeiro para uma empresa/testadores e depois amplie para todos quando estiver validado.</p>
              </div>
            </div>

            {!overview && !error ? <Loading compact /> : releases.length === 0 ? (
              <div className="empty">Nenhuma release criada pelo Publisher ainda.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Versão</th><th>Status</th><th>Liberação</th><th>Pacote</th><th>Atualização</th><th>Dispositivos</th><th>Publicada</th><th></th></tr>
                  </thead>
                  <tbody>
                    {releases.map(release => {
                      const failures = Number(release.stats?.install_failed || 0) + Number(release.stats?.rollback_failed || 0)
                      return (
                        <tr key={release.id}>
                          <td>
                            <strong>{release.version}</strong>
                            <small>{release.channel === 'production' ? 'Produção' : 'Teste'}{release.mandatory ? ' · Obrigatória' : ''}</small>
                          </td>
                          <td><ReleaseBadge status={release.status} /></td>
                          <td><strong>{audienceLabel(release.rollout)}</strong><small>{release.rollout?.audience === 'organization' ? 'Rollout controlado' : release.rollout ? 'Rollout ativo' : 'Aguardando publicação'}</small></td>
                          <td><strong>{bytes(release.total_size_bytes)}</strong><small>{release.file_count || 0} componentes</small></td>
                          <td><strong>{release.stats?.download_completed || 0} downloads</strong><small>{failures ? `${failures} falha(s)` : `${release.stats?.install_started || 0} instalação(ões) iniciada(s)`}</small></td>
                          <td><strong>{release.stats?.running || 0}</strong><small>executando esta versão</small></td>
                          <td>{dateTimeBR(release.published_at)}</td>
                          <td className="action-cell align-right">
                            <div className="actions compact-actions">
                              {release.status === 'ready' && <button className="primary" onClick={() => openRollout(release, 'publish')}>Publicar</button>}
                              {release.status === 'published' && <button className="secondary" onClick={() => openRollout(release, 'rollout')}>Alterar liberação</button>}
                              {['ready', 'published'].includes(release.status) && <button className="ghost" onClick={() => openEdit(release)}>Editar</button>}
                              {['ready', 'published'].includes(release.status) && <button className="danger-button" onClick={() => setWithdrawTarget(release)}>Retirar</button>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === 'settings' && form && (
        <form onSubmit={saveSystem}>
          <div className="company-grid">
            <Panel>
              <h2>Controle de versões</h2>
              <p className="muted section-desc">A versão mais recente é sincronizada automaticamente quando uma release de produção é publicada.</p>
              <div className="form-grid single-col-form">
                <Field label="Versão mais recente publicada"><input value={form.latest_version} disabled /></Field>
                <Field label="Versão mínima suportada"><input placeholder="Ex.: 1.1.0" value={form.minimum_supported_version} onChange={e => set('minimum_supported_version', e.target.value)} /></Field>
                <Field label="URL de atualização"><input placeholder="https://..." value={form.update_url} onChange={e => set('update_url', e.target.value)} /></Field>
                <Field label="URL de suporte"><input placeholder="https://..." value={form.support_url} onChange={e => set('support_url', e.target.value)} /></Field>
              </div>
            </Panel>

            <Panel>
              <h2>Modo manutenção</h2>
              <p className="muted section-desc">Use somente quando precisar interromper temporariamente novas validações do aplicativo.</p>
              <label className="switch-row"><span><strong>Ativar manutenção</strong><small>Bloqueia o uso conforme as regras de runtime do cliente.</small></span><input type="checkbox" checked={form.maintenance_mode} onChange={e => set('maintenance_mode', e.target.checked)} /></label>
              <Field label="Mensagem de manutenção"><textarea rows="5" value={form.maintenance_message} onChange={e => set('maintenance_message', e.target.value)} placeholder="Ex.: Estamos realizando uma atualização. Tente novamente em alguns minutos." /></Field>
            </Panel>
          </div>

          <Panel>
            <h2>Notas gerais do runtime</h2>
            <Field label="Observações"><textarea rows="6" value={form.release_notes} onChange={e => set('release_notes', e.target.value)} placeholder="Observações internas sobre a versão/runtime atual." /></Field>
            <div className="system-meta"><span>Produto: <strong>{data?.product?.name || 'Whats Sender PRO'}</strong></span><span>Última alteração: <strong>{dateTimeBR(data?.settings?.updated_at)}</strong></span></div>
          </Panel>

          <div className="sticky-save"><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar configurações'}</button></div>
        </form>
      )}

      {rolloutModal && (
        <Modal
          title={rolloutModal.mode === 'publish' ? `Publicar ${rolloutModal.release.version}` : `Alterar liberação ${rolloutModal.release.version}`}
          subtitle="Escolha exatamente quem poderá receber esta versão."
          onClose={() => !busy && setRolloutModal(null)}
        >
          <form className="stack-lg" onSubmit={submitRollout}>
            <Field label="Público">
              <select value={rolloutModal.audience} onChange={e => setRolloutModal(m => ({ ...m, audience: e.target.value }))}>
                <option value="testers">Somente testadores</option>
                <option value="organization">Empresa específica</option>
                <option value="percentage">Percentual dos dispositivos</option>
                <option value="all">Todos os clientes</option>
              </select>
            </Field>

            {rolloutModal.audience === 'organization' && (
              <Field label="Empresa">
                <select required value={rolloutModal.organization_id} onChange={e => setRolloutModal(m => ({ ...m, organization_id: e.target.value }))}>
                  <option value="">Selecione uma empresa…</option>
                  {companyOptions.map(company => <option key={company.id} value={company.id}>{company.trade_name || company.legal_name}</option>)}
                </select>
              </Field>
            )}

            {rolloutModal.audience === 'percentage' && (
              <Field label="Percentual">
                <input type="number" min="1" max="100" required value={rolloutModal.percentage} onChange={e => setRolloutModal(m => ({ ...m, percentage: e.target.value }))} />
              </Field>
            )}

            {rolloutModal.audience === 'all' && <div className="alert error">Esta opção disponibiliza a versão para todos os clientes elegíveis. Use depois de validar a versão em teste.</div>}

            <div className="actions">
              <button type="button" className="ghost" onClick={() => setRolloutModal(null)} disabled={busy}>Cancelar</button>
              <button className="primary" disabled={busy}>{busy ? 'Processando…' : rolloutModal.mode === 'publish' ? 'Publicar versão' : 'Salvar liberação'}</button>
            </div>
          </form>
        </Modal>
      )}

      {editModal && (
        <Modal title={`Editar ${editModal.release.version}`} subtitle="Ajuste as informações de distribuição desta release." onClose={() => !busy && setEditModal(null)}>
          <form className="stack-lg" onSubmit={submitEdit}>
            <label className="switch-row"><span><strong>Atualização obrigatória</strong><small>Quando habilitada, o aplicativo não deve permitir continuar usando uma versão anterior.</small></span><input type="checkbox" checked={editModal.mandatory} onChange={e => setEditModal(m => ({ ...m, mandatory: e.target.checked }))} /></label>
            <Field label="Notas da versão"><textarea rows="7" value={editModal.release_notes} onChange={e => setEditModal(m => ({ ...m, release_notes: e.target.value }))} placeholder="Correções e melhorias desta versão." /></Field>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => setEditModal(null)} disabled={busy}>Cancelar</button>
              <button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar versão'}</button>
            </div>
          </form>
        </Modal>
      )}

      {withdrawTarget && (
        <ConfirmDialog
          title={`Retirar versão ${withdrawTarget.version}?`}
          message="A versão deixará de ser oferecida pelo sistema de atualização. Os computadores que já instalaram a versão não serão rebaixados automaticamente."
          confirmLabel="Retirar versão"
          danger
          busy={busy}
          onCancel={() => setWithdrawTarget(null)}
          onConfirm={confirmWithdraw}
        />
      )}

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </>
  )
}
