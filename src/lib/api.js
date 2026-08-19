import { supabase } from './supabase'

function friendlyFunctionError(error) {
  let message = error?.message || 'Falha ao acessar o backend.'
  return { message, status: error?.context?.status }
}

async function invoke(functionName, action, payload = {}) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: { action, payload },
  })

  if (error) {
    const parsed = friendlyFunctionError(error)
    try {
      if (error?.context?.json) {
        const body = await error.context.json()
        parsed.message = body?.error || body?.message || parsed.message
      }
    } catch {}
    const e = new Error(parsed.message)
    e.status = parsed.status
    throw e
  }

  if (!data?.ok) {
    throw new Error(data?.error || 'Operação não concluída.')
  }

  return data.data
}

export const adminApi = (action, payload = {}) => invoke('admin-api', action, payload)
export const adminManagement = (action, payload = {}) => invoke('admin-management', action, payload)
export const adminConsole = (action, payload = {}) => invoke('admin-console', action, payload)
async function invokeRaw(functionName, body = {}) {
  const { data, error } = await supabase.functions.invoke(functionName, { body })
  if (error) {
    let message = error?.message || 'Falha ao acessar o backend.'
    try {
      if (error?.context?.json) {
        const parsed = await error.context.json()
        message = parsed?.error || parsed?.message || message
      }
    } catch {}
    const e = new Error(message)
    e.status = error?.context?.status
    throw e
  }
  if (!data?.ok) throw new Error(data?.error || 'Operação não concluída.')
  return data.data
}

export const createCompany = (payload = {}) => invokeRaw('company-create-v2', payload)
export const lookupCnpj = (cnpj) => invokeRaw('cnpj-lookup', { cnpj })

export async function sendPasswordRecovery(email) {
  const redirectTo = `${window.location.origin}/reset-password`
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
  if (error) throw error
  return { redirectTo }
}
