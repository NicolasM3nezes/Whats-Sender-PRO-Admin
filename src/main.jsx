import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { supabase, adminApi, adminManagement, lookupCnpj, createCompany } from './supabase'
import './styles.css'

const brl = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
const money = (c=0) => brl.format((Number(c)||0)/100)
const dateBR = v => v ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short'}).format(new Date(v)) : '—'
const dateTimeBR = v => v ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v)) : '—'

function Badge({status}) {
  const s = String(status||'').toLowerCase()
  const tone = ['active','trialing'].includes(s) ? 'green' : ['suspended','past_due'].includes(s) ? 'amber' : ['expired','canceled','revoked'].includes(s) ? 'red' : 'gray'
  const labels = {active:'Ativo',trialing:'Teste',suspended:'Bloqueado',past_due:'Pendente',expired:'Vencido',canceled:'Cancelado',revoked:'Revogado'}
  return <span className={`badge ${tone}`}>{labels[s]||status||'—'}</span>
}

function Loading(){return <div className="state"><div className="spinner"/><span>Carregando…</span></div>}
function Empty({children}){return <div className="empty">{children}</div>}
function Header({title,subtitle,action,back}) {
  return <header className="page-head"><div>{back&&<button className="back" onClick={back}>← Voltar</button>}<h1>{title}</h1>{subtitle&&<p className="muted">{subtitle}</p>}</div>{action}</header>
}

function Login() {
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  async function submit(e){
    e.preventDefault(); setLoading(true); setError('')
    const {error}=await supabase.auth.signInWithPassword({email,password})
    if(error) setError('E-mail ou senha inválidos.')
    setLoading(false)
  }
  return <main className="login-page"><section className="login-card">
    <div className="brand-mark">WS</div><div className="eyebrow">WHATS SENDER PRO</div>
    <h1>Painel administrativo</h1><p className="muted">Empresas, licenças, vencimentos e máquinas.</p>
    <form onSubmit={submit} className="stack-lg">
      <label><span>E-mail</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
      <label><span>Senha</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>
      {error&&<div className="alert error">{error}</div>}
      <button className="primary" disabled={loading}>{loading?'Entrando…':'Entrar'}</button>
    </form>
    <p className="login-foot">Acesso restrito à administração.</p>
  </section></main>
}

function Metric({label,value,helper}){return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div>{helper&&<div className="metric-helper">{helper}</div>}</div>}

function Dashboard({openCompany}) {
  const [data,setData]=useState(null), [error,setError]=useState('')
  async function load(){try{setError('');setData(await adminApi('dashboard'))}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[])
  if(error) return <div className="alert error">{error}<button onClick={load}>Tentar novamente</button></div>
  if(!data) return <Loading/>
  return <>
    <Header title="Visão geral" subtitle="Operação comercial e licenciamento."/>
    <div className="metrics-grid">
      <Metric label="Empresas" value={data.companies} helper={`${data.active_companies} ativas`}/>
      <Metric label="Bloqueadas" value={data.blocked_companies}/>
      <Metric label="Vencidas" value={data.expired_subscriptions}/>
      <Metric label="Receita contratada" value={money(data.mrr_cents)} helper="mensal atual"/>
      <Metric label="Recebido no mês" value={money(data.received_month_cents)}/>
    </div>
    <section className="panel">
      <div className="panel-head"><div><h2>Vencem nos próximos 7 dias</h2><p className="muted">Prioridade para cobrança.</p></div><button className="ghost" onClick={load}>Atualizar</button></div>
      {data.expiring_7_days?.length ? data.expiring_7_days.map(x=><button key={x.organization_id} className="list-row button-row" onClick={()=>openCompany(x.organization_id)}><div><strong>{x.company_name}</strong><span>Vence {dateBR(x.current_period_end)}</span></div><span className="days-pill">{Math.max(0,Math.ceil((new Date(x.current_period_end)-Date.now())/86400000))} dias</span></button>) : <Empty>Nenhum vencimento nos próximos 7 dias.</Empty>}
    </section>
  </>
}

