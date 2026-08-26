const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const labels={received:'Novo pedido',ready_payment:'Pronto para pagar',paid:'Pago',completed:'Finalizado',cancelled:'Cancelado'};
const classes={received:'status-new',ready_payment:'status-ready',paid:'status-paid',completed:'status-done',cancelled:'status-cancelled'};
async function init(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){$('ordersApp').innerHTML='<div class="panel orders-login"><h2>📦 Meus pedidos</h2><p>Entre na sua conta para acompanhar seus pedidos.</p><a class="primary" href="login.html">Entrar na minha conta</a></div>';return;}
  await loadOrders(session.user.id);
  setInterval(()=>loadOrders(session.user.id,true),15000);
}
function orderCard(o){
  const items=Array.isArray(o.items)?o.items:[];
  const canCancel=['received','ready_payment','paid'].includes(o.status);
  return `<article class="my-order-card"><div class="my-order-head"><div><strong>Pedido #${o.order_number}</strong><small>${new Date(o.created_at).toLocaleString('pt-BR')}</small></div><span class="status ${classes[o.status]||''}">${labels[o.status]||o.status}</span></div><div class="my-order-body"><div class="my-order-items">${items.map(i=>`<div class="my-order-item">${i.image_url?`<img src="${esc(i.image_url)}" alt="">`:''}<span>${esc(i.name)} × ${i.qty}</span><b>${money(i.subtotal)}</b></div>`).join('')}<div class="my-order-total"><span>Total</span><b>${money(o.total)}</b></div></div><div class="my-order-info"><p><b>Status atual</b><br>${statusMessage(o.status)}</p>${o.note?`<p><b>Observação</b><br>${esc(o.note)}</p>`:''}</div></div><div class="my-order-actions">${canCancel?`<button class="danger" onclick="cancelMyOrder('${o.id}')">✕ Cancelar pedido</button>`:''}${o.status==='ready_payment'?'<span class="order-hint">A MacroFood irá chamar você pelo WhatsApp para concluir o pagamento.</span>':''}${o.status==='paid'?'<span class="order-hint">Pagamento recebido. A equipe está preparando seu pedido.</span>':''}${o.status==='completed'?'<span class="order-hint">Pedido concluído. Obrigado pela preferência!</span>':''}${o.status==='cancelled'?'<span class="order-hint">Este pedido foi cancelado.</span>':''}</div></article>`;
}
function statusMessage(s){if(s==='received')return 'Recebemos seu pedido e a equipe está conferindo os itens.';if(s==='ready_payment')return 'Seu pedido foi conferido e está pronto para pagamento.';if(s==='paid')return 'Pagamento confirmado e pedido em preparação.';if(s==='completed')return 'Seu pedido foi finalizado.';return 'O pedido foi cancelado.';}
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
