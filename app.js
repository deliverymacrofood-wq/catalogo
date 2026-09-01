const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const defaultSectors=['Chocolates','Confeitaria','Sorveteria','Padaria','Restaurante','Ocidental','Frios','Congelados'];
let sectors=['Todos','Promoções',...defaultSectors];
let active='Todos',products=[],reviews=[],banners=[],bannerTimer=null,cart=[];
let ordersEnabled=true, orderMethods={delivery:true,store:true,uber:true}, bestSellerIds=[];
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
const productImageAttrs=(featured=false)=>featured?'loading="eager" fetchpriority="high" decoding="async"':'loading="lazy" decoding="async"';


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
    location.href='login/?redirect=./';
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
      el.href='login/';
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
    el.href='login/';
    el.title='Abrir minha conta';
    el.setAttribute('aria-label','Abrir minha conta');
  }catch(e){
    el.innerHTML='👤 Minha conta';
    el.href='login/';
  }
}

function renderBanners(){
  const el=$('bannerArea'); if(!el)return;
  clearInterval(bannerTimer);
  if(!banners.length){
    el.className='banner-area fallback-banner';
    el.innerHTML=`<div class="banner-fallback-content"><div><span>MACROFOOD • ATACADO & VAREJO</span><h2>QUALIDADE QUE VOCÊ CONHECE,<br><strong>SABOR QUE VOCÊ CONFIA!</strong></h2><p>Produtos selecionados para deixar seu dia mais prático.</p><button type="button" onclick="document.getElementById('productsSection').scrollIntoView({behavior:'smooth'})">VER PRODUTOS</button></div><div class="banner-fallback-icon">🛒</div></div>`;
    return;
  }
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

function selectCategory(category){
  active=String(category||'Todos');
  render();
  const title=$('productsTitle');
  const subtitle=$('productsSubtitle');
  if(title){
    title.textContent=active==='Todos'?'Todos os produtos':active==='Promoções'?'Promoções':active;
  }
  if(subtitle){
    subtitle.textContent=active==='Todos'?'Confira nosso catálogo completo.':`Produtos da categoria ${active}.`;
  }
  const target=$('productsSection');
  if(target) setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),40);
}
function renderCats(){
  $('cats').innerHTML=sectors.map(s=>`<button type="button" class="cat ${s===active?'active':''}" data-sector="${esc(s)}" onclick="selectCategory(this.dataset.sector)">${s==='Promoções'?'🔥 ':''}${esc(s)}</button>`).join('');
}
async function fetchAllRows(builder, pageSize=500){
  const out=[];
  for(let from=0;;from+=pageSize){
    const {data,error}=await builder.range(from,from+pageSize-1);
    if(error) throw error;
    if(data?.length) out.push(...data);
    if(!data || data.length<pageSize) break;
  }
  return out;
}