function Companies({openCompany,newCompany}) {
  const [q,setQ]=useState(''), [rows,setRows]=useState(null), [error,setError]=useState('')
  async function load(search=q){try{setError('');setRows(await adminApi('companies.list',{q:search}))}catch(e){setError(e.message)}}
  useEffect(()=>{load('')},[])
  return <>
    <Header title="Empresas" subtitle="Clientes, assinaturas e máquinas." action={<button className="primary" onClick={newCompany}>+ Nova empresa</button>}/>
    <section className="panel">
      <form className="search-row" onSubmit={e=>{e.preventDefault();load()}}><input placeholder="Buscar por empresa ou CNPJ…" value={q} onChange={e=>setQ(e.target.value)}/><button className="secondary">Buscar</button></form>
      {error?<div className="alert error">{error}</div>:!rows?<Loading/>:rows.length===0?<Empty>Nenhuma empresa encontrada.</Empty>:
      <div className="table-wrap"><table><thead><tr><th>Empresa</th><th>Plano</th><th>Vencimento</th><th>Máquinas</th><th>Status</th><th></th></tr></thead><tbody>
      {rows.map(r=>{const end=r.subscription?.current_period_end, expired=end&&new Date(end)<new Date();return <tr key={r.id}>
        <td><strong>{r.trade_name||r.legal_name}</strong><small>{r.document_number||r.email||'—'}</small></td>
        <td>{r.plan?.name||'—'}</td><td className={expired?'danger-text':''}>{dateBR(end)}</td><td>{r.active_devices}</td>
        <td><Badge status={r.status==='suspended'?'suspended':expired?'expired':r.subscription?.status}/></td>
        <td className="align-right"><button className="link-button" onClick={()=>openCompany(r.id)}>Abrir</button></td>
      </tr>})}
      </tbody></table></div>}
    </section>
  </>
}

