const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const sectors=['Todos','Promoções','Chocolates','Confeitaria','Sorveteria','Padaria','Restaurante','Ocidental','Frios','Congelados'];
let active='Todos',products=[],reviews=[],banners=[],bannerTimer=null,cart=JSON.parse(localStorage.getItem('macrofood_cart')||'[]');
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const $=id=>document.getElementById(id);


async function loadAccountHeader(){
  const el=document.querySelector('.admin');
  if(!el)return;
  try{
    const {data:{session}}=await client.auth.getSession();
    if(!session){
      el.innerHTML='👤 Minha conta';
      el.href='login.html';
      return;
    }

    let nickname=session.user.user_metadata?.nickname?.trim()||'';
    let avatarUrl='';
    try{
      const {data:profile}=await client.from('profiles').select('nickname,avatar_url').eq('id',session.user.id).maybeSingle();
      if(profile?.nickname?.trim()) nickname=profile.nickname.trim();
      avatarUrl=profile?.avatar_url||'';
    }catch(_){}

    // Após o login, substitui o botão "Minha conta" pela foto + apelido do cliente.
    el.innerHTML=`${avatarUrl?`<img class="mini-avatar" src="${esc(avatarUrl)}" alt="Foto de ${esc(nickname||'cliente')}" onerror="this.style.display='none'">`:''}<span class="account-nickname">${esc(nickname||'Minha conta')}</span>`;
    el.href='login.html';
    el.title='Abrir minha conta';
    el.setAttribute('aria-label','Abrir minha conta');
  }catch(e){
    el.innerHTML='👤 Minha conta';
    el.href='login.html';
  }
}

function renderBanners(){
  const el=$('bannerArea'); if(!el)return;
  clearInterval(bannerTimer);
  if(!banners.length){el.innerHTML='';el.className='banner-area hidden';return}
  el.className='banner-area';
  el.innerHTML=`<div class="banner-track">${banners.map((b,i)=>`<div class="site-banner ${i===0?'active':''}" data-banner="${i}"><img src="${esc(b.image_url)}" alt="Banner ${i+1}"></div>`).join('')}</div>${banners.length>1?`<button class="banner-arrow prev" onclick="moveBanner(-1)">‹</button><button class="banner-arrow next" onclick="moveBanner(1)">›</button><div class="banner-dots">${banners.map((_,i)=>`<button class="banner-dot ${i===0?'active':''}" onclick="showBanner(${i})"></button>`).join('')}</div>`:''}`;
  window.currentBanner=0;
  if(banners.length>1)bannerTimer=setInterval(()=>moveBanner(1),5000);
}
function showBanner(i){
  if(!banners.length)return;
  window.currentBanner=(i+banners.length)%banners.length;
  document.querySelectorAll('.site-banner').forEach((x,n)=>x.classList.toggle('active',n===window.currentBanner));
  document.querySelectorAll('.banner-dot').forEach((x,n)=>x.classList.toggle('active',n===window.currentBanner));
}
function moveBanner(step){showBanner((window.currentBanner||0)+step)}