async function load(){
  const grid=$('grid');
  if(grid) grid.innerHTML='<div class="notice">Carregando catálogo completo...</div>';
  try{
    const {data:{session}}=await client.auth.getSession();
    await loadUserCart(session);

    // Cada fonte é carregada de forma independente. Assim, uma tabela opcional
    // (banners, avaliações, configurações ou ranking) não impede os produtos de aparecerem.
    let data=[], rv=[], bn=[], cats=[], settings=[], best=[];
    let productError=null;
    try{
      data=await fetchAllRows(client.from('products').select('*').order('name',{ascending:true}),500);
    }catch(e){ productError=e; }
    if(productError){
      if(grid) grid.innerHTML=`<div class="notice"><b>Não foi possível carregar os produtos.</b><br>${esc(productError.message||productError)}<br><small>Verifique a tabela products e a política de leitura pública no Supabase.</small></div>`;
      return;
    }

    try{rv=await fetchAllRows(client.from('product_reviews').select('product_id,rating,user_id'),500);}catch(_){rv=[];}
    try{bn=await fetchAllRows(client.from('site_banners').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true}),100);}catch(_){bn=[];}
    try{cats=await fetchAllRows(client.from('categories').select('name').order('name'),200);}catch(_){cats=[];}
    try{settings=await fetchAllRows(client.from('site_settings').select('key,value').in('key',['orders_enabled','delivery_enabled','store_pickup_enabled','uber_pickup_enabled']),100);}catch(_){settings=[];}

    // Ranking: usa a RPC quando disponível; se ainda não tiver sido criada,
    // calcula no navegador a partir dos pedidos finalizados para não deixar a seção vazia.
    try{
      const {data:r,error:rErr}=await client.rpc('get_best_selling_products',{limit_count:12});
      if(!rErr) best=r||[];
    }catch(_){best=[];}
    if(!best.length){
      try{
        const finished=await fetchAllRows(client.from('orders').select('items').eq('status','completed'),500);
        const totals=new Map();
        for(const o of finished){
          for(const item of (Array.isArray(o.items)?o.items:[])){
            const id=item?.product_id; const qty=Number(item?.qty||0);
            if(id && Number.isFinite(qty)) totals.set(String(id),(totals.get(String(id))||0)+qty);
          }
        }
        best=[...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([product_id,sold_quantity])=>({product_id,sold_quantity}));
      }catch(_){best=[];}
    }

    // A política RLS do banco já filtra produtos inativos para visitantes.
    // Não descartamos registros válidos por campos opcionais ausentes.
    products=(data||[]).filter(p=>p && p.id && p.name && (p.active===undefined || p.active===null || p.active===true));
    // Mostra o catálogo assim que os produtos chegam, sem esperar avaliações,
    // banners, categorias ou ranking terminarem de carregar.
    reviews=[];
    banners=[];
    render();
    reviews=rv||[];
    const dynamicCats=(cats||[]).map(c=>c?.name).filter(Boolean);
    sectors=['Todos','Promoções',...(dynamicCats.length?dynamicCats:defaultSectors)];
    banners=(bn||[]).filter(b=>b && b.image_url && (b.active===undefined || b.active===null || b.active===true)).slice(0,10);
    const settingMap=Object.fromEntries((settings||[]).map(x=>[x.key,String(x.value).toLowerCase()]));
    ordersEnabled=settingMap.orders_enabled!=='false';
    orderMethods={delivery:settingMap.delivery_enabled!=='false',store:settingMap.store_pickup_enabled!=='false',uber:settingMap.uber_pickup_enabled!=='false'};
    bestSellerIds=(best||[]).map(x=>String(x.product_id));

    renderBanners();
    render();
    loadAccountHeader();
  }catch(e){
    if(grid) grid.innerHTML=`<div class="notice"><b>Não foi possível carregar o catálogo.</b><br>${esc(e?.message||e)}<br><small>Verifique a conexão com o Supabase.</small></div>`;
    console.error('Erro ao carregar catálogo:',e);
  }
}
async function openSuggestion(){
  try{
    const {data:{session}}=await client.auth.getSession();
    if(!session){
      alert('Entre na sua conta para enviar uma sugestão de produto.');
      location.href='login/';
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
  if(!session){closeSuggestion();alert('Sua sessão expirou. Entre novamente para enviar a sugestão.');location.href='login/';return;}
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
  const valid=wholesalePrice!==null&&wholesalePrice>0&&wholesaleQty>0&&wholesalePrice<normalPrice;
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
function syncSearch(value){ searchProducts(value); }
function searchProducts(value, focusResults=false){
  value=String(value||'');
  const input=$('search'); const mobile=$('mobileSearch');
  if(input && input.value!==value) input.value=value;
  if(mobile && mobile.value!==value) mobile.value=value;
  render();
  if(focusResults){
    const target=$('productsSection');
    if(target) setTimeout(()=>target.scrollIntoView({behavior:'smooth',block:'start'}),30);
  }
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
  const img=p.image_url?`<img ${productImageAttrs(featured)} src="${esc(p.image_url)}" alt="${esc(p.name)}" width="320" height="240" onerror="this.style.display='none'">`:'📦';
  return `<article class="${featured?'feature-card':'card'}">
    <div class="${featured?'feature-pic':'pic'}">${featured?'<span class="featured-badge">🔥 MAIS VENDIDO</span>':''}${p.is_new?'<span class="new-badge">✨ NOVIDADE</span>':''}${img}</div>
    <div class="${featured?'feature-info':'info'}">
      ${featured?'':`<div class="sector">${esc(p.sector)}</div>`}
      <div class="${featured?'feature-name':'name'}">${esc(p.name)}</div>${p.note?`<div class="product-note">📝 ${esc(p.note)}</div>`:''}
      ${p.product_code?`<small class="code">Código: ${esc(p.product_code)}</small>`:''}
      ${featured?marketingPriceHtml(p):priceHtml(p)}
      ${featured?`<div class="feature-rating">${stars(p)} <button class="rate-btn" onclick="openRating('${p.id}')">⭐ Avaliar</button></div><button class="feature-add" onclick="addCart('${p.id}')" ${p.in_stock===false?'disabled':''}>${p.in_stock===false?'Sem estoque':'🛒 Adicionar'}</button>`:`${stars(p)}<div class="card-actions"><button class="primary" onclick="addCart('${p.id}')" ${p.in_stock===false?'disabled':''}>${p.in_stock===false?'Sem estoque':'🛒 Adicionar'}</button><button class="rate-btn" onclick="openRating('${p.id}')">⭐ Avaliar</button></div>`}
    </div>
  </article>`;
}
function renderFeatured(){
  const el=$('featuredGrid'); if(!el)return;
  const rank=new Map(bestSellerIds.map((id,i)=>[id,i]));
  const featured=[...products].sort((a,b)=>{
    const ra=rank.has(String(a.id))?rank.get(String(a.id)):9999;
    const rb=rank.has(String(b.id))?rank.get(String(b.id)):9999;
    return ra-rb || String(a.name).localeCompare(String(b.name));
  }).slice(0,6);
  el.innerHTML=featured.length?featured.map(p=>productCard(p,true)).join(''):'<div class="notice">Nenhum produto disponível.</div>';
}
function renderPromos(){
  const el=$('promoGrid'); if(!el)return;
  const promos=products.filter(p=>p.promo_price!=null&&Number(p.promo_price)<Number(p.price)).slice(0,4);
  el.innerHTML=promos.length?promos.map(p=>{
    const unit=unitLabel(p);
    const wholesale=(p.wholesale_price!=null&&Number(p.wholesale_price)<effectiveBasePrice(p)&&Number(p.wholesale_qty)>0)
      ? `<div class="wholesale-note">🏷️ Atacado: ${money(p.wholesale_price)} / ${unit} ${p.wholesale_mode==='block'?'a cada':'a partir de'} ${p.wholesale_qty} ${unit}</div>` : '';
    return `<article class="promo-card"><img loading="lazy" decoding="async" src="${esc(p.image_url||'')}" alt="${esc(p.name)}" width="320" height="220" onerror="this.style.display='none'"><div><div class="promo-name">${esc(p.name)}</div><div class="old">De <s>${money(p.price)}</s></div><div class="new">Por ${money(p.promo_price)} / ${unit}</div>${wholesale}<button class="feature-add" onclick="addCart('${p.id}')">🛒</button></div></article>`;
  }).join(''):'<div class="notice">Nenhuma promoção ativa no momento.</div>';
}
function renderNew(){
  const el=$('newGrid'); if(!el)return;
  const newest=[...products].filter(p=>p.is_new===true).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,6);
  el.innerHTML=newest.length?newest.map(p=>productCard(p,true)).join(''):'<div class="notice">Nenhuma novidade cadastrada no momento.</div>';
}

function render(){
  renderCats();
  const title=$('productsTitle'); const subtitle=$('productsSubtitle');
  if(title) title.textContent=active==='Todos'?'Todos os produtos':active==='Promoções'?'Promoções':active;
  if(subtitle) subtitle.textContent=active==='Todos'?'Confira nosso catálogo completo.':`Produtos da categoria ${active}.`;
  renderFeatured();
  renderNew();
  renderPromos();
  refreshOrderAvailabilityUI();
  const cartQty=cart.reduce((n,x)=>n+Number(x.qty||0),0);
  $('cartCount').textContent=cartQty;
  if($('mobileCartCount'))$('mobileCartCount').textContent=cartQty;
  if($('floatingCart')){$('floatingCartCount').textContent=cartQty.toLocaleString('pt-BR',{maximumFractionDigits:3});$('floatingCart').classList.toggle('hidden',cart.length===0);}
  let q=String(($('search')?.value || $('mobileSearch')?.value || '')).toLowerCase().trim();
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
    location.href='login/?redirect=./';
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
  if(qty){qty.value=p.unit==='kg'?'0.100':'1';qty.step=p.unit==='kg'?'0.001':'1';qty.min=p.unit==='kg'?'0.001':'1';}
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
  let value=Number(input.value)|| (pendingCartProduct?.unit==='kg'?0.1:1);
  const step=pendingCartProduct?.unit==='kg'?0.1:1; const min=pendingCartProduct?.unit==='kg'?0.1:1; value=Math.max(min,Math.min(99.999,value+delta*step)); value=Number(value.toFixed(3));
  input.value=value;
  updatePendingTotal();
}
function updatePendingTotal(){
  const input=$('addQtyInput');
  const total=$('addQtyTotal');
  if(!input||!total||!pendingCartProduct)return;
  const step=pendingCartProduct?.unit==='kg'?0.001:1; const min=pendingCartProduct?.unit==='kg'?0.001:1; const qty=Math.max(min,Math.min(99.999,Number(input.value)||min)); input.value=qty;
  input.value=qty;
  total.textContent=money(wholesaleTotal(pendingCartProduct,qty));
}
async function confirmAddCart(){
  if(!pendingCartProduct)return;
  const session=await requireLoggedCart();
  if(!session)return;
  const input=$('addQtyInput');
  const min=pendingCartProduct?.unit==='kg'?0.001:1;
  const qty=Math.max(min,Math.min(99.999,Number(input?.value)||min));
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
  const step=cart[i].unit==='kg'?0.1:1; cart[i].qty=Number((Number(cart[i].qty)+d*step).toFixed(3)); if(cart[i].qty<=0)cart.splice(i,1);
  saveUserCart();openCart();render();
}

async function openRating(id){
  const p=products.find(x=>x.id===id);if(!p)return;
  const {data:{session}}=await client.auth.getSession();
  if(!session){if(confirm('Para avaliar, você precisa estar logado. Deseja entrar agora?'))location.href='login/';return}
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
  if(!ordersEnabled)return alert('A função de pedidos está em manutenção. Voltaremos em breve.');
  const session=await requireLoggedCart();
  if(!session)return;
  if(!cart.length)return alert('Carrinho vazio.');
  $('checkoutForm').classList.remove('hidden');
  $('checkoutButton').classList.add('hidden');
  // O telefone fica sempre associado ao pedido para que o administrador
  // consiga entrar em contato com o cliente pelo WhatsApp.
  try{
    const {data:profile}=await client.from('profiles').select('nickname,phone').eq('id',session.user.id).maybeSingle();
    const phone=$('customerWhatsapp');
    if(phone && !phone.value){phone.value=profile?.phone?formatBrazilPhone(profile.phone):'+55 ';}
    const email=$('customerEmail');
    if(email && !email.value) email.value=session.user.email||'';
    const name=$('customerName');
    if(name && !name.value && profile?.nickname) name.value=profile.nickname;
  }catch(e){console.warn('Não foi possível carregar os dados do contato:',e)}
  toggleCustomerType();
  const method=$('deliveryMethod'); if(method) method.value=method.value||'delivery';
  updateDeliveryMethodHelp();
  $('customerHasSalesCadastro').focus();
}
function hideCheckoutForm(){
  $('checkoutForm').classList.add('hidden');
  $('checkoutButton').classList.remove('hidden');
}
function closeOrderSuccess(){ $('orderSuccessModal').style.display='none'; closeCart(); }
function normalizePhone(v){let n=String(v||'').replace(/\D/g,'');if(n.startsWith('55'))return n;if(n.length===10||n.length===11)return '55'+n;return n}
function formatBrazilPhone(v){const n=normalizePhone(v);if(!n)return '';const local=n.startsWith('55')?n.slice(2):n;if(local.length===11)return '+55 ('+local.slice(0,2)+') '+local.slice(2,7)+'-'+local.slice(7);if(local.length===10)return '+55 ('+local.slice(0,2)+') '+local.slice(2,6)+'-'+local.slice(6);return '+55 '+local;}
function ensureBrazilPrefixInput(el){if(!el)return;el.addEventListener('focus',()=>{if(!el.value.trim())el.value='+55 ';});el.addEventListener('blur',()=>{const n=normalizePhone(el.value);if(n.length===12||n.length===13)el.value=formatBrazilPhone(n);else if(!el.value.trim())el.value='+55 ';});}
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
  if(phone){phone.required=true;ensureBrazilPrefixInput(phone);}
  if(!has && !cnpj && nameInput) nameInput.focus();
}

function updateDeliveryMethodHelp(){
  const select=$('deliveryMethod'),help=$('deliveryMethodHelp'); if(!select||!help)return;
  const v=select.value;
  help.innerHTML=v==='uber'
    ? '🚗 <b>Retirada por aplicativo (Uber):</b> entre em contato pelo <a href="https://wa.me/5581971178793" target="_blank" rel="noopener">+55 (81) 97117-8793</a> e informe a placa do veículo.'
    : v==='store' ? '🏪 Você fará a retirada diretamente na loja.'
    : '🚚 A MacroFood fará a entrega conforme combinado.';
}
function refreshOrderAvailabilityUI(){
  const btn=$('checkoutButton'),notice=$('ordersMaintenance'),select=$('deliveryMethod');
  if(notice) notice.classList.toggle('hidden',ordersEnabled);
  if(btn){btn.disabled=!ordersEnabled;btn.classList.toggle('hidden',!ordersEnabled);btn.textContent=ordersEnabled?'Continuar para finalizar pedido':'Pedidos temporariamente indisponíveis';}
  if(select){
    [...select.options].forEach(o=>o.disabled=!orderMethods[o.value]);
    if(select.options[select.selectedIndex]?.disabled){
      const first=[...select.options].find(o=>!o.disabled); if(first)select.value=first.value;
    }
    updateDeliveryMethodHelp();
  }
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
  const deliveryMethod=$('deliveryMethod')?.value||'delivery';
  if(!ordersEnabled)return alert('A função de pedidos está em manutenção. Voltaremos em breve.');
  if(!orderMethods[deliveryMethod])return alert('Esta opção de entrega/retirada está indisponível no momento.');
  if(deliveryMethod==='uber' && !confirm('Para retirada por aplicativo (Uber), entre em contato pelo número +55 (81) 97117-8793 para informar a placa do veículo. Deseja continuar?'))return;

  if(whatsapp.length!==12&&whatsapp.length!==13)return alert('Informe um número de celular/WhatsApp válido com DDD. Exemplo: +55 (81) 99999-9999.');

  if(hasCadastro){
    if(name.length<2)return alert('Informe o nome completo.');
    if(cpfCnpj.length!==11)return alert('Informe um CPF válido com 11 números.');
  }else if(docType==='cpf'){
    if(name.length<2)return alert('Para CPF, o nome completo é obrigatório.');
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
    const isKg=(p.unit||x.unit)==='kg';
    if(!Number.isFinite(qty)||qty<=0||qty>9999||(!isKg&&!Number.isInteger(qty))||(isKg&&Number(qty.toFixed(3))!==qty)){
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
    zipcode:cep||null,
    delivery_method:deliveryMethod
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