function NewCompany({done,cancel}) {
  const [f,setF]=useState({legal_name:'',trade_name:'',document_number:'',email:'',phone:'',plan_code:'pro',days:30,amount_reais:'199,00'})
  const [loading,setLoading]=useState(false), [lookupLoading,setLookupLoading]=useState(false)
  const [result,setResult]=useState(null), [lookupInfo,setLookupInfo]=useState(null), [error,setError]=useState('')
  const set=(k,v)=>setF(x=>({...x,[k]:v}))
  const friendlyError = code => ({
    invalid_cnpj:'CNPJ inválido. Confira os caracteres e o dígito verificador.',
    cnpj_not_found:'CNPJ não encontrado na base pública.',
    rate_limited:'A consulta gratuita atingiu o limite momentâneo. Aguarde um pouco e tente novamente.',
    provider_unavailable:'A consulta de CNPJ está temporariamente indisponível.',
  }[code] || code)

  async function searchCnpj(){
    setLookupLoading(true);setError('');setLookupInfo(null)
    try{
      const r=await lookupCnpj(f.document_number)
      setF(x=>({
        ...x,
        document_number:r.cnpj||x.document_number,
        legal_name:r.legal_name||x.legal_name,
        trade_name:r.trade_name||x.trade_name,
        email:r.email||x.email,
        phone:r.phone||x.phone,
      }))
      setLookupInfo(r)
    }catch(e){setError(friendlyError(e.message))}finally{setLookupLoading(false)}
  }

  async function submit(e){
    e.preventDefault();setLoading(true);setError('')
    const amount=Number(String(f.amount_reais).replace('.','').replace(',','.'))||0
    try{setResult(await createCompany({...f,days:Number(f.days),amount_cents:Math.round(amount*100),cnpj_lookup:lookupInfo}))}catch(e){setError(friendlyError(e.message))}finally{setLoading(false)}
  }
  if(result) return <><Header title="Empresa criada" subtitle="A chave completa aparece somente agora."/><section className="panel success-panel">
    <div className="success-icon">✓</div><h2>Cadastro concluído</h2>
    <div className="license-box"><code>{result.license_key}</code><button className="secondary" onClick={()=>navigator.clipboard.writeText(result.license_key)}>Copiar</button></div>
    <p>Validade: <strong>{dateBR(result.valid_until)}</strong></p>
    <div className="actions"><button className="primary" onClick={()=>done(result.organization_id)}>Abrir empresa</button></div>
  </section></>
  return <><Header title="Nova empresa" subtitle="Busque o CNPJ, revise os dados e gere a chave inicial."/><section className="panel form-panel"><form onSubmit={submit} className="form-grid">
    <label className="span-2"><span>CNPJ</span><div className="cnpj-row"><input placeholder="00.000.000/0001-91 ou 00.000.000/E08G-12" value={f.document_number} onChange={e=>set('document_number',e.target.value.toUpperCase())}/><button type="button" className="secondary" disabled={lookupLoading||!f.document_number.trim()} onClick={searchCnpj}>{lookupLoading?'Buscando…':'Buscar dados'}</button></div></label>
    {lookupInfo&&<div className="lookup-card span-2"><div><strong>Dados encontrados</strong><span>{lookupInfo.source} {lookupInfo.source_updated_at?`• atualizado ${dateBR(lookupInfo.source_updated_at)}`:''}</span></div><div className="lookup-meta"><span>Situação: <b>{lookupInfo.registration_status||'—'}</b></span><span>{[lookupInfo.city,lookupInfo.state].filter(Boolean).join(' / ')||'Local não informado'}</span><span>{lookupInfo.cnae_description||'CNAE não informado'}</span></div></div>}
    <label className="span-2"><span>Razão social *</span><input value={f.legal_name} onChange={e=>set('legal_name',e.target.value)} required/></label>
    <label><span>Nome fantasia</span><input value={f.trade_name} onChange={e=>set('trade_name',e.target.value)}/></label>
    <label><span>E-mail</span><input type="email" value={f.email} onChange={e=>set('email',e.target.value)}/></label>
    <label><span>Telefone</span><input value={f.phone} onChange={e=>set('phone',e.target.value)}/></label>
    <label><span>Plano</span><select value={f.plan_code} onChange={e=>set('plan_code',e.target.value)}><option value="pro">Pro</option><option value="trial">Trial</option></select></label>
    <label><span>Validade inicial</span><select value={f.days} onChange={e=>set('days',e.target.value)}><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="365">365 dias</option></select></label>
    <label><span>Valor recebido (R$)</span><input value={f.amount_reais} onChange={e=>set('amount_reais',e.target.value)}/></label>
    {error&&<div className="alert error span-2">{error}</div>}
    <div className="actions span-2"><button type="button" className="ghost" onClick={cancel}>Cancelar</button><button className="primary" disabled={loading}>{loading?'Criando…':'Criar empresa e gerar chave'}</button></div>
  </form></section></>
}

