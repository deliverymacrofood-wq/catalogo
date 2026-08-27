const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const defaultSectors=['Chocolates','Confeitaria','Sorveteria','Padaria','Restaurante','Ocidental','Frios','Congelados'];
let sectors=['Todos','Promoções',...defaultSectors];
let active='Todos',products=[],reviews=[],banners=[],bannerTimer=null,cart=[];
let cartUserId=null;
function numericValue(value){
  if(value===null || value===undefined || value==='') return null;
  if(typeof value==='number') return Number.isFinite(value)?value:null;
  let s=String(value).trim().replace(/R\$|\s/g,'');
  // Aceita tanto 1234.56 quanto 1.234,56 / 1234,56.
  if(s.includes(',') && s.includes('.')) s=s.replace(/\./g,'').replace(',','.');
  else if(s.includes(',')) s=s.replace(',','.');
  const n=Number(s);
  return Number.isFinite(n)?n:null;
}
const money=v=>{
  const n=numericValue(v);
  return Number.isFinite(n)?n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'R$ 0,00';
};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const $=id=>document.getElementById(id);


function cartStorageKey(userId){return `macrofood_cart_${userId}`;}
function saveUserCart(){
  if(!cartUserId){cart=[];return;}
  localStorage.setItem(cartStorageKey(cartUserId),JSON.stringify(cart));
}
async function loadUserCart(session){
  const userId=session?.user?.id||null;
  cartUserId=userId;
  // O carrinho antigo global não é mais usado para evitar misturar produtos entre contas.
  localStorage.removeItem('macrofood_cart');
  cart=[];
  if(!userId){render();return;}
  try{
    const saved=JSON.parse(localStorage.getItem(cartStorageKey(userId))||'[]');
    cart=Array.isArray(saved)?saved.filter(x=>x&&x.id&&Number(x.qty)>0):[];
  }catch(_){cart=[];}
  render();
}
async function requireLoggedCart(){
  const {data:{session}}=await client.auth.getSession();
  if(!session){
    alert('Para usar o carrinho, entre na sua conta ou crie uma conta.');
    location.href='login.html?redirect=index.html';
    return null;
  }
  if(cartUserId!==session.user.id) await loadUserCart(session);
  return session;
}


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
  const {data:{session}}=await client.auth.getSession();
  await loadUserCart(session);
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
function effectiveBasePrice(p){
  const normal=numericValue(p?.price);
  const promo=numericValue(p?.promo_price);
  if(normal===null) return null;
  return promo!==null && promo>0 && promo<normal ? promo : normal;
}
function wholesaleBreakdown(p,qty){
  qty=Math.max(0,Number(qty)||0);
  const normalPrice=effectiveBasePrice(p);
  if(normalPrice===null){
    return {normalQty:qty,wholesaleQty:0,normalPrice:null,wholesalePrice:null,normalTotal:null,wholesaleTotal:0,total:null,discount:null,valid:false,reason:'O produto está sem preço válido cadastrado.'};
  }
  const wholesalePrice=numericValue(p?.wholesale_price);
  const wholesaleQty=Number(p?.wholesale_qty);
  const valid=wholesalePrice!==null&&wholesalePrice>0&&Number.isInteger(wholesaleQty)&&wholesaleQty>0&&wholesalePrice<normalPrice;
  if(!valid){
    const total=normalPrice*qty;
    return {normalQty:qty,wholesaleQty:0,normalPrice,wholesalePrice:null,normalTotal:total,wholesaleTotal:0,total,discount:0,valid:true};
  }
  let wQty=0,nQty=qty;
  if(p.wholesale_mode==='block'){
    // “A cada X”: blocos completos no atacado e o restante no preço normal.
    wQty=Math.floor(qty/wholesaleQty)*wholesaleQty;
    nQty=qty-wQty;
  }else if(qty>=wholesaleQty){
    // “A partir de X”: toda a quantidade no preço de atacado.
    wQty=qty;
    nQty=0;
  }
  const normalTotal=nQty*normalPrice;
  const wholesaleTotal=wQty*wholesalePrice;
  const total=normalTotal+wholesaleTotal;
  return {normalQty:nQty,wholesaleQty:wQty,normalPrice,wholesalePrice,normalTotal,wholesaleTotal,total,discount:(qty*normalPrice)-total,valid:true};
}
function wholesaleTotal(p,qty){
  const b=wholesaleBreakdown(p,qty);
  return b.valid && Number.isFinite(b.total) ? b.total : null;
}
function unitLabel(p){return p?.unit==='kg'?'kg':'un.';}
function syncSearch(value){
  const input=$('search'); if(input) input.value=value||'';
  render();
}
function priceHtml(p){
  const unit=unitLabel(p);
  const base=effectiveBasePrice(p);
  if(base===null || !Number.isFinite(base) || base<=0){
    return '<div class="price error-price">Preço não informado</div>';
  }
  const hasPromo=p.promo_price!=null && Number(p.promo_price)>0 && Number(p.promo_price)<Number(p.price);
  let html=hasPromo
    ? `<div class="oldprice">De: <s>${money(p.price)}</s></div><div class="price">Por: ${money(p.promo_price)} / ${unit}</div>`
    : `<div class="price">${money(p.price)} / ${unit}</div>`;
  if(p.wholesale_price!=null && Number(p.wholesale_price)>0 && Number(p.wholesale_price)<base && Number.isInteger(Number(p.wholesale_qty)) && Number(p.wholesale_qty)>0){
    html+=`<div class="wholesale-note">🏷️ Atacado: ${money(p.wholesale_price)} / ${unit} ${p.wholesale_mode==='block'?'a cada':'a partir de'} ${p.wholesale_qty} ${unit}</div>`;
  }
  return html;
}
function marketingPriceHtml(p){
  const unit=unitLabel(p);
  const hasPromo=p.promo_price!=null&&Number(p.promo_price)<Number(p.price);
  let html=hasPromo
    ? `<div class="oldprice">De: <s>${money(p.price)}</s></div><div class="feature-price">Por: ${money(p.promo_price)} / ${unit}</div>`
    : `<div class="feature-price">Por: ${money(p.price)} / ${unit}</div>`;
  if(p.wholesale_price!=null&&Number(p.wholesale_price)<effectiveBasePrice(p)&&Number(p.wholesale_qty)>0){
    html+=`<div class="wholesale-note">🏷️ Atacado: ${money(p.wholesale_price)} / ${unit} ${p.wholesale_mode==='block'?'a cada':'a partir de'} ${p.wholesale_qty} ${unit}</div>`;
  }
  return html;
}
function productCard(p,featured=false){
  const img=p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}">`:'📦';
  return `<article class="${featured?'feature-card':'card'}">
    <div class="${featured?'feature-pic':'pic'}">${featured?'<span class="featured-badge">★ DESTAQUE</span>':''}${img}</div>
    <div class="${featured?'feature-info':'info'}">
      ${featured?'':`<div class="sector">${esc(p.sector)}</div>`}
      <div class="${featured?'feature-name':'name'}">${esc(p.name)}</div>
      ${featured&&p.product_code?`<small class="muted">Código: ${esc(p.product_code)}</small>`:''}
      ${featured?marketingPriceHtml(p):priceHtml(p)}
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
  el.innerHTML=promos.length?promos.map(p=>{
    const unit=unitLabel(p);
    const wholesale=(p.wholesale_price!=null&&Number(p.wholesale_price)<effectiveBasePrice(p)&&Number(p.wholesale_qty)>0)
      ? `<div class="wholesale-note">🏷️ Atacado: ${money(p.wholesale_price)} / ${unit} ${p.wholesale_mode==='block'?'a cada':'a partir de'} ${p.wholesale_qty} ${unit}</div>` : '';
    return `<article class="promo-card"><img src="${esc(p.image_url||'')}" alt="${esc(p.name)}"><div><div class="promo-name">${esc(p.name)}</div><div class="old">De <s>${money(p.price)}</s></div><div class="new">Por ${money(p.promo_price)} / ${unit}</div>${wholesale}<button class="feature-add" onclick="addCart('${p.id}')">🛒</button></div></article>`;
  }).join(''):'<div class="notice">Nenhuma promoção ativa no momento.</div>';
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
    return categoryOk&&(!q||String(p.name||'').toLowerCase().includes(q)||String(p.sector||'').toLowerCase().includes(q));
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
  const p=products.find(x=>String(x.id)===String(id));
  if(!p||p.in_stock===false)return;
  if(effectiveBasePrice(p)===null){
    alert(`O produto "${p.name}" está sem preço válido cadastrado. Corrija o preço no painel do administrador.`);
    return;
  }
  pendingCartProduct=p;
  pendingCartQty=1;
  const qty=$('addQtyInput');
  if(qty)qty.value='1';
  const title=$('addQtyTitle');
  const price=$('addQtyPrice');
  const img=$('addQtyImage');
  if(title)title.textContent=p.name;
  if(price)price.textContent=money(effectiveBasePrice(p))+' / '+unitLabel(p);
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
  total.textContent=money(wholesaleTotal(pendingCartProduct,qty));
}
async function confirmAddCart(){
  if(!pendingCartProduct)return;
  const session=await requireLoggedCart();
  if(!session)return;
  const input=$('addQtyInput');
  const qty=Math.max(1,Math.min(99,parseInt(input?.value,10)||1));
  const p=pendingCartProduct;
  const x=cart.find(x=>x.id===p.id);
  if(x)x.qty+=qty;
  else cart.push({id:p.id,name:p.name,image_url:p.image_url||'',price:effectiveBasePrice(p),unit:p.unit||'unidade',promo_price:p.promo_price??null,wholesale_mode:p.wholesale_mode||null,wholesale_qty:p.wholesale_qty??null,wholesale_price:p.wholesale_price??null,qty});
  saveUserCart();
  closeAddQty();
  render();
  const toast=$('cartToast');
  if(toast){toast.textContent=qty===1?'Produto adicionado ao carrinho!':`${qty} unidades adicionadas ao carrinho!`;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),1800);}
}
async function openCart(){
  const session=await requireLoggedCart();
  if(!session)return;
  const itemsEl=$('cartItems');
  const totalEl=$('cartTotalValue');
  const checkout=$('checkoutButton');
  if(!itemsEl)return;
  itemsEl.innerHTML=cart.length?cart.map((x,i)=>{
    const p=products.find(p=>p.id===x.id)||x;
    const b=wholesaleBreakdown(p,x.qty);
    const totalLine=b.total;
    const effective=x.qty?totalLine/x.qty:0;
    const hasWholesale=b.wholesaleQty>0;
    const unit=unitLabel(p);
    const pricing=hasWholesale
      ? `<div class="cart-pricing">${b.wholesaleQty?`<span>🏷️ ${b.wholesaleQty} ${unit} no atacado: <b>${money(b.wholesalePrice)} / ${unit}</b></span>`:''}${b.normalQty?`<span>${b.normalQty} ${unit} no preço normal: <b>${money(b.normalPrice)} / ${unit}</b></span>`:''}<strong class="cart-discount">Você economizou ${money(b.discount)}</strong></div>`
      : `<small>${money(effective)} / ${unit}</small>`;
    return `<div class="cart-row">
      <img class="cart-img" src="${esc(x.image_url||p.image_url||'')}" alt="${esc(x.name)}" onerror="this.style.display='none'">
      <div class="cart-product"><b>${esc(x.name)}</b>${pricing}</div>
      <div class="qty"><button type="button" onclick="changeQty(${i},-1)">−</button><b>${x.qty}</b><button type="button" onclick="changeQty(${i},1)">+</button></div>
      <div class="cart-subtotal">${money(totalLine)}</div>
    </div>`
  }).join(''):'<div class="empty-cart">🛒<p>Seu carrinho está vazio.</p></div>';
  const total=cart.reduce((s,x)=>{const p=products.find(p=>p.id===x.id)||x;return s+wholesaleTotal(p,x.qty)},0);
  const normalTotal=cart.reduce((s,x)=>{const p=products.find(p=>p.id===x.id)||x;return s+(effectiveBasePrice(p)*x.qty)},0);
  const totalDiscount=Math.max(0,normalTotal-total);
  const discountEl=$('cartDiscountValue');
  if(discountEl){discountEl.textContent=totalDiscount>0?`Você economizou ${money(totalDiscount)} no atacado`:' ';discountEl.classList.toggle('hidden',totalDiscount<=0);}
  if(totalEl)totalEl.textContent=money(total);
  if(checkout){checkout.classList.toggle('hidden',!cart.length);checkout.disabled=!cart.length;}
  $('cartModal').style.display='flex';
}
function closeCart(){$('cartModal').style.display='none'}
function changeQty(i,d){
  if(!cartUserId||!cart[i])return;
  cart[i].qty+=d;if(cart[i].qty<=0)cart.splice(i,1);
  saveUserCart();openCart();render();
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
async function showCheckoutForm(){
  const session=await requireLoggedCart();
  if(!session)return;
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

  // Busca novamente os produtos do banco antes de finalizar. Isso evita que
  // um carrinho antigo/stale use preço indefinido ou dados de atacado antigos.
  // O total é calculado somente com números válidos e o mesmo cálculo é usado
  // para o subtotal de cada item.
  let total=0;
  const items=[];
  const ids=[...new Set(cart.map(x=>String(x.id)).filter(Boolean))];
  let freshProducts=[];
  if(ids.length){
    const {data:fresh,error:freshError}=await client.from('products').select('*').in('id',ids);
    if(freshError){
      return alert('Não foi possível atualizar os preços dos produtos. Tente novamente.');
    }
    freshProducts=fresh||[];
  }
  for(const x of cart){
    const p=freshProducts.find(p=>String(p.id)===String(x.id)) || products.find(p=>String(p.id)===String(x.id)) || x;
    const qty=Number(x.qty);
    if(!Number.isInteger(qty)||qty<1||qty>9999){
      return alert(`Quantidade inválida para "${x.name}".`);
    }

    // Primeiro tenta o cálculo completo (promoção + atacado).
    let b=wholesaleBreakdown(p,qty);
    // Compatibilidade com produtos antigos: se algum registro legado estiver
    // sem campos de preço de atacado, usa o preço normal/promo válido.
    if(!b.valid || !Number.isFinite(b.total)){
      const base=effectiveBasePrice(p);
      if(base!==null && Number.isFinite(base) && base>0){
        b={normalQty:qty,wholesaleQty:0,normalPrice:base,wholesalePrice:null,
          normalTotal:base*qty,wholesaleTotal:0,total:base*qty,discount:0,valid:true};
      }
    }
    if(!b.valid || !Number.isFinite(b.total) || b.total<=0){
      return alert(`Não foi possível calcular o preço de "${x.name}". Verifique o preço deste produto no painel do administrador.`);
    }

    const subtotal=Math.round((Number(b.total)+Number.EPSILON)*100)/100;
    if(!Number.isFinite(subtotal) || subtotal<=0){
      return alert(`Não foi possível calcular o subtotal de "${x.name}".`);
    }
    total=Math.round((total+subtotal+Number.EPSILON)*100)/100;
    const unitPrice=Math.round((subtotal/qty+Number.EPSILON)*100)/100;
    items.push({
      product_id:x.id,
      name:p.name||x.name,
      qty,
      unit:p.unit||x.unit||'unidade',
      unit_price:unitPrice,
      subtotal,
      image_url:p.image_url||x.image_url||''
    });
  }
  total=Number(total.toFixed(2));
  if(!Number.isFinite(total)||total<=0){
    return alert('Não foi possível calcular o total do pedido. Verifique os preços dos produtos.');
  }

  const payload={
    user_id:session.user.id,
    customer_name:name||null,
    customer_phone:whatsapp||null,
    customer_email:email||session.user.email||null,
    note:note||null,
    items,
    total,
    status:'received',
    sales_customer:hasCadastro,
    document_type:docType,
    document_number:cpfCnpj||null,
    zipcode:cep||null
  };

  const {data,error}=await client.from('orders').insert(payload).select('order_number').single();
  if(error)return alert('Não foi possível registrar o pedido: '+error.message);

  if(cartUserId){localStorage.removeItem(cartStorageKey(cartUserId));}
  cart=[];render();hideCheckoutForm();
  closeCart();
  $('orderSuccessText').textContent=`Seu pedido #${data.order_number} foi recebido. Você pode acompanhar o andamento em “Meus pedidos”. O administrador entrará em contato pelo WhatsApp quando estiver pronto para pagamento.`;
  $('orderSuccessModal').style.display='flex';
  clearTimeout(window.__orderSuccessTimer);
  window.__orderSuccessTimer=setTimeout(()=>{
    closeOrderSuccess();
    window.scrollTo({top:0,behavior:'smooth'});
  },1800);
}


// Mantém o carrinho isolado por conta e sincroniza login/logout.
client.auth.onAuthStateChange(async (_event, session)=>{
  if(session?.user?.id){
    if(cartUserId!==session.user.id) await loadUserCart(session);
  }else{
    cartUserId=null;
    cart=[];
    localStorage.removeItem('macrofood_cart');
    render();
  }
});

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
