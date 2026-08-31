const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const labels={received:'Novo pedido',accepted:'Pedido aceito',separating:'Pedido em separação',waiting_payment:'Pedido esperando pagamento',ready_pickup:'Pedido pronto para retirada',paid:'Pago',completed:'Pedido finalizado',cancelled:'Cancelado'};
const classes={received:'status-new',accepted:'status-ready',separating:'status-ready',waiting_payment:'status-ready',ready_pickup:'status-paid',paid:'status-paid',completed:'status-done',cancelled:'status-cancelled'};
async function init(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){$('ordersApp').innerHTML='<div class="panel orders-login"><h2>📦 Meus pedidos</h2><p>Entre na sua conta para acompanhar seus pedidos.</p><a class="primary" href="login.html">Entrar na minha conta</a></div>';return;}
  await loadOrders(session.user.id);
  setInterval(()=>loadOrders(session.user.id,true),15000);
}
function orderCard(o){
  const items=Array.isArray(o.items)?o.items:[];
  const canCancel=['received','accepted','separating'].includes(o.status);
  return `<article class="my-order-card"><div class="my-order-head"><div><strong>Pedido #${o.order_number}</strong><small>${new Date(o.created_at).toLocaleString('pt-BR')}</small></div><span class="status ${classes[o.status]||''}">${labels[o.status]||o.status}</span></div><div class="my-order-body"><div class="my-order-items">${items.map(i=>`<div class="my-order-item">${i.image_url?`<img src="${esc(i.image_url)}" alt="">`:''}<span>${esc(i.name)} × ${i.qty}</span><b>${money(i.subtotal)}</b></div>`).join('')}<div class="my-order-total"><span>Total</span><b>${money(o.total)}</b></div></div><div class="my-order-info"><p><b>Status atual</b><br>${statusMessage(o.status)}</p>${o.note?`<p><b>Observação</b><br>${esc(o.note)}</p>`:''}${o.delivery_method?`<p><b>Forma de recebimento</b><br>${o.delivery_method==='delivery'?'🚚 Entrega':o.delivery_method==='store'?'🏪 Retirada em loja':'🚗 Retirada por aplicativo (Uber)'}</p>`:''}</div></div><div class="my-order-actions">${['received','accepted','separating','waiting_payment','ready_pickup','paid'].includes(o.status)?`<button class="order-chat-btn" type="button" onclick="openOrderChat('${o.id}',${o.order_number},'${esc(o.customer_name||'')}',false)">💬 Falar sobre este pedido</button>`:''}${canCancel?`<button class="danger" onclick="cancelMyOrder('${o.id}')">✕ Cancelar pedido</button>`:''}${o.status==='ready_payment'?'<span class="order-hint">A MacroFood irá chamar você pelo WhatsApp para concluir o pagamento.</span>':''}${o.status==='paid'?'<span class="order-hint">Pagamento recebido. A equipe está preparando seu pedido.</span>':''}${o.status==='completed'?'<span class="order-hint">Pedido concluído. Obrigado pela preferência!</span>':''}${o.status==='cancelled'?'<span class="order-hint">Este pedido foi cancelado.</span>':''}</div></article>`;
}
function statusMessage(s){if(s==='received')return 'Recebemos seu pedido e a equipe está conferindo os itens.';if(s==='accepted')return 'Seu pedido foi aceito pela MacroFood.';if(s==='separating')return 'Seu pedido está em separação. A equipe pode ajustar os pesos dos produtos vendidos por kg.';if(s==='waiting_payment')return 'Seu pedido foi conferido e está esperando pagamento.';if(s==='ready_pickup')return 'Seu pedido está pronto para retirada/recebimento.';if(s==='paid')return 'Pagamento confirmado e pedido em preparação.';if(s==='completed')return 'Seu pedido foi finalizado.';return 'O pedido foi cancelado.';}
async function loadOrders(uid,silent=false){
  const {data,error}=await client.from('orders').select('*').eq('user_id',uid).order('created_at',{ascending:false});
  if(error){if(!silent)$('ordersApp').innerHTML=`<div class="panel"><h2>Meus pedidos</h2><p class="notice">Não foi possível carregar seus pedidos: ${esc(error.message)}</p></div>`;return;}
  const orders=data||[];
  $('ordersApp').innerHTML=`<div class="orders-page-head"><div><h2>📦 Meus pedidos</h2><p>Acompanhe seus pedidos e cancele enquanto eles ainda não foram finalizados.</p></div><a class="secondary" href="index.html">Continuar comprando</a></div>${orders.length?`<div class="my-orders-list">${orders.map(orderCard).join('')}</div>`:'<div class="panel empty-state"><h3>Você ainda não fez nenhum pedido.</h3><p>Escolha seus produtos no catálogo e faça seu primeiro pedido.</p><a class="primary" href="index.html">Ver produtos</a></div>'}`;
}
async function cancelMyOrder(id){
  if(!confirm('Deseja realmente cancelar este pedido?'))return;
  const {data,error}=await client.rpc('cancel_my_order',{target_order_id:id});
  if(error)return alert('Não foi possível cancelar o pedido: '+error.message);
  if(data===false)return alert('Este pedido não pode mais ser cancelado.');
  const {data:{session}}=await client.auth.getSession();
  if(session)loadOrders(session.user.id);
}
init();