function Company({id,back}) {
  const [data,setData]=useState(null), [error,setError]=useState(''), [busy,setBusy]=useState(false), [newKey,setNewKey]=useState('')
  async function load(){try{setError('');setData(await adminApi('companies.get',{organization_id:id}))}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[id])
  if(error)return <div className="alert error">{error}</div>
  if(!data)return <Loading/>
  const {organization:o,subscription:s,plan,license,devices,payments}=data
  const blocked=o.status==='suspended'

  async function doBlock(value){
    const reason=value?prompt('Motivo do bloqueio:','Pagamento pendente'):'Regularizado'; if(value&&reason===null)return
    setBusy(true);try{await adminApi('companies.set_blocked',{organization_id:id,blocked:value,reason});await load()}catch(e){alert(e.message)}finally{setBusy(false)}
  }
  async function renew(days){
    const v=prompt(`Valor recebido para +${days} dias (R$):`,'199,00'); if(v===null)return
    const amount=Number(String(v).replace('.','').replace(',','.'))||0
    setBusy(true);try{await adminApi('companies.renew',{organization_id:id,days,amount_cents:Math.round(amount*100),method:'pix',notes:`Renovação manual +${days} dias`});await load()}catch(e){alert(e.message)}finally{setBusy(false)}
  }
  async function revoke(d){
    if(!confirm(`Desvincular ${d.hostname||'este computador'}?`))return
    setBusy(true);try{await adminApi('devices.revoke',{organization_id:id,device_id:d.id,reason:'Desvinculado pelo painel'});await load()}catch(e){alert(e.message)}finally{setBusy(false)}
  }
  async function rotate(){
    if(!confirm('Gerar nova chave? A anterior deixará de ativar novos computadores.'))return
    setBusy(true);try{const r=await adminApi('licenses.rotate_key',{organization_id:id});setNewKey(r.license_key);await load()}catch(e){alert(e.message)}finally{setBusy(false)}
  }

  return <>
    <Header title={o.trade_name||o.legal_name} subtitle={o.document_number||o.legal_name} back={back} action={blocked?<button className="primary" disabled={busy} onClick={()=>doBlock(false)}>Desbloquear</button>:<button className="danger-button" disabled={busy} onClick={()=>doBlock(true)}>Bloquear empresa</button>}/>
    <div className="company-grid">
      <section className="panel"><h2>Assinatura</h2><div className="detail-grid">
        <div className="detail"><span>Status</span><strong><Badge status={blocked?'suspended':s?.status}/></strong></div>
        <div className="detail"><span>Plano</span><strong>{plan?.name||'—'}</strong></div>
        <div className="detail"><span>Vencimento</span><strong>{dateBR(s?.current_period_end)}</strong></div>
        <div className="detail"><span>Valor</span><strong>{money(s?.amount_cents)}</strong></div>
      </div><div className="actions"><button className="secondary" onClick={()=>renew(30)}>+30 dias</button><button className="secondary" onClick={()=>renew(90)}>+90 dias</button><button className="secondary" onClick={()=>renew(365)}>+365 dias</button></div></section>

      <section className="panel"><h2>Licença</h2><div className="detail-grid">
        <div className="detail"><span>Chave</span><strong>{license?.key_prefix?`${license.key_prefix}…`:'—'}</strong></div>
        <div className="detail"><span>Status</span><strong><Badge status={license?.status}/></strong></div>
        <div className="detail"><span>Máquinas ativas</span><strong>{devices.filter(d=>d.status==='active').length}</strong></div>
        <div className="detail"><span>Limite</span><strong>{plan?.max_devices==null?'Ilimitado':plan.max_devices}</strong></div>
      </div><button className="ghost" onClick={rotate}>Gerar nova chave</button>
      {newKey&&<div className="new-key"><strong>Nova chave — copie agora</strong><code>{newKey}</code><button className="secondary" onClick={()=>navigator.clipboard.writeText(newKey)}>Copiar</button></div>}</section>
    </div>

    <section className="panel"><h2>Máquinas</h2>{devices.length?<div className="table-wrap"><table><thead><tr><th>Computador</th><th>Sistema</th><th>Versão</th><th>Último acesso</th><th>Status</th><th></th></tr></thead><tbody>
      {devices.map(d=><tr key={d.id}><td><strong>{d.nickname||d.hostname||'Computador'}</strong></td><td>{[d.os_name,d.os_version].filter(Boolean).join(' ')||'—'}</td><td>{d.app_version||'—'}</td><td>{dateTimeBR(d.last_seen_at)}</td><td><Badge status={d.status}/></td><td className="align-right">{d.status==='active'&&<button className="link-button danger-text" onClick={()=>revoke(d)}>Desvincular</button>}</td></tr>)}
    </tbody></table></div>:<Empty>Nenhuma máquina ativada.</Empty>}</section>

    <section className="panel"><h2>Pagamentos</h2>{payments.length?<div className="table-wrap"><table><thead><tr><th>Data</th><th>Método</th><th>Valor</th><th>Status</th><th>Observação</th></tr></thead><tbody>
      {payments.map(p=><tr key={p.id}><td>{dateBR(p.paid_at||p.created_at)}</td><td>{String(p.method||p.provider||'—').toUpperCase()}</td><td>{money(p.amount_cents)}</td><td><Badge status={p.status==='paid'?'active':p.status}/></td><td>{p.notes||'—'}</td></tr>)}
    </tbody></table></div>:<Empty>Nenhum pagamento registrado.</Empty>}</section>
  </>
}

