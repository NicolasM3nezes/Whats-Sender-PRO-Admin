const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const money = (cents = 0) => brl.format((Number(cents) || 0) / 100)

export function dateBR(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value))
  } catch {
    return '—'
  }
}

export function dateTimeBR(value) {
  if (!value) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return '—'
  }
}

export function daysUntil(value) {
  if (!value) return null
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000)
}

export function parseBRL(value) {
  const normalized = String(value ?? '').replace(/\./g, '').replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

export function roleLabel(role) {
  return {
    owner: 'Owner',
    admin: 'Administrador',
    finance: 'Financeiro',
    support: 'Suporte',
    read_only: 'Somente leitura',
  }[role] || role || '—'
}

export function actionLabel(action) {
  const labels = {
    'company.created': 'Empresa criada',
    'company.created_manual': 'Empresa criada',
    'customer.created_manual': 'Empresa criada',
    'company.renewed': 'Assinatura renovada',
    'company.blocked': 'Empresa bloqueada',
    'company.unblocked': 'Empresa desbloqueada',
    'company.updated': 'Cadastro da empresa atualizado',
    'device.revoked': 'Máquina desvinculada',
    'device.renamed': 'Máquina renomeada',
    'license.rotated': 'Chave da licença alterada',
    'payment.added': 'Pagamento registrado',
    'admin.invited': 'Administrador convidado',
    'admin.updated': 'Administrador atualizado',
    'profile.updated': 'Perfil atualizado',
    'system.runtime_updated': 'Configuração do sistema atualizada',
  }
  return labels[action] || action || '—'
}