// Chat exclusivo de cada pedido. Fica disponível somente enquanto o pedido estiver ativo.
let orderChatTimer=null;
let activeOrderChat=null;
function closeOrderChat(){
  if(orderChatTimer){clearInterval(orderChatTimer);orderChatTimer=null;}
  activeOrderChat=null;
  document.getElementById('orderChatModal')?.remove();
}
async function openOrderChat(orderId,orderNumber,customerName,isAdmin=false){
  if(activeOrderChat===orderId){return;}
  closeOrderChat(); activeOrderChat=orderId;
  const modal=document.createElement('div'); modal.id='orderChatModal'; modal.className='order-chat-modal';
  modal.innerHTML=`<div class="order-chat-box"><button class="order-chat-close" type="button" onclick="closeOrderChat()">×</button><div class="order-chat-head"><div><h2>💬 Pedido #${orderNumber}</h2><p>${esc(customerName||'Cliente')} • conversa do pedido</p></div><span>Atendimento</span></div><div id="orderChatMessages" class="order-chat-messages"><div class="support-empty">Carregando conversa...</div></div><form id="orderChatForm" class="order-chat-compose"><textarea id="orderChatText" maxlength="1000" placeholder="Digite uma mensagem sobre este pedido..." required></textarea><button class="primary" type="submit">Enviar</button></form></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeOrderChat()});
  const form=document.getElementById('orderChatForm');
  form.onsubmit=async e=>{
    e.preventDefault(); const input=document.getElementById('orderChatText'), text=input.value.trim(); if(!text)return;
    const {data:{session}}=await client.auth.getSession(); if(!session)return alert('Entre na sua conta para enviar mensagens.');
    const payload={order_id:orderId,user_id:isAdmin ? (await getOrderUserId(orderId)) : session.user.id,sender_role:isAdmin?'admin':'user',message:text};
    if(!payload.user_id)return alert('Não foi possível identificar o cliente deste pedido.');
    const {error}=await client.from('order_chat_messages').insert(payload);
    if(error)return alert('Não foi possível enviar a mensagem: '+error.message);
    input.value=''; await loadOrderChatMessages(orderId);
  };
  await loadOrderChatMessages(orderId);
  orderChatTimer=setInterval(()=>loadOrderChatMessages(orderId),4000);
  setTimeout(()=>document.getElementById('orderChatText')?.focus(),100);
}
async function getOrderUserId(orderId){
  const {data}=await client.from('orders').select('user_id').eq('id',orderId).maybeSingle();
  return data?.user_id||null;
}
async function loadOrderChatMessages(orderId){
  const el=document.getElementById('orderChatMessages'); if(!el||activeOrderChat!==orderId)return;
  const {data,error}=await client.from('order_chat_messages').select('id,user_id,sender_role,message,created_at').eq('order_id',orderId).order('created_at',{ascending:true});
  if(error){el.innerHTML='<div class="support-empty">Não foi possível carregar o chat: '+esc(error.message)+'</div>';return;}
  const wasNear=el.scrollHeight-el.scrollTop-el.clientHeight<90;
  el.innerHTML=(data||[]).length?(data||[]).map(m=>`<div class="order-chat-msg ${m.sender_role==='admin'?'admin':'user'}"><div>${esc(m.message).replace(/\n/g,'<br>')}</div><small>${m.sender_role==='admin'?'Administrador':'Você'} • ${new Date(m.created_at).toLocaleString('pt-BR')}</small></div>`).join(''):'<div class="support-empty">Nenhuma mensagem ainda. 👋<br>Use este chat para falar sobre este pedido enquanto ele está sendo separado.</div>';
  if(wasNear)el.scrollTop=el.scrollHeight;
}
