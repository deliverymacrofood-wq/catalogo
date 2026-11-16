/* Motor de temas sazonais globais Macrofood */
(function(){
 const KEY='macrofood_campaign_theme',allowed=['black-friday','christmas','new-year','carnival','easter','summer'];
 function inPeriod(c){const n=Date.now(),s=c.startAt?new Date(c.startAt).getTime():NaN,e=c.endAt?new Date(c.endAt).getTime():NaN;return (!Number.isFinite(s)||n>=s)&&(!Number.isFinite(e)||n<=e)}
 function apply(c,preview){
  const active=!!preview||!!(c&&c.active&&allowed.includes(c.theme)&&inPeriod(c)),t=active?(preview||c.theme):'';
  if(!document.body)return;
  if(t)document.body.setAttribute('data-campaign-theme',t);else document.body.removeAttribute('data-campaign-theme');
  document.querySelector('.campaign-effects')?.remove();
  if(active&&c?.effects&&['christmas','new-year','carnival'].includes(t)){const el=document.createElement('div');el.className='campaign-effects '+t+'-effects';el.setAttribute('aria-hidden','true');document.body.appendChild(el)}
  const colors={'black-friday':'#171717',christmas:'#176b3a','new-year':'#171717',carnival:'#7026a8',easter:'#9a5a8b',summer:'#e66b16'};
  const meta=document.querySelector('meta[name="theme-color"]');if(meta&&t)meta.content=colors[t]||'#f36b12';
  document.title=t?'MacroFood — '+({'black-friday':'Black Friday',christmas:'Natal','new-year':'Ano Novo',carnival:'Carnaval',easter:'Páscoa',summer:'Verão'}[t]||'Catálogo'):'MacroFood — Catálogo';
 }
 async function refresh(){try{if(!window.supabase)return;const db=window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);const {data,error}=await db.from('site_settings').select('value').eq('key',KEY).maybeSingle();if(error)throw error;apply(data?.value?JSON.parse(data.value):null,false)}catch(e){console.warn('Tema de campanha indisponível:',e.message||e)}}
 function start(){const p=new URLSearchParams(location.search).get('previewTheme');if(allowed.includes(p)){apply({active:true,theme:p,effects:true},p);return}refresh();setInterval(refresh,60000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()})}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.MacrofoodCampaignThemes={refresh,apply};
})();