function renderCats(){
  $('cats').innerHTML=sectors.map(s=>`<button class="cat ${s===active?'active':''}" onclick="active='${s}';render()">${s==='Promoções'?'🔥 ':''}${s}</button>`).join('');
}
async function load(){
  const grid=$('grid');
  if(grid) grid.innerHTML='<div class="notice">Carregando produtos...</div>';
  try {
  // O catálogo deve continuar funcionando mesmo se uma tabela opcional
  // (avaliações/banners) ainda não tiver sido criada no Supabase.
  const productsReq=client.from('products').select('*').order('name');
  const reviewsReq=client.from('product_reviews').select('product_id,rating,user_id');
  const bannersReq=client.from('site_banners').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true});
  const [{data,error},{data:rv,error:rvErr},{data:bn,error:bnErr}]=await Promise.all([productsReq,reviewsReq,bannersReq]);

  if(error){
    $('grid').innerHTML=`<div class="notice"><b>Não foi possível carregar os produtos.</b><br>${esc(error.message)}<br><small>Confira se a tabela products existe e se a política de leitura pública foi criada no Supabase.</small></div>`;
    return;
  }

  // Compatibilidade com versões antigas: se a coluna active existir,
  // somente produtos ativos são mostrados. Se não existir, todos são exibidos.
  products=(data||[]).filter(p=>p.active===undefined || p.active===null || p.active===true);
  reviews=rvErr?[]:(rv||[]);
  banners=bnErr?[]:(bn||[]).filter(b=>b.active===undefined || b.active===null || b.active===true);
  renderBanners();
  render();
  loadAccountHeader();
  } catch (e) {
    if(grid) grid.innerHTML=`<div class="notice"><b>Não foi possível carregar o catálogo.</b><br>${esc(e?.message||e)}<br><small>Verifique a conexão com o Supabase e as permissões da tabela products.</small></div>`;
    console.error('Erro ao carregar catálogo:',e);
  }
}
function reviewInfo(p){
  const rs=reviews.filter(r=>r.product_id===p.id);
  const avg=rs.length?rs.reduce((s,r)=>s+Number(r.rating),0)/rs.length:0;
  return {avg,count:rs.length};
}
function stars(p){
  const r=reviewInfo(p);
  return `<div class="stars" title="Avaliação média">${r.avg?`★ ${r.avg.toFixed(1)}`:'☆ Sem avaliações'} <small>(${r.count})</small></div>`;
}
function priceHtml(p){
  if(p.promo_price!=null && Number(p.promo_price)<Number(p.price)){
    return `<div class="price-box"><div class="oldprice">De: <s>${money(p.price)}</s></div><div class="price promo">Por: ${money(p.promo_price)}</div><span class="offer">🔥 PROMOÇÃO</span></div>`;
  }
  return `<div class="price-box"><div class="price">Por: ${money(p.price)}</div></div>`;
}
function render(){
  renderCats();
  $('cartCount').textContent=cart.reduce((n,x)=>n+x.qty,0);
  let q=$('search').value.toLowerCase().trim();
  let list=products.filter(p=>{
    const categoryOk=active==='Todos'||(active==='Promoções'?p.promo_price!=null&&Number(p.promo_price)<Number(p.price):p.sector===active);
    return categoryOk&&(!q||p.name.toLowerCase().includes(q)||p.sector.toLowerCase().includes(q));
  });
  $('grid').innerHTML=list.length?list.map(p=>`<article class="card">
    <div class="pic">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'📦'}</div>
    <div class="info">
      <div class="sector">${esc(p.sector)}</div>
      <div class="name">${esc(p.name)}</div>
      ${p.product_code?`<div class="code">Código: ${esc(p.product_code)}</div>`:''}
      ${priceHtml(p)}
      ${stars(p)}
      <div class="card-actions">
        <button class="primary" onclick="addCart('${p.id}')" ${p.in_stock===false?'disabled':''}>${p.in_stock===false?'Sem estoque':'🛒 Adicionar'}</button>
        <button class="rate-btn" onclick="openRating('${p.id}')">⭐ Avaliar</button>
      </div>
    </div>
  </article>`).join(''):'<div style="grid-column:1/-1;text-align:center;padding:40px;color:#777">Nenhum produto encontrado.</div>';
}
function addCart(id){
  const p=products.find(x=>x.id===id);if(!p||p.in_stock===false)return;
  const x=cart.find(x=>x.id===id);
  if(x)x.qty++;else cart.push({id:p.id,name:p.name,image_url:p.image_url||'',price:Number(p.promo_price??p.price),qty:1});
  localStorage.setItem('macrofood_cart',JSON.stringify(cart));render();openCart();
}
function openCart(){
  $('cartItems').innerHTML=cart.length?`${cart.map((x,i)=>`<div class="cart-row">
    <img class="cart-img" src="${esc(x.image_url||'')}" alt="${esc(x.name)}" onerror="this.style.display='none'">
    <div class="cart-product"><b>${esc(x.name)}</b><small>${money(x.price)} cada</small></div>
    <div class="qty"><button onclick="changeQty(${i},-1)">−</button><b>${x.qty}</b><button onclick="changeQty(${i},1)">+</button></div>
    <div class="cart-subtotal">${money(x.price*x.qty)}</div>
  </div>`).join('')}<div class="cart-total"><span>Total</span><strong>${money(cart.reduce((s,x)=>s+x.price*x.qty,0))}</strong></div>`:'<div class="empty-cart">🛒<p>Seu carrinho está vazio.</p></div>';
  $('cartModal').style.display='flex';
}
function closeCart(){$('cartModal').style.display='none'}
function changeQty(i,d){
  cart[i].qty+=d;if(cart[i].qty<=0)cart.splice(i,1);
  localStorage.setItem('macrofood_cart',JSON.stringify(cart));openCart();render();
}
async function openRating(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  const {data:{session}}=await client.auth.getSession();
  if(!session){if(confirm('Para avaliar, você precisa estar logado. Deseja entrar agora?'))location.href='login.html';return}
  const own=reviews.find(r=>r.product_id===id&&r.user_id===session.user.id);
  $('ratingItems').innerHTML=`<h3>⭐ Avaliar ${esc(p.name)}</h3><p>Escolha de 1 a 5 estrelas. Você pode alterar sua avaliação depois.</p>
    <div class="rating-stars" id="ratingStars">${[1,2,3,4,5].map(n=>`<button class="${own&&Number(own.rating)>=n?'selected':''}" onclick="selectRating(${n})">★</button>`).join('')}</div>
    <button class="primary" onclick="saveRating('${id}')">Salvar avaliação</button>`;
  window.currentRating=own?Number(own.rating):0;window.currentRatingProduct=id;
  $('ratingModal').style.display='flex';
}
function selectRating(n){window.currentRating=n;document.querySelectorAll('#ratingStars button').forEach((b,i)=>b.classList.toggle('selected',i<n))}
function closeRating(){$('ratingModal').style.display='none'}
async function saveRating(id){
  const {data:{session}}=await client.auth.getSession();
  if(!session)return;
  if(!window.currentRating)return alert('Escolha uma nota de 1 a 5 estrelas.');
  const {error}=await client.from('product_reviews').upsert({product_id:id,user_id:session.user.id,rating:window.currentRating},{onConflict:'product_id,user_id'});
  if(error)return alert('Não foi possível salvar: '+error.message);
  const {data:rv}=await client.from('product_reviews').select('product_id,rating,user_id');
  reviews=rv||[];closeRating();render();alert('Avaliação salva com sucesso!');
}
function showCheckoutForm(){
  if(!cart.length)return alert('Carrinho vazio.');
  $('checkoutForm').classList.remove('hidden');
  $('checkoutButton').classList.add('hidden');
  $('customerName').focus();
}
function hideCheckoutForm(){
  $('checkoutForm').classList.add('hidden');
  $('checkoutButton').classList.remove('hidden');
}
function closeOrderSuccess(){$('orderSuccessModal').style.display='none';closeCart()}
function normalizePhone(v){return String(v||'').replace(/\D/g,'')}
async function submitOrder(){
  if(!cart.length)return alert('Carrinho vazio.');
  const name=$('customerName').value.trim();
  const whatsapp=normalizePhone($('customerWhatsapp').value);
  const note=$('customerNote').value.trim();
  if(name.length<2)return alert('Informe seu nome completo.');
  if(whatsapp.length<10||whatsapp.length>13)return alert('Informe um WhatsApp válido com DDD.');
  const {data:{session}}=await client.auth.getSession();
  const total=cart.reduce((s,x)=>s+x.price*x.qty,0);
  const items=cart.map(x=>({product_id:x.id,name:x.name,qty:x.qty,unit_price:Number(x.price),subtotal:Number((x.price*x.qty).toFixed(2)),image_url:x.image_url||''}));
  const payload={user_id:session?.user?.id||null,customer_name:name,customer_phone:whatsapp,customer_email:session?.user?.email||null,note:note||null,items,total,status:'received'};
  const {data,error}=await client.from('orders').insert(payload).select('order_number').single();
  if(error)return alert('Não foi possível registrar o pedido: '+error.message);
  localStorage.removeItem('macrofood_cart');
  cart=[];render();hideCheckoutForm();
  $('orderSuccessText').textContent=`Seu pedido #${data.order_number} foi enviado para a Macrofood. O administrador vai conferir e informar pelo WhatsApp quando estiver pronto para pagamento.`;
  $('orderSuccessModal').style.display='flex';
}


// Inicializa o catálogo público depois que o HTML e o Supabase SDK estiverem carregados.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', load, { once: true });
} else {
  load();
}

loadAccountHeader();
