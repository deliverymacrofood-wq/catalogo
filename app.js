const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const defaultSectors=['Chocolates','Confeitaria','Sorveteria','Padaria','Restaurante','Ocidental','Frios','Congelados'];
let sectors=['Todos','Promoções',...defaultSectors];
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
  const categoriesReq=client.from('categories').select('name').order('name');
  const [{data,error},{data:rv,error:rvErr},{data:bn,error:bnErr},{data:cats,error:catErr}]=await Promise.all([productsReq,reviewsReq,bannersReq,categoriesReq]);

  if(error){
    $('grid').innerHTML=`<div class="notice"><b>Não foi possível carregar os produtos.</b><br>${esc(error.message)}<br><small>Confira se a tabela products existe e se a política de leitura pública foi criada no Supabase.</small></div>`;
    return;
  }

  // Compatibilidade com versões antigas: se a coluna active existir,
  // somente produtos ativos são mostrados. Se não existir, todos são exibidos.
  products=(data||[]).filter(p=>p.active===undefined || p.active===null || p.active===true);
  reviews=rvErr?[]:(rv||[]);
  const dynamicCats=(!catErr&&cats?.length)?cats.map(c=>c.name).filter(Boolean):defaultSectors;
  sectors=['Todos','Promoções',...dynamicCats];
  banners=bnErr?[]:(bn||[]).filter(b=>b.active===undefined || b.active===null || b.active===true);
  renderBanners();
  render();
  loadAccountHeader();
  } catch (e) {
    if(grid) grid.innerHTML=`<div class="notice"><b>Não foi possível carregar o catálogo.</b><br>${esc(e?.message||e)}<br><small>Verifique a conexão com o Supabase e as permissões da tabela products.</small></div>`;
    console.error('Erro ao carregar catálogo:',e);
  }
}

