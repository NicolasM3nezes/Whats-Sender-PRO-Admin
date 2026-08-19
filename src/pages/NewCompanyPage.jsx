import React, { useState } from 'react'
import { createCompany, lookupCnpj } from '../lib/api'
import { dateBR, parseBRL } from '../lib/format'
import { Alert, Field, PageHeader, Panel } from '../components/ui'

const errorMap = {
  invalid_cnpj: 'CNPJ inválido. Confira o documento informado.',
  cnpj_not_found: 'CNPJ não encontrado na base pública.',
  rate_limited: 'A consulta gratuita atingiu o limite momentâneo. Aguarde um pouco e tente novamente.',
  provider_unavailable: 'A consulta de CNPJ está temporariamente indisponível.',
  invalid_legal_name: 'Informe a razão social corretamente.',
}

function friendlyError(message) {
  return errorMap[message] || message || 'Não foi possível concluir a operação.'
}

export default function NewCompanyPage({ navigate }) {
  const [form, setForm] = useState({
    document_number: '', legal_name: '', trade_name: '', email: '', phone: '',
    plan_code: 'pro', days: 30, amount_reais: '199,00',
  })
  const [lookupInfo, setLookupInfo] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  async function searchCnpj() {
    setLookupLoading(true)
    setError('')
    setLookupInfo(null)
    try {
      const data = await lookupCnpj(form.document_number)
      setForm(f => ({
        ...f,
        document_number: data.cnpj || f.document_number,
        legal_name: data.legal_name || f.legal_name,
        trade_name: data.trade_name || f.trade_name,
        email: data.email || f.email,
        phone: data.phone || f.phone,
      }))
      setLookupInfo(data)
    } catch (e) {
      setError(friendlyError(e.message))
    } finally {
      setLookupLoading(false)
    }
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const amount = parseBRL(form.amount_reais)
      const data = await createCompany({
        ...form,
        days: Number(form.days),
        amount_cents: Math.round(amount * 100),
        cnpj_lookup: lookupInfo,
      })
      setResult(data)
    } catch (e) {
      setError(friendlyError(e.message))
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <>
        <PageHeader title="Empresa criada" subtitle="A chave completa aparece somente neste momento." back={() => navigate('/companies')} />
        <Panel className="success-panel">
          <div className="success-icon">✓</div>
          <h2>Cadastro concluído</h2>
          <p className="muted">Copie a chave e envie para a empresa ativar o primeiro computador.</p>
          <div className="license-box">
            <code>{result.license_key}</code>
            <button className="secondary" onClick={() => navigator.clipboard.writeText(result.license_key)}>Copiar</button>
          </div>
          <div className="summary-line"><span>Validade</span><strong>{dateBR(result.valid_until)}</strong></div>
          <div className="actions">
            <button className="ghost" onClick={() => navigate('/companies')}>Voltar para empresas</button>
            <button className="primary" onClick={() => navigate(`/companies/${result.organization_id}`)}>Abrir empresa</button>
          </div>
        </Panel>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Nova empresa" subtitle="Busque o CNPJ, revise os dados e gere a licença inicial." back={() => navigate('/companies')} />
      <Panel className="form-panel wide">
        <form className="form-grid" onSubmit={submit}>
          <Field label="CNPJ" className="span-2">
            <div className="cnpj-row">
              <input placeholder="00.000.000/0001-91 ou CNPJ alfanumérico" value={form.document_number} onChange={e => set('document_number', e.target.value.toUpperCase())} />
              <button type="button" className="secondary" onClick={searchCnpj} disabled={lookupLoading || !form.document_number.trim()}>{lookupLoading ? 'Buscando…' : 'Buscar dados'}</button>
            </div>
          </Field>

          {lookupInfo && (
            <div className="lookup-card span-2">
              <div><strong>Dados encontrados</strong><span>{lookupInfo.source}{lookupInfo.source_updated_at ? ` • atualizado ${dateBR(lookupInfo.source_updated_at)}` : ''}</span></div>
              <div className="lookup-meta">
                <span>Situação: <b>{lookupInfo.registration_status || '—'}</b></span>
                <span>{[lookupInfo.city, lookupInfo.state].filter(Boolean).join(' / ') || 'Local não informado'}</span>
                <span>{lookupInfo.cnae_description || 'CNAE não informado'}</span>
              </div>
            </div>
          )}

          <Field label="Razão social *" className="span-2"><input value={form.legal_name} onChange={e => set('legal_name', e.target.value)} required /></Field>
          <Field label="Nome fantasia"><input value={form.trade_name} onChange={e => set('trade_name', e.target.value)} /></Field>
          <Field label="E-mail"><input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="Telefone"><input value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
          <Field label="Plano">
            <select value={form.plan_code} onChange={e => set('plan_code', e.target.value)}><option value="pro">Pro</option><option value="trial">Trial</option></select>
          </Field>
          <Field label="Validade inicial">
            <select value={form.days} onChange={e => set('days', e.target.value)}><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">365 dias</option></select>
          </Field>
          <Field label="Valor recebido (R$)"><input value={form.amount_reais} onChange={e => set('amount_reais', e.target.value)} /></Field>

          <Alert>{error}</Alert>
          <div className="actions span-2">
            <button type="button" className="ghost" onClick={() => navigate('/companies')}>Cancelar</button>
            <button className="primary" disabled={loading}>{loading ? 'Criando…' : 'Criar empresa e gerar chave'}</button>
          </div>
        </form>
      </Panel>
    </>
  )
}
