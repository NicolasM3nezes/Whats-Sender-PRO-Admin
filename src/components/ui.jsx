import React from 'react'
import { roleLabel } from '../lib/format'

export function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'compact' : ''}`}>
      <div className={`brand-mark ${compact ? 'small' : ''}`}>WS</div>
      <div className="brand-copy">
        <strong>Whats Sender</strong>
        <span>Admin</span>
      </div>
    </div>
  )
}

export function Loading({ label = 'Carregando…', compact = false }) {
  return (
    <div className={`state ${compact ? 'compact-state' : ''}`}>
      <div className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>
}

export function Alert({ type = 'error', children }) {
  if (!children) return null
  return <div className={`alert ${type}`}>{children}</div>
}

export function PageHeader({ title, subtitle, action, back }) {
  return (
    <header className="page-head">
      <div>
        {back && <button className="back" onClick={back}>← Voltar</button>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Metric({ label, value, helper }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {helper && <div className="metric-helper">{helper}</div>}
    </div>
  )
}

export function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase()
  const tone = ['active', 'trialing', 'paid'].includes(s)
    ? 'green'
    : ['suspended', 'past_due', 'pending'].includes(s)
      ? 'amber'
      : ['expired', 'canceled', 'revoked', 'failed', 'chargeback'].includes(s)
        ? 'red'
        : 'gray'
  const labels = {
    active: 'Ativo', trialing: 'Teste', paid: 'Pago', suspended: 'Bloqueado',
    past_due: 'Pendente', pending: 'Pendente', expired: 'Vencido', canceled: 'Cancelado',
    revoked: 'Revogado', failed: 'Falhou', refunded: 'Estornado', chargeback: 'Chargeback', archived: 'Arquivado',
  }
  return <span className={`badge ${tone}`}>{labels[s] || status || '—'}</span>
}

export function RoleBadge({ role }) {
  return <span className={`role-badge role-${role || 'unknown'}`}>{roleLabel(role)}</span>
}

export function Panel({ children, className = '' }) {
  return <section className={`panel ${className}`.trim()}>{children}</section>
}

export function Field({ label, children, className = '' }) {
  return <label className={className}><span>{label}</span>{children}</label>
}

export function Detail({ label, children, value }) {
  return <div className="detail"><span>{label}</span><strong>{children ?? value ?? '—'}</strong></div>
}

export function Modal({ title, subtitle, children, onClose, width = '620px' }) {
  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose?.()}>
      <div className="modal-card" style={{ maxWidth: width }}>
        <div className="modal-head">
          <div><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div>
          <button className="icon-button" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger = false, onConfirm, onCancel, busy = false }) {
  return (
    <Modal title={title} onClose={onCancel} width="480px">
      <p className="modal-message">{message}</p>
      <div className="actions">
        <button className="ghost" onClick={onCancel} disabled={busy}>Cancelar</button>
        <button className={danger ? 'danger-button' : 'primary'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Processando…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function Toast({ message, type = 'success', onClose }) {
  if (!message) return null
  return (
    <div className={`toast ${type}`}>
      <span>{message}</span>
      <button onClick={onClose}>×</button>
    </div>
  )
}

export function PasswordStrength({ password }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const label = score <= 2 ? 'Fraca' : score <= 4 ? 'Boa' : 'Forte'
  return (
    <div className="password-strength">
      <div className="strength-bars">
        {[1,2,3,4,5].map(i => <i key={i} className={i <= score ? 'on' : ''} />)}
      </div>
      <span>{password ? label : 'Use pelo menos 8 caracteres'}</span>
    </div>
  )
}
