import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
if (!url || !key) throw new Error('Configure as variáveis do Supabase.')

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

async function invoke(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let message = error.message || 'Falha ao acessar o backend.'
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
  if (!data?.ok) throw new Error(data?.error || 'Operação não autorizada.')
  return data.data
}

export const adminApi = (action, payload = {}) => invoke('admin-api', { action, payload })
export const adminManagement = (action, payload = {}) => invoke('admin-management', { action, payload })
export const lookupCnpj = (cnpj) => invoke('cnpj-lookup', { cnpj })
export const createCompany = (payload) => invoke('company-create-v2', payload)