const ROLE_LABELS={owner:'Owner',admin:'Administrador',support:'Suporte',finance:'Financeiro',read_only:'Somente leitura'}

function Administrators(){
  const [rows,setRows]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState('')
  const [invite,setInvite]=useState({name:'',email:'',role:'admin'}),[sending,setSending]=useState(false)
  async function load(){try{setError('');setRows(await adminManagement('list'))}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[])
  async function sendInvite(e){
    e.preventDefault();setSending(true);setError('');setMessage('')
    try{
      await adminManagement('invite',{...invite,redirect_to:window.location.origin})
      setInvite({name:'',email:'',role:'admin'});setMessage('Convite enviado por e-mail.');await load()
    }catch(e){setError(e.message==='admin_already_exists'?'Esse e-mail já possui acesso administrativo.':e.message)}finally{setSending(false)}
  }
  async function save(row,patch){
    try{setError('');await adminManagement('update',{user_id:row.user_id,name:patch.name??row.name,role:patch.role??row.role,active:patch.active??row.active});await load()}catch(e){setError(e.message)}
  }
  return <><Header title="Administradores" subtitle="Convide sua equipe e controle exatamente o que cada pessoa pode fazer."/>
    <div className="admin-layout">
      <section className="panel"><h2>Convidar administrador</h2><p className="muted small-text">A pessoa receberá um e-mail para acessar o painel com a própria conta.</p>
        <form className="stack-lg compact" onSubmit={sendInvite}>
          <label><span>Nome</span><input value={invite.name} onChange={e=>setInvite(x=>({...x,name:e.target.value}))} required/></label>
          <label><span>E-mail</span><input type="email" value={invite.email} onChange={e=>setInvite(x=>({...x,email:e.target.value}))} required/></label>
          <label><span>Permissão</span><select value={invite.role} onChange={e=>setInvite(x=>({...x,role:e.target.value}))}><option value="admin">Administrador</option><option value="support">Suporte</option><option value="finance">Financeiro</option><option value="read_only">Somente leitura</option></select></label>
          <button className="primary" disabled={sending}>{sending?'Enviando…':'Enviar convite'}</button>
        </form>
        {message&&<div className="alert success">{message}</div>}{error&&<div className="alert error">{error}</div>}
      </section>
      <section className="panel permission-help"><h2>Perfis de acesso</h2>
        <div className="role-help"><strong>Administrador</strong><span>Clientes, licenças, máquinas, renovações e bloqueios.</span></div>
        <div className="role-help"><strong>Financeiro</strong><span>Clientes, pagamentos e renovações.</span></div>
        <div className="role-help"><strong>Suporte</strong><span>Consulta, bloqueio/desbloqueio e máquinas.</span></div>
        <div className="role-help"><strong>Somente leitura</strong><span>Pode consultar, sem alterar dados.</span></div>
      </section>
    </div>
    <section className="panel"><div className="panel-head"><div><h2>Equipe administrativa</h2><p className="muted">O Owner não pode ser removido por esta tela.</p></div><button className="ghost" onClick={load}>Atualizar</button></div>
      {!rows?<Loading/>:<div className="table-wrap"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Último acesso</th><th>Status</th><th></th></tr></thead><tbody>
        {rows.map(r=><tr key={r.user_id}><td><strong>{r.name||'—'}</strong></td><td>{r.email||'—'}</td><td>{r.role==='owner'?<strong>Owner</strong>:<select className="table-select" value={r.role} onChange={e=>save(r,{role:e.target.value})}><option value="admin">Administrador</option><option value="support">Suporte</option><option value="finance">Financeiro</option><option value="read_only">Somente leitura</option></select>}</td><td>{dateTimeBR(r.last_sign_in_at)}</td><td><Badge status={r.active?'active':'revoked'}/></td><td className="align-right">{r.role!=='owner'&&<button className={`link-button ${r.active?'danger-text':''}`} onClick={()=>save(r,{active:!r.active})}>{r.active?'Desativar':'Reativar'}</button>}</td></tr>)}
      </tbody></table></div>}
    </section>
  </>
}

