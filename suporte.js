const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);const $=id=>document.getElementById(id);let userId=null;let timer=null;let conversationResolved=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
async function init(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){$('supportApp').innerHTML='<div class="support-shell support-empty"><h2>💬 Suporte ao cliente</h2><p>Entre na sua conta para conversar com a MacroFood.</p><a class="primary" href="login.html">Entrar na minha conta</a></div>';return}
  userId=session.user.id;render();await loadConversation();await loadMessages();timer=setInterval(async()=>{await loadConversation();await loadMessages()},5000)
}
async function loadConversation(){
  const {data,error}=await client.from('support_conversations').select('status,resolved_at').eq('user_id',userId).maybeSingle();
  if(!error) conversationResolved=data?.status==='resolved';
  updateResolvedUI();
}
function render(){
  $('supportApp').innerHTML=`<div class="support-shell"><div class="support-head"><div><h2>💬 Suporte ao cliente</h2><p>Fale diretamente com a equipe da MacroFood. Envie sua dúvida e aguarde a resposta.</p></div><span id="supportStatus" class="support-status"></span></div><div id="messages" class="support-messages"><div class="support-empty">Carregando conversa...</div></div><form id="chatForm" class="support-compose"><textarea id="chatText" maxlength="1000" placeholder="Digite sua mensagem..." required></textarea><button class="primary" type="submit">Enviar</button></form><div id="resolvedBox"></div></div><p style="text-align:center;margin-top:15px"><a href="login.html">← Voltar para minha conta</a></p>`;
  $('chatForm').onsubmit=send;updateResolvedUI();
}
function updateResolvedUI(){
  const form=$('chatForm'),status=$('supportStatus'),box=$('resolvedBox');
  if(status){status.textContent=conversationResolved?'✓ Problema resolvido':'● Atendimento em andamento';status.className='support-status '+(conversationResolved?'resolved':'open')}
  if(form){form.style.display=conversationResolved?'none':'flex'}
  if(box){box.innerHTML=conversationResolved?'<div class="resolved-banner">✅ <div><b>Problema resolvido</b><small>Esta conversa foi finalizada pelo administrador. Se precisar de ajuda novamente, envie uma nova mensagem para reabrir o atendimento.</small></div><button class="secondary" type="button" onclick="reopenSupport()">Reabrir suporte</button></div>':''}
}
async function loadMessages(){
  const {data,error}=await client.from('support_messages').select('id,user_id,sender_role,message,created_at').eq('user_id',userId).order('created_at',{ascending:true});
  if(error){$('messages').innerHTML='<div class="support-empty">Não foi possível carregar o chat: '+esc(error.message)+'</div>';return}
  const rows=data||[],el=$('messages');const wasNearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<80;const input=$('chatText');const draft=input?.value||'';
  el.innerHTML=rows.length?rows.map(m=>`<div class="support-msg ${m.sender_role==='admin'?'admin':'user'}">${esc(m.message).replace(/\n/g,'<br>')}<small>${m.sender_role==='admin'?'MacroFood':'Você'} • ${new Date(m.created_at).toLocaleString('pt-BR')}</small></div>`).join(''):'<div class="support-empty">Olá! 👋 Envie sua primeira mensagem para falar com a MacroFood.</div>';
  if(input&&document.activeElement!==input)input.value=draft;if(wasNearBottom||rows.length===0)el.scrollTop=el.scrollHeight;
}
async function send(e){
  e.preventDefault();const input=$('chatText'),text=input.value.trim();if(!text)return;
  if(conversationResolved){await reopenSupport()}
  const {error}=await client.from('support_conversations').upsert({user_id:userId,status:'open',resolved_at:null,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)return alert('Não foi possível abrir o atendimento: '+error.message);
  conversationResolved=false;updateResolvedUI();
  const {error:sendError}=await client.from('support_messages').insert({user_id:userId,sender_role:'user',message:text});
  if(sendError)return alert('Não foi possível enviar: '+sendError.message);input.value='';loadMessages();
}
async function reopenSupport(){
  const {error}=await client.from('support_conversations').upsert({user_id:userId,status:'open',resolved_at:null,updated_at:new Date().toISOString()},{onConflict:'user_id'});
  if(error)return alert(error.message);conversationResolved=false;updateResolvedUI();
}
init();