async function openSuggestion(){
  try{
    const {data:{session}}=await client.auth.getSession();
    if(!session){
      alert('Entre na sua conta para enviar uma sugestão de produto.');
      location.href='login.html';
      return;
    }
    const {data:profile}=await client.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
    if(profile?.role==='admin'){
      alert('A área de sugestão é destinada aos clientes.');
      return;
    }
    $('suggestionName').value='';
    $('suggestionImage').value='';
    $('suggestionNote').value='';
    $('suggestionMsg').textContent='';
    $('suggestionMsg').style.color='';
    $('suggestionModal').style.display='flex';
  }catch(e){
    alert('Não foi possível abrir a sugestão: '+(e?.message||e));
  }
}
function closeSuggestion(){
  if($('suggestionModal')) $('suggestionModal').style.display='none';
}
async function submitSuggestion(){
  const name=$('suggestionName').value.trim();
  const file=$('suggestionImage').files?.[0];
  const note=$('suggestionNote').value.trim();
  const out=$('suggestionMsg');
  const setMsg=(text,color)=>{out.textContent=text;out.style.color=color||'#a00000'};
  if(name.length<2)return setMsg('Informe o nome do produto.');
  if(!file)return setMsg('Escolha uma foto do produto.');
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))return setMsg('Use JPG, PNG ou WEBP.');
  if(file.size>5*1024*1024)return setMsg('A foto precisa ter no máximo 5 MB.');
  const {data:{session}}=await client.auth.getSession();
  if(!session){closeSuggestion();alert('Sua sessão expirou. Entre novamente para enviar a sugestão.');location.href='login.html';return;}
  const {data:profile}=await client.from('profiles').select('role').eq('id',session.user.id).maybeSingle();
  if(profile?.role==='admin')return setMsg('Somente clientes podem enviar sugestões.');
  setMsg('Enviando sugestão...','#7a4b00');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${session.user.id}/${crypto.randomUUID()}.${ext}`;
  const {error:up}=await client.storage.from('product-suggestions').upload(path,file,{contentType:file.type,upsert:false});
  if(up)return setMsg('Não foi possível enviar a foto: '+up.message);
  const {error}=await client.from('product_suggestions').insert({user_id:session.user.id,product_name:name,note:note||null,storage_path:path});
  if(error){await client.storage.from('product-suggestions').remove([path]);return setMsg('Não foi possível salvar a sugestão: '+error.message)}
  setMsg('Sugestão enviada com sucesso! Obrigado.','#18733b');
  setTimeout(closeSuggestion,900);
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
function syncSearch(value){
  const input=$('search'); if(input) input.value=value||'';
  render();
}
function productCard(p,featured=false){
  const img=p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'📦';
  const price=p.promo_price!=null&&Number(p.promo_price)<Number(p.price)?`<div class="oldprice">De: <s>${money(p.price)}</s></div><div class="feature-price">Por: ${money(p.promo_price)}</div>`:`<div class="feature-price">${money(p.price)}</div>`;
  return `<article class="${featured?'feature-card':'card'}">
    <div class="${featured?'feature-pic':'pic'}">${featured?'<span class="featured-badge">★ DESTAQUE</span>':''}${img}</div>
    <div class="${featured?'feature-info':'info'}">
      ${featured?'':`<div class="sector">${esc(p.sector)}</div>`}
      <div class="${featured?'feature-name':'name'}">${esc(p.name)}</div>
      ${featured&&p.product_code?`<small class="muted">Código: ${esc(p.product_code)}</small>`:''}
      ${featured?price:priceHtml(p)}
      ${featured?`<div class="feature-rating">${stars(p)} <button class="rate-btn" onclick="openRating('${p.id}')">⭐ Avaliar</button></div><button class="feature-add" onclick="addCart('${p.id}')" ${p.in_stock===false?'disabled':''}>${p.in_stock===false?'Sem estoque':'🛒 Adicionar'}</button>`:`${stars(p)}<div class="card-actions"><button class="primary" onclick="addCart('${p.id}')" ${p.in_stock===false?'disabled':''}>${p.in_stock===false?'Sem estoque':'🛒 Adicionar'}</button><button class="rate-btn" onclick="openRating('${p.id}')">⭐ Avaliar</button></div>`}
    </div>
  </article>`;
}
function renderFeatured(){
  const el=$('featuredGrid'); if(!el)return;
  const marked=products.filter(p=>p.is_featured===true || p.featured===true);
  const featured=(marked.length?marked:products).slice(0,6);
  el.innerHTML=featured.length?featured.map(p=>productCard(p,true)).join(''):'<div class="notice">Nenhum produto disponível.</div>';
}
function renderPromos(){
  const el=$('promoGrid'); if(!el)return;
  const promos=products.filter(p=>p.promo_price!=null&&Number(p.promo_price)<Number(p.price)).slice(0,4);
  el.innerHTML=promos.length?promos.map(p=>`<article class="promo-card"><img src="${esc(p.image_url||'')}" alt="${esc(p.name)}"><div><div class="promo-name">${esc(p.name)}</div><div class="old">De <s>${money(p.price)}</s></div><div class="new">Por ${money(p.promo_price)}</div><button class="feature-add" onclick="addCart('${p.id}')">🛒</button></div></article>`).join(''):'<div class="notice">Nenhuma promoção ativa no momento.</div>';
}
function render(){
  renderCats();
  renderFeatured();
  renderPromos();
  $('cartCount').textContent=cart.reduce((n,x)=>n+x.qty,0);
  if($('mobileCartCount'))$('mobileCartCount').textContent=cart.reduce((n,x)=>n+x.qty,0);
  let q=$('search').value.toLowerCase().trim();
  let list=products.filter(p=>{
    const categoryOk=active==='Todos'||(active==='Promoções'?p.promo_price!=null&&Number(p.promo_price)<Number(p.price):p.sector===active);
    return categoryOk&&(!q||p.name.toLowerCase().includes(q)||p.sector.toLowerCase().includes(q));
  });
  $('grid').innerHTML=list.length?list.map(p=>productCard(p,false)).join(''):'<div style="grid-column:1/-1;text-align:center;padding:40px;color:#777">Nenhum produto encontrado.</div>';
}
let pendingCartProduct=null;
let pendingCartQty=1;

async function addCart(id){
  const {data:{session}} = await client.auth.getSession();
  if(!session){
    alert('Para adicionar produtos ao carrinho, entre na sua conta ou crie uma conta.');
    location.href='login.html?redirect=index.html';
    return;
  }
  const p=products.find(x=>x.id===id);
  if(!p||p.in_stock===false)return;
  pendingCartProduct=p;
  pendingCartQty=1;
  const qty=$('addQtyInput');
  if(qty)qty.value='1';
  const title=$('addQtyTitle');
  const price=$('addQtyPrice');
  const img=$('addQtyImage');
  if(title)title.textContent=p.name;
  if(price)price.textContent=money(Number(p.promo_price??p.price))+' cada';
  if(img){img.src=p.image_url||'';img.style.display=p.image_url?'block':'none';}
  updatePendingTotal();
  const modal=$('addQtyModal');
  if(modal)modal.style.display='flex';
}
function closeAddQty(){
  const modal=$('addQtyModal');
  if(modal)modal.style.display='none';
  pendingCartProduct=null;
  pendingCartQty=1;
}
function changePendingQty(delta){
  const input=$('addQtyInput');
  if(!input)return;
  let value=parseInt(input.value,10)||1;
  value=Math.max(1,Math.min(99,value+delta));
  input.value=value;
  updatePendingTotal();
}
function updatePendingTotal(){
  const input=$('addQtyInput');
  const total=$('addQtyTotal');
  if(!input||!total||!pendingCartProduct)return;
  const qty=Math.max(1,Math.min(99,parseInt(input.value,10)||1));
  input.value=qty;
  total.textContent=money(Number(pendingCartProduct.promo_price??pendingCartProduct.price)*qty);
}
function confirmAddCart(){
  if(!pendingCartProduct)return;
  const input=$('addQtyInput');
  const qty=Math.max(1,Math.min(99,parseInt(input?.value,10)||1));
  const p=pendingCartProduct;
  const x=cart.find(x=>x.id===p.id);
  if(x)x.qty+=qty;
  else cart.push({id:p.id,name:p.name,image_url:p.image_url||'',price:Number(p.promo_price??p.price),qty});
  localStorage.setItem('macrofood_cart',JSON.stringify(cart));
  closeAddQty();
  render();
  const toast=$('cartToast');
  if(toast){toast.textContent=qty===1?'Produto adicionado ao carrinho!':`${qty} unidades adicionadas ao carrinho!`;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800);}
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
  if(!session){closeRating();return alert('Entre na sua conta para avaliar este produto.');}
  if(!window.currentRating)return alert('Escolha uma nota de 1 a 5 estrelas.');
  const {error}=await client.from('product_reviews').upsert({product_id:id,user_id:session.user.id,rating:Number(window.currentRating)},{onConflict:'product_id,user_id'});
  if(error){console.error(error);return alert('Não foi possível salvar sua avaliação. Verifique se a tabela product_reviews e as políticas do Supabase foram criadas.');}
  const {data:rv,error:rvErr}=await client.from('product_reviews').select('product_id,rating,user_id');
  if(!rvErr)reviews=rv||[];
  closeRating();render();alert('Avaliação salva com sucesso!');
}
function showCheckoutForm(){
  if(!cart.length)return alert('Carrinho vazio.');
  $('checkoutForm').classList.remove('hidden');
  $('checkoutButton').classList.add('hidden');
  toggleCustomerType();
  $('customerHasSalesCadastro').focus();
}
function hideCheckoutForm(){
  $('checkoutForm').classList.add('hidden');
  $('checkoutButton').classList.remove('hidden');
}
function closeOrderSuccess(){ $('orderSuccessModal').style.display='none'; closeCart(); }
function normalizePhone(v){return String(v||'').replace(/\D/g,'')}
function normalizeDoc(v){return String(v||'').replace(/\D/g,'')}
function toggleCustomerType(){
  const has=$('customerHasSalesCadastro')?.value==='yes';
  const noBox=$('newCustomerFields');
  const salesBox=$('salesCustomerFields');
  const docType=$('customerDocType');
  if(noBox) noBox.classList.toggle('hidden',has);
  if(salesBox) salesBox.classList.toggle('hidden',!has);
  const cnpj=!has && docType?.value==='cnpj';
  const nameInput=$('customerName');
  const docInput=$('customerCpfCnpj');
  const nameLabel=nameInput?.parentElement;
  const docLabel=docInput?.parentElement;
  if(nameLabel) nameLabel.style.display=cnpj?'none':'block';
  if(docLabel){
    const label=docLabel.firstChild;
    if(label) label.textContent=cnpj?'CNPJ':'CPF';
  }
  if(docInput) docInput.placeholder=cnpj?'00.000.000/0000-00':'000.000.000-00';
  if(nameInput) nameInput.required=!cnpj;
  if(docInput) docInput.required=true;
  const cep=$('customerCep'), phone=$('customerWhatsapp');
  if(cep) cep.required=!has && !cnpj;
  if(phone) phone.required=!has && !cnpj;
  if(!has && !cnpj && nameInput) nameInput.focus();
}

async function submitOrder(){
  if(!cart.length)return alert('Carrinho vazio.');
  const hasCadastro=$('customerHasSalesCadastro').value==='yes';
  const docType=hasCadastro?'cpf':$('customerDocType').value;
  const name=(hasCadastro?$('salesCustomerName')?.value:$('customerName')?.value||'').trim();
  const whatsapp=normalizePhone($('customerWhatsapp')?.value);
  const email=($('customerEmail')?.value||'').trim().toLowerCase();
  const cpfCnpj=normalizeDoc((hasCadastro?$('salesCustomerCpf')?.value:$('customerCpfCnpj')?.value)||'');
  const cep=normalizeDoc($('customerCep')?.value);
  const note=$('customerNote').value.trim();
  if(hasCadastro){
    if(name.length<2)return alert('Informe o nome completo.');
    if(cpfCnpj.length!==11)return alert('Informe um CPF válido com 11 números.');
  }else if(docType==='cpf'){
    if(name.length<2)return alert('Para CPF, o nome completo é obrigatório.');
    if(whatsapp.length<10||whatsapp.length>13)return alert('Para CPF, o número de celular/WhatsApp é obrigatório.');
    if(cep.length!==8)return alert('Para CPF, o CEP é obrigatório com 8 números.');
    if(cpfCnpj.length!==11)return alert('Informe um CPF válido com 11 números.');
  }else{
    if(cpfCnpj.length!==14)return alert('Para CNPJ, informe um CNPJ válido com 14 números.');
  }
  const {data:{session}}=await client.auth.getSession();
  if(!session)return alert('Você precisa estar logado para fazer um pedido.');
  const emailConfirmed=!!session.user.email_confirmed_at;
  const phoneConfirmed=!!session.user.phone_confirmed_at;
  if(!emailConfirmed && !phoneConfirmed){
    alert('Antes de finalizar a compra, confirme seu e-mail ou celular em “Minha conta”.');
    location.href='login.html';
    return;
  }
  const total=cart.reduce((s,x)=>s+x.price*x.qty,0);
  const items=cart.map(x=>({product_id:x.id,name:x.name,qty:x.qty,unit_price:Number(x.price),subtotal:Number((x.price*x.qty).toFixed(2)),image_url:x.image_url||''}));
  const payload={user_id:session.user.id,customer_name:name||null,customer_phone:whatsapp||null,customer_email:email||session.user.email||null,note:note||null,items,total,status:'received',sales_customer:hasCadastro,document_type:docType,document_number:cpfCnpj||null,zipcode:cep||null};
  const {data,error}=await client.from('orders').insert(payload).select('order_number').single();
  if(error)return alert('Não foi possível registrar o pedido: '+error.message);
  localStorage.removeItem('macrofood_cart');
  cart=[];render();hideCheckoutForm();
  $('orderSuccessText').textContent=`Seu pedido #${data.order_number} foi recebido. Você pode acompanhar o andamento em “Meus pedidos”. O administrador entrará em contato pelo WhatsApp quando estiver pronto para pagamento.`;
  $('orderSuccessModal').style.display='flex';
}


// Inicializa o catálogo público depois que o HTML e o Supabase SDK estiverem carregados.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', load, { once: true });
} else {
  load();
}

loadAccountHeader();

function toggleMobileMenu(){
  const menu=document.getElementById('mobileMenu');
  if(!menu)return;
  const open=menu.classList.toggle('open');
  menu.setAttribute('aria-hidden',String(!open));
}
function closeMobileMenu(){
  const menu=document.getElementById('mobileMenu');
  if(!menu)return;
  menu.classList.remove('open');
  menu.setAttribute('aria-hidden','true');
}

document.addEventListener('click',function(e){
  const menu=document.getElementById('mobileMenu');
  const trigger=e.target.closest?.('.mobile-head > button:first-child');
  if(menu && menu.classList.contains('open') && !menu.contains(e.target) && !trigger) closeMobileMenu();
});
document.addEventListener('keydown',function(e){ if(e.key==='Escape') closeMobileMenu(); });