function SetPassword({done}){
  const [password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false)
  async function submit(e){e.preventDefault();if(password.length<8){setError('Use pelo menos 8 caracteres.');return}if(password!==confirmPassword){setError('As senhas não são iguais.');return}setLoading(true);const {error}=await supabase.auth.updateUser({password});setLoading(false);if(error){setError(error.message);return}history.replaceState({},document.title,location.pathname);done()}
  return <main className="login-page"><section className="login-card"><div className="brand-mark">WS</div><div className="eyebrow">CONVITE ACEITO</div><h1>Crie sua senha</h1><p className="muted">Defina a senha que você usará nos próximos acessos.</p><form className="stack-lg" onSubmit={submit}><label><span>Nova senha</span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><label><span>Confirmar senha</span><input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/></label>{error&&<div className="alert error">{error}</div>}<button className="primary" disabled={loading}>{loading?'Salvando…':'Salvar senha e entrar'}</button></form></section></main>
}

function Admin({session}) {
  const [view,setView]=useState({type:'dashboard'}),[me,setMe]=useState(null)
  useEffect(()=>{adminManagement('me').then(setMe).catch(()=>setMe({role:'read_only'}))},[])
  const openCompany=id=>setView({type:'company',id})
  let content
  if(view.type==='dashboard')content=<Dashboard openCompany={openCompany}/>
  if(view.type==='companies')content=<Companies openCompany={openCompany} newCompany={()=>setView({type:'new'})}/>
  if(view.type==='new')content=<NewCompany cancel={()=>setView({type:'companies'})} done={openCompany}/>
  if(view.type==='company')content=<Company id={view.id} back={()=>setView({type:'companies'})}/>
  if(view.type==='admins')content=<Administrators/>
  return <div className="app-shell"><aside className="sidebar">
    <div className="brand"><div className="brand-mark small">WS</div><div><strong>Whats Sender</strong><span>Admin</span></div></div>
    <nav><button className={view.type==='dashboard'?'active':''} onClick={()=>setView({type:'dashboard'})}>▦ Visão geral</button><button className={['companies','company'].includes(view.type)?'active':''} onClick={()=>setView({type:'companies'})}>▤ Empresas</button><button className={view.type==='new'?'active':''} onClick={()=>setView({type:'new'})}>＋ Nova empresa</button>{me?.role==='owner'&&<button className={view.type==='admins'?'active':''} onClick={()=>setView({type:'admins'})}>♙ Administradores</button>}</nav>
    <div className="sidebar-foot"><div className="user-role">{ROLE_LABELS[me?.role]||'Carregando…'}</div><div className="user-email">{session.user.email}</div><button onClick={()=>supabase.auth.signOut()}>Sair</button></div>
  </aside><main className="content">{content}</main></div>
}

function App(){
  const [session,setSession]=useState(undefined),[inviteFlow,setInviteFlow]=useState(()=>window.location.hash.includes('type=invite')||window.location.search.includes('type=invite'))
  useEffect(()=>{supabase.auth.getSession().then(({data})=>setSession(data.session));const {data}=supabase.auth.onAuthStateChange((_e,s)=>setSession(s));return()=>data.subscription.unsubscribe()},[])
  if(session===undefined)return <Loading/>
  if(session&&inviteFlow)return <SetPassword done={()=>setInviteFlow(false)}/>
  return session?<Admin session={session}/>:<Login/>
}

createRoot(document.getElementById('root')).render(<App/>)
