import React, { useEffect, useState } from 'react'
import { adminConsole } from '../lib/api'
import { dateTimeBR } from '../lib/format'
import { Alert, Field, Loading, PageHeader, Panel, Toast } from '../components/ui'

export default function SystemPage({ me }) {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  async function load() {
    setError('')
    try {
      const result = await adminConsole('system.get')
      setData(result)
      const s = result.settings || {}
      setForm({
        minimum_supported_version: s.minimum_supported_version || '',
        latest_version: s.latest_version || '',
        maintenance_mode: Boolean(s.maintenance_mode),
        maintenance_message: s.maintenance_message || '',
        support_url: s.support_url || '',
        update_url: s.update_url || '',
        release_notes: s.metadata?.release_notes || '',
      })
    } catch (e) { setError(e.message) }
  }

  useEffect(() => { load() }, [])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save(e) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      await adminConsole('system.update', form)
      setToast({ message: 'Configurações do sistema atualizadas.', type: 'success' })
      await load()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  if (!form && !error) return <Loading />

  return (
    <>
      <PageHeader title="Sistema" subtitle="Versões, manutenção e links usados pelo aplicativo." action={<button className="ghost" onClick={load}>Atualizar</button>} />
      <Alert>{error}</Alert>
      {form && (
        <form onSubmit={save}>
          <div className="company-grid">
            <Panel>
              <h2>Controle de versões</h2>
              <p className="muted section-desc">Use esses campos para avisos de atualização e para impedir versões antigas quando necessário.</p>
              <div className="form-grid single-col-form">
                <Field label="Versão mais recente"><input placeholder="Ex.: 1.2.0" value={form.latest_version} onChange={e => set('latest_version', e.target.value)} disabled={me.role !== 'owner'} /></Field>
                <Field label="Versão mínima suportada"><input placeholder="Ex.: 1.0.0" value={form.minimum_supported_version} onChange={e => set('minimum_supported_version', e.target.value)} disabled={me.role !== 'owner'} /></Field>
                <Field label="URL de atualização"><input placeholder="https://..." value={form.update_url} onChange={e => set('update_url', e.target.value)} disabled={me.role !== 'owner'} /></Field>
                <Field label="URL de suporte"><input placeholder="https://..." value={form.support_url} onChange={e => set('support_url', e.target.value)} disabled={me.role !== 'owner'} /></Field>
              </div>
            </Panel>

            <Panel>
              <h2>Modo manutenção</h2>
              <p className="muted section-desc">Quando ativo, a infraestrutura de licença pode bloquear novas validações conforme a regra do cliente.</p>
              <label className="switch-row"><span><strong>Ativar manutenção</strong><small>Use apenas quando precisar interromper temporariamente o uso.</small></span><input type="checkbox" checked={form.maintenance_mode} onChange={e => set('maintenance_mode', e.target.checked)} disabled={me.role !== 'owner'} /></label>
              <Field label="Mensagem de manutenção"><textarea rows="5" value={form.maintenance_message} onChange={e => set('maintenance_message', e.target.value)} disabled={me.role !== 'owner'} placeholder="Ex.: Estamos realizando uma atualização. Tente novamente em alguns minutos." /></Field>
            </Panel>
          </div>

          <Panel>
            <h2>Notas da versão</h2>
            <Field label="O que mudou"><textarea rows="7" value={form.release_notes} onChange={e => set('release_notes', e.target.value)} disabled={me.role !== 'owner'} placeholder="Ex.: Novo painel, melhorias de estabilidade, correções..." /></Field>
            <div className="system-meta"><span>Produto: <strong>{data?.product?.name || 'Whats Sender PRO'}</strong></span><span>Última alteração: <strong>{dateTimeBR(data?.settings?.updated_at)}</strong></span></div>
          </Panel>

          {me.role === 'owner' && <div className="sticky-save"><button className="primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar configurações'}</button></div>}
        </form>
      )}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </>
  )
}
