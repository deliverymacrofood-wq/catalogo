const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
let editing=null,products=[],categories=[],currentUserId=null,currentAdminEmail='',currentAdminName='Administrador';
const defaultCategories=['Chocolates','Confeitaria','Sorveteria','Padaria','Restaurante','Ocidental','Frios','Congelados'];
let sectors=[...defaultCategories];
const $=id=>document.getElementById(id);
const money=v=>Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const statusLabel={received:'Novo pedido',accepted:'Pedido aceito',separating:'Pedido em separação',waiting_payment:'Pedido esperando pagamento',ready_pickup:'Pedido pronto para retirada',paid:'Pago',completed:'Pedido finalizado',cancelled:'Cancelado'};
const statusClass={received:'status-new',accepted:'status-ready',separating:'status-ready',waiting_payment:'status-ready',ready_pickup:'status-paid',paid:'status-paid',completed:'status-done',cancelled:'status-cancelled'};
async function init(){
  const {data:{session}}=await client.auth.getSession();
  if(!session)return location.href='../login/';
  currentUserId=session.user.id;
  const {data:p,error}=await client.from('profiles').select('role,email,nickname').eq('id',session.user.id).single();
  if(error||!p||p.role!=='admin'){$('app').innerHTML='<div class="denied"><h2>Acesso negado</h2><p>Sua conta não é administradora.</p><a href="../">Voltar ao catálogo</a></div>';return}
  currentAdminEmail=p.email||session.user.email||'';
  currentAdminName=p.nickname||p.email||session.user.email||'Administrador';
  panel();
}
function panel(){
  $('app').innerHTML=`<div class="admin-shell">
    <aside class="sidebar"><div class="side-brand"><img src="logo-macrofood.jpg"><div><b>MacroFood</b><span>Painel Administrativo</span></div><button class="sidebar-close" type="button" aria-label="Fechar menu" onclick="closeMobileSidebar()">×</button></div>
      <nav class="side-nav">
        <button onclick="showTab('dashboard')" data-nav="dashboard">⌂ <span>Dashboard</span></button>
        <button onclick="showTab('prod')" data-nav="prod">◈ <span>Produtos</span></button>
        <button onclick="showTab('categories')" data-nav="categories">▣ <span>Categorias</span></button>
        <button onclick="showTab('promo')" data-nav="promo">◇ <span>Promoções</span></button>
        <button onclick="showTab('banners')" data-nav="banners">▧ <span>Banners</span></button>
        <button onclick="showTab('clients')" data-nav="clients">♟ <span>Clientes</span></button>
        <button onclick="showTab('orders')" data-nav="orders">🛍 <span>Pedidos</span><b id="orderBadge" class="nav-badge hidden">0</b></button>
        <button onclick="showTab('suggestions')" data-nav="suggestions">💡 <span>Sugestões</span><b id="suggestionBadge" class="nav-badge hidden">0</b></button>
        <button onclick="showTab('support')" data-nav="support">💬 <span>Suporte</span><b id="supportBadge" class="nav-badge hidden">0</b></button>
        <button onclick="showTab('settings')" data-nav="settings">⚙ <span>Configurações</span></button>
        <button type="button" onclick="window.location.href='../catalogo/'" data-nav="catalog">🏠 <span>Voltar ao catálogo</span></button>
      </nav>
      <div class="side-bottom"><div class="admin-note">🛡<br><b>Área Administrativa</b><small>Somente administradores possuem acesso a esta área.</small></div><button class="logout-side" id="logout">↪ <span>Sair</span></button></div>
    </aside>
    <div class="sidebar-backdrop" onclick="closeMobileSidebar()" aria-hidden="true"></div>
    <section class="admin-main"><header class="admin-top"><button class="menu-btn" type="button" aria-label="Abrir menu" onclick="toggleMobileSidebar()">☰</button><div class="top-spacer"></div><div class="admin-profile"><div class="avatar">●</div><div><b>${esc(currentAdminName)}</b><small>${esc(currentAdminEmail)}</small></div><span>⌄</span></div></header><main class="admin-content"><div id="tab"></div></main></section>
  </div>`;
  $('logout').onclick=async()=>{await client.auth.signOut();location.href='../catalogo/'};
  showTab('dashboard');
  refreshOrderBadge();
  setInterval(refreshOrderBadge,30000);setInterval(refreshSupportBadge,30000);
}
function nav(t){document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===t));closeMobileSidebar()}
function toggleMobileSidebar(){document.body.classList.toggle('sidebar-open')}
function closeMobileSidebar(){document.body.classList.remove('sidebar-open')}
async function showTab(t){nav(t);if(t==='dashboard')return dashboardTab();if(t==='prod')return productTab();if(t==='categories')return categoriesTab();if(t==='promo')return promoTab();if(t==='banners')return bannersTab();if(t==='clients')return clientsTab();if(t==='orders')return ordersTab();if(t==='suggestions')return suggestionsTab();if(t==='support')return supportTab();return settingsTab()}
function pageTitle(title,subtitle){return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div></div>`}
async function dashboardTab(){
  const [{count:clientCount},{count:productCount},{count:orderCount},{count:newCount}]=await Promise.all([
    client.from('profiles').select('id',{count:'exact',head:true}),client.from('products').select('id',{count:'exact',head:true}).eq('active',true),client.from('orders').select('id',{count:'exact',head:true}),client.from('orders').select('id',{count:'exact',head:true}).eq('status','received')]);
  const {data:recent}=await client.from('orders').select('*').order('created_at',{ascending:false}).limit(5);
  $('tab').innerHTML=`${pageTitle('Dashboard','Visão geral da sua loja.')}
  <div class="metric-grid"><div class="metric orange"><span>👥</span><div><small>Total de Clientes</small><strong>${clientCount||0}</strong><em>Contas cadastradas</em></div></div><div class="metric green"><span>●</span><div><small>Produtos ativos</small><strong>${productCount||0}</strong><em>Disponíveis no catálogo</em></div></div><div class="metric blue"><span>🛍</span><div><small>Total de pedidos</small><strong>${orderCount||0}</strong><em>Pedidos recebidos</em></div></div><div class="metric purple"><span>⏱</span><div><small>Pedidos novos</small><strong>${newCount||0}</strong><em>Aguardando conferência</em></div></div></div>
  <div class="panel-card sales-panel"><div class="card-head"><div><h3>💰 Total de vendas</h3><p>Soma somente dos pedidos <b>finalizados</b> dentro do período selecionado.</p></div></div><div class="sales-date-row"><label>Data inicial<input id="salesDateFrom" type="date" value="${new Date().toISOString().slice(0,10)}"></label><span class="sales-date-separator">até</span><label>Data final<input id="salesDateTo" type="date" value="${new Date().toISOString().slice(0,10)}"></label><button class="primary" type="button" onclick="loadSalesForDate()">Consultar vendas</button></div><div id="salesResult" class="sales-result"><span>Vendas finalizadas</span><strong>R$ 0,00</strong><small>Selecione o período para consultar.</small></div></div>
  <div class="panel-card"><div class="card-head"><div><h3>Pedidos recentes</h3><p>Últimos pedidos recebidos pelo site.</p></div><button class="outline-btn" onclick="showTab('orders')">Ver todos</button></div>${recent?.length?recent.map(orderRow).join(''):'<div class="empty-state">Nenhum pedido ainda.</div>'}</div>`;
  loadSalesForDate();
}
async function loadSalesForDate(){
  const from=$('salesDateFrom'), to=$('salesDateTo'), result=$('salesResult'); if(!from||!to||!result)return;
  const startDate=from.value, endDate=to.value; if(!startDate||!endDate)return;
  if(endDate<startDate){result.innerHTML='<span>Período inválido</span><strong>Escolha datas válidas</strong><small>A data final deve ser igual ou posterior à data inicial.</small>';return;}
  result.innerHTML='<span>Vendas finalizadas</span><strong>Consultando...</strong><small>Aguarde...</small>';
  const start=new Date(startDate+'T00:00:00');
  const end=new Date(endDate+'T23:59:59.999');
  // A venda entra no relatório pela data em que o pedido foi finalizado (updated_at), não pela data em que foi criado.
  const {data,error}=await client.from('orders').select('total').eq('status','completed').gte('updated_at',start.toISOString()).lte('updated_at',end.toISOString());
  if(error){result.innerHTML=`<span>Vendas finalizadas</span><strong>Erro</strong><small>${esc(error.message)}</small>`;return;}
  const total=(data||[]).reduce((sum,o)=>sum+Number(o.total||0),0);
  const fromLabel=new Date(startDate+'T12:00:00').toLocaleDateString('pt-BR');
  const toLabel=new Date(endDate+'T12:00:00').toLocaleDateString('pt-BR');
  const label=startDate===endDate?`Vendas finalizadas em ${fromLabel}`:`Vendas finalizadas de ${fromLabel} a ${toLabel}`;
  result.innerHTML=`<span>${label}</span><strong>${money(total)}</strong><small>${data?.length||0} pedido(s) finalizado(s) no período</small>`;
}
function orderRow(o){return `<div class="order-mini"><div class="order-icon">🛍</div><div class="grow"><b>Pedido #${o.order_number}</b><small>${esc(o.customer_name)} • ${esc(o.customer_phone)}</small></div><span class="status ${statusClass[o.status]||''}">${statusLabel[o.status]||o.status}</span><strong>${money(o.total)}</strong></div>`}
async function refreshOrderBadge(){const {count}=await client.from('orders').select('id',{count:'exact',head:true}).eq('status','received');const b=$('orderBadge');if(!b)return;b.textContent=count||0;b.classList.toggle('hidden',!count)}
async function ensureCategories(){
  const {data,error}=await client.from('categories').select('id,name').order('name');
  if(!error && data?.length){categories=data.map(x=>x.name);sectors=[...categories];}
  else {categories=[...defaultCategories];sectors=[...defaultCategories];}
}
async function productTab(){
  await ensureCategories();
  $('tab').innerHTML=`${pageTitle('Produtos','Gerencie os produtos exibidos no catálogo.')}
  <div class="panel-card"><div class="card-head"><div><h3>${editing?'Editar produto':'Cadastrar produto'}</h3><p>Preencha os dados do produto.</p></div></div><form class="form" id="pf"><label>Nome<input id="name" required></label><label class="full"><span>Observação (opcional)</span><textarea id="productNote" maxlength="300" rows="2" placeholder="Ex.: Produto disponível somente por encomenda."></textarea></label><label>Código (até 6 dígitos)<input id="productCode" inputmode="numeric" maxlength="6" placeholder="Ex.: 123456"></label><label>Preço normal<input id="price" type="number" step="0.01" min="0" required></label><label>Venda por<select id="unit"><option value="unidade">Unidade</option><option value="kg">Kg</option></select></label><label>Setor<select id="sector">${sectors.map(s=>`<option>${s}</option>`).join('')}</select></label><label>Imagem<input id="image" type="file" accept="image/*" capture="environment"></label><label class="remove-bg-option"><input id="removeBg" type="checkbox"><span>✂️ Remover fundo automaticamente</span></label><div id="imageBgStatus" class="full image-bg-status"></div><label>Estoque<select id="stock"><option value="true">Com estoque</option><option value="false">Sem estoque</option></select></label><label>Preço promocional<input id="promo" type="number" step="0.01" min="0" placeholder="Opcional"></label><div class="wholesale-box full"><h4>🏷️ Preço de atacado</h4><p>Defina quando o preço de atacado será aplicado.</p><div class="form"><label>Tipo<select id="wholesaleMode"><option value="threshold">A partir de X quantidade</option><option value="block">A cada X quantidade</option></select></label><label>Quantidade X<input id="wholesaleQty" type="number" min="0.001" step="0.001" placeholder="Ex.: 10"></label><label>Preço de atacado<input id="wholesalePrice" type="number" step="0.01" min="0" placeholder="Ex.: 9,90"></label></div></div><label class="featured-toggle"><input id="isNew" type="checkbox"><span>✨ Marcar como novidade no catálogo</span></label><div class="form-actions full"><button class="primary">${editing?'Salvar alterações':'Cadastrar produto'}</button>${editing?'<button type="button" class="secondary" onclick="editing=null;productTab()">Cancelar</button>':''}</div></form></div><div class="panel-card"><div class="card-head"><div><h3>Produtos cadastrados</h3></div></div><div id="list"></div></div>`;
  $('pf').onsubmit=save; $('unit').onchange=()=>{const q=$('wholesaleQty');if(q){q.step=$('unit').value==='kg'?'0.001':'1';q.min=$('unit').value==='kg'?'0.001':'1';}}; load();
}
async function load(){let data=[],error=null;try{for(let from=0;;from+=500){const r=await client.from('products').select('*').order('created_at',{ascending:false}).range(from,from+499);if(r.error){error=r.error;break}if(r.data?.length)data.push(...r.data);if(!r.data||r.data.length<500)break}}catch(e){error=e}if(error){$('list').innerHTML='<div class="notice">'+esc(error.message||error)+'</div>';return}products=data||[];$('list').innerHTML=products.length?products.map(p=>`<div class="product-admin-row"><img class="thumb" src="${esc(p.image_url||'')}" alt=""><div class="grow"><b>${esc(p.name)} ${p.is_featured?'<span class=\"featured-admin-badge\">⭐ Destaque</span>':''}</b><small>${esc(p.sector)} • ${p.unit==='kg'?'Kg':'Unidade'} • ${money(p.price)}${p.note?` • 📝 ${esc(p.note)}`:''} ${p.promo_price!=null?'• Promo '+money(p.promo_price):''} ${p.wholesale_price!=null?'• Atacado '+money(p.wholesale_price)+' / '+p.wholesale_qty+' '+(p.unit==='kg'?'kg':'un.') :''} • ${p.in_stock===false?'Sem estoque':'Em estoque'}</small></div><button class="outline-btn" onclick="edit('${p.id}')">Editar</button><button class="danger" onclick="removeProduct('${p.id}')">Excluir</button></div>`).join(''):'<div class="empty-state">Nenhum produto cadastrado.</div>'}
async function removeBackgroundLocal(file){
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=URL.createObjectURL(file)});
  const max=1800,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=c.getContext('2d');ctx.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);
  const d=ctx.getImageData(0,0,c.width,c.height), px=d.data, w=c.width,h=c.height;
  const samples=[]; for(let y=0;y<h;y+=Math.max(1,Math.floor(h/20))) for(let x=0;x<w;x+=Math.max(1,Math.floor(w/20))){if(x<Math.max(3,w*.08)||x>w-Math.max(3,w*.08)||y<Math.max(3,h*.08)||y>h-Math.max(3,h*.08)){const k=(y*w+x)*4;samples.push([px[k],px[k+1],px[k+2]])}}
  const bg=samples.reduce((a,v)=>[a[0]+v[0],a[1]+v[1],a[2]+v[2]],[0,0,0]).map(v=>v/Math.max(1,samples.length));
  const seen=new Uint8Array(w*h), q=[], tolerance=58;
  const add=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const n=y*w+x;if(seen[n])return;const k=n*4,dist=Math.hypot(px[k]-bg[0],px[k+1]-bg[1],px[k+2]-bg[2]);if(dist<tolerance){seen[n]=1;q.push(n)}};
  for(let x=0;x<w;x++){add(x,0);add(x,h-1)} for(let y=0;y<h;y++){add(0,y);add(w-1,y)}
  let head=0;while(head<q.length){const n=q[head++],x=n%w,y=Math.floor(n/w);add(x-1,y);add(x+1,y);add(x,y-1);add(x,y+1)}
  for(let n=0;n<w*h;n++) if(seen[n]) px[n*4+3]=0;
  ctx.putImageData(d,0,0);
  return await new Promise(r=>c.toBlob(r,'image/png',.92));
}
async function upload(file,removeBg=false){
  if(!file)return null;
  let uploadFile=file;
  if(removeBg){const status=$('imageBgStatus');if(status){status.textContent='Removendo o fundo da foto...';status.classList.add('show')}uploadFile=await removeBackgroundLocal(file);if(status)status.textContent='✅ Fundo removido. A imagem será salva com transparência.';}
  const path=`${crypto.randomUUID()}.${removeBg?'png':(file.name.split('.').pop()||'jpg').toLowerCase()}`;
  const {error}=await client.storage.from('product-images').upload(path,uploadFile,{upsert:false,contentType:uploadFile.type||'image/png'});if(error)throw error;
  return client.storage.from('product-images').getPublicUrl(path).data.publicUrl
}
async function save(e){
  e.preventDefault();
  const rawPrice=$('price').value.trim();
  const rawPromo=$('promo').value.trim();
  const rawWholesalePrice=$('wholesalePrice').value.trim();
  const rawWholesaleQty=$('wholesaleQty').value.trim();
  const toNum=v=>{let t=String(v??'').trim();if(t.includes(','))t=t.replace(/\./g,'').replace(',','.');return Number(t)};
  const price=toNum(rawPrice);
  const promo=rawPromo?toNum(rawPromo):null;
  const wholesalePrice=rawWholesalePrice?toNum(rawWholesalePrice):null;
  const wholesaleQty=rawWholesaleQty?toNum(rawWholesaleQty):null;
  const wholesaleMode=$('wholesaleMode').value;

  if(!Number.isFinite(price)||price<=0)return alert('Informe um preço normal válido maior que zero.');
  if(promo!==null&&(!Number.isFinite(promo)||promo<=0))return alert('Informe um preço promocional válido.');
  if(promo!==null&&promo>=price)return alert('O preço promocional deve ser menor que o preço normal.');
  if(wholesalePrice!==null&&(!Number.isFinite(wholesalePrice)||wholesalePrice<=0))return alert('Informe um preço de atacado válido.');
  if(wholesalePrice!==null&&wholesalePrice>=price)return alert('O preço de atacado deve ser menor que o preço normal.');
  if((wholesalePrice!==null)!==(wholesaleQty!==null))return alert('Preencha a quantidade e o preço de atacado juntos.');
  if(wholesaleQty!==null&&(!Number.isFinite(wholesaleQty)||wholesaleQty<=0))return alert('A quantidade de atacado deve ser maior que zero.');

  const payload={
    name:$('name').value.trim(),
    product_code:($('productCode')?.value||'').replace(/\D/g,'').slice(0,6)||null,
    price,
    unit:$('unit').value,
    sector:$('sector').value,
    in_stock:$('stock').value==='true',
    promo_price:promo,
    wholesale_mode:wholesalePrice!==null?wholesaleMode:null,
    wholesale_qty:wholesaleQty,
    wholesale_price:wholesalePrice,
    is_new:$('isNew').checked,
    note:$('productNote')?.value.trim()||null,
    active:true,
    updated_at:new Date().toISOString()
  };
  const f=$('image').files[0];
  try{
    if(f)payload.image_url=await upload(f,$('removeBg')?.checked===true);
    let r=editing?await client.from('products').update(payload).eq('id',editing):await client.from('products').insert(payload);
    // Compatibilidade com bancos antigos que ainda não possuem a coluna opcional `note`.
    // Nesse caso, salva o produto sem a observação em vez de bloquear todo o cadastro.
    if(r.error && /could not find the ['\"]note['\"] column of ['\"]products['\"] in the schema cache/i.test(r.error.message||'')){
      const {note,...payloadCompat}=payload;
      r=editing?await client.from('products').update(payloadCompat).eq('id',editing):await client.from('products').insert(payloadCompat);
      if(r.error)throw r.error;
      editing=null;
      productTab();
      alert('Produto salvo!\n\nA observação não foi salva porque o banco ainda não possui a coluna "note". Execute a migração MIGRACAO_PRODUTOS_NOTE.sql no Supabase para ativar esse campo.');
      return;
    }
    if(r.error)throw r.error;
    editing=null;
    productTab();
    alert('Produto salvo!');
  }catch(e){alert('Erro: '+e.message)}
}
async function edit(id){
  const cached=products.find(x=>String(x.id)===String(id));
  const p=cached || (await client.from('products').select('*').eq('id',id).maybeSingle()).data;
  if(!p){alert('Produto não encontrado.');return;}
  editing=p.id;
  await productTab();
  $('name').value=p.name||'';
  $('productCode').value=p.product_code||'';
  $('price').value=p.price??'';
  $('unit').value=p.unit||'unidade';
  $('sector').value=p.sector||sectors[0]||'';
  $('stock').value=String(p.in_stock!==false);
  $('promo').value=p.promo_price??'';
  $('wholesaleMode').value=p.wholesale_mode||'threshold';
  $('wholesaleQty').value=p.wholesale_qty??'';
  $('wholesalePrice').value=p.wholesale_price??'';
  $('isNew').checked=p.is_new===true;
  if($('productNote')) $('productNote').value=p.note||'';
  const form=$('pf'); if(form) form.scrollIntoView({behavior:'smooth',block:'start'});
}
async function removeProduct(id){if(!confirm('Excluir este produto?'))return;const {error}=await client.from('products').delete().eq('id',id);if(error)alert(error.message);else load()}
async function categoriesTab(){
  const {data,error}=await client.from('categories').select('id,name,created_at').order('name');
  if(error){$('tab').innerHTML=`${pageTitle('Categorias','Gerencie as categorias do catálogo.')}<div class="panel-card"><div class="notice">Não foi possível carregar as categorias: ${esc(error.message)}<br><small>Execute o bloco de categorias do supabase.sql.</small></div></div>`;return}
  categories=data||[];sectors=categories.map(x=>x.name);
  $('tab').innerHTML=`${pageTitle('Categorias','Adicione, edite e remova categorias do catálogo.')}
  <div class="panel-card"><div class="card-head"><div><h3>Nova categoria</h3><p>Ela ficará disponível no cadastro de produtos e no catálogo.</p></div></div><form id="categoryForm" class="category-add-form"><input id="newCategoryName" required maxlength=50 placeholder="Ex.: Bebidas"><button class="primary">+ Adicionar categoria</button></form></div>
  <div class="panel-card"><div class="card-head"><div><h3>Categorias cadastradas</h3><p>Promoções é automática e não precisa ser criada aqui.</p></div></div><div class="category-grid">${categories.map(c=>`<div class="category-card"><span>▦</span><b>${esc(c.name)}</b><small>Categoria do catálogo</small><button class="danger" onclick="removeCategory('${c.id}','${esc(c.name)}')">Excluir</button></div>`).join('')}<div class="category-card promo-category"><span>🔥</span><b>Promoções</b><small>Produtos com preço promocional</small><span class="muted">Automática</span></div></div></div>`;
  $('categoryForm').onsubmit=addCategory;
}
async function addCategory(e){
  e.preventDefault();const name=$('newCategoryName').value.trim();if(name.length<2)return alert('Digite um nome de categoria válido.');
  if(name.toLowerCase()==='promoções')return alert('A categoria Promoções é automática.');
  const {error}=await client.from('categories').insert({name});if(error)return alert('Não foi possível adicionar: '+error.message);categoriesTab();
}
async function removeCategory(id,name){
  const {count}=await client.from('products').select('id',{count:'exact',head:true}).eq('sector',name);
  if((count||0)>0)return alert('Não é possível excluir esta categoria porque existem produtos cadastrados nela. Altere os produtos para outra categoria primeiro.');
  if(!confirm(`Excluir a categoria “${name}”?`))return;
  const {error}=await client.from('categories').delete().eq('id',id);if(error)return alert('Não foi possível excluir: '+error.message);categoriesTab();
}
async function promoTab(){const {data,error}=await client.from('products').select('*').order('name');if(error)return $('tab').innerHTML='<div class="notice">'+esc(error.message)+'</div>';products=data||[];$('tab').innerHTML=`${pageTitle('Promoções','Defina ou remova preços promocionais.') }<div class="panel-card"><div class="promo-list">${products.map(p=>`<div class="promo-row"><div class="grow"><b>${esc(p.name)}</b><small>Preço normal: ${money(p.price)} ${p.promo_price!=null?'• Atual: '+money(p.promo_price):''}</small></div><input id="pr_${p.id}" type="number" step="0.01" min="0" value="${p.promo_price??''}" placeholder="Preço oferta"><button class="primary" onclick="setPromo('${p.id}')">Salvar</button></div>`).join('')}</div></div>`}
async function setPromo(id){const v=$(`pr_${id}`).value,p=products.find(x=>x.id===id)||(await client.from('products').select('*').eq('id',id).single()).data;if(v&&Number(v)>=Number(p.price))return alert('O preço promocional deve ser menor que o preço normal.');const {error}=await client.from('products').update({promo_price:v?Number(v):null,updated_at:new Date().toISOString()}).eq('id',id);if(error)alert(error.message);else{alert('Promoção atualizada!');promoTab()}}
async function bannersTab(){const {data,error}=await client.from('site_banners').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true});if(error){$('tab').innerHTML='<div class="notice">'+esc(error.message)+'</div>';return}const banners=data||[];$('tab').innerHTML=`${pageTitle('Banners','Até 10 banners no topo do site para todos os visitantes.') }<div class="panel-card"><p>Adicione imagens horizontais. Elas aparecem automaticamente no topo do catálogo.</p>${banners.length<10?`<form class="form" id="bf"><label class="full">Imagem do banner<input id="bannerImage" type="file" accept="image/*" required></label><div id="bannerPreview" class="full banner-preview"><span>Selecione uma imagem para visualizar</span></div><button class="primary full">Adicionar banner (${banners.length}/10)</button></form>`:`<div class="notice">Você já possui 10 banners. Remova um para adicionar outro.</div>`}<div class="banner-admin-list">${banners.length?banners.map((b,i)=>`<div class="banner-admin-row"><div class="banner-number">${i+1}</div><img src="${esc(b.image_url)}" alt="Banner ${i+1}" class="banner-admin-img"><div class="grow"><b>Banner ${i+1}</b><small>${b.active?'Visível no site':'Oculto'}</small></div><button class="danger" onclick="removeBanner('${b.id}','${esc(b.storage_path||'')}')">Remover</button></div>`).join(''):'<div class="empty-state">Nenhum banner cadastrado.</div>'}</div></div>`;if($('bf')){$('bannerImage').onchange=()=>{const f=$('bannerImage').files[0];if(!f)return;const url=URL.createObjectURL(f);$('bannerPreview').innerHTML=`<img src="${url}" alt="Pré-visualização">`};$('bf').onsubmit=addBanner}}
async function uploadBanner(file){const ext=(file.name.split('.').pop()||'jpg').toLowerCase(),path=`${crypto.randomUUID()}.${ext}`;const {error}=await client.storage.from('banner-images').upload(path,file,{upsert:false,contentType:file.type});if(error)throw error;return {path,url:client.storage.from('banner-images').getPublicUrl(path).data.publicUrl}}
async function addBanner(e){e.preventDefault();const {count,error:countError}=await client.from('site_banners').select('id',{count:'exact',head:true});if(countError)return alert('Erro: '+countError.message);if((count||0) >=10)return alert('Você pode ter no máximo 10 banners.');const f=$('bannerImage').files[0];if(!f)return alert('Selecione uma imagem.');try{const up=await uploadBanner(f);const {error}=await client.from('site_banners').insert({image_url:up.url,storage_path:up.path,sort_order:count||0,active:true});if(error){await client.storage.from('banner-images').remove([up.path]);throw error}alert('Banner adicionado!');bannersTab()}catch(e){alert('Erro ao adicionar banner: '+e.message)}}
async function removeBanner(id,path){if(!confirm('Remover este banner do site?'))return;const {error}=await client.from('site_banners').delete().eq('id',id);if(error)return alert('Erro: '+error.message);if(path)await client.storage.from('banner-images').remove([path]);const {data}=await client.from('site_banners').select('id').order('sort_order',{ascending:true});if(data)await Promise.all(data.map((b,i)=>client.from('site_banners').update({sort_order:i}).eq('id',b.id)));bannersTab()}
async function clientsTab(){const {data,error}=await client.from('profiles').select('id,email,role,created_at').order('created_at',{ascending:false});if(error){$('tab').innerHTML='<div class="notice">Não foi possível carregar os clientes: '+esc(error.message)+'</div>';return}const clients=data||[];$('tab').innerHTML=`${pageTitle('Clientes','Gerencie as contas cadastradas na loja.') }<div class="metric-grid compact"><div class="metric orange"><span>👥</span><div><small>Total de Clientes</small><strong>${clients.filter(c=>c.role!=='admin').length}</strong><em>Contas de clientes</em></div></div><div class="metric purple"><span>🛡</span><div><small>Administradores</small><strong>${clients.filter(c=>c.role==='admin').length}</strong><em>Contas administrativas</em></div></div></div><div class="panel-card"><div class="toolbar"><input id="clientSearch" placeholder="Buscar por e-mail..." oninput="filterClients()"><select id="clientFilter" onchange="filterClients()"><option value="all">Todas as contas</option><option value="user">Clientes</option><option value="admin">Administradores</option></select></div><div class="table-wrap"><table><thead><tr><th>E-mail</th><th>Tipo</th><th>Data de cadastro</th><th>Ações</th></tr></thead><tbody id="clientRows">${clientRows(clients)}</tbody></table></div></div>`;window.adminClients=clients}
function clientRows(clients){return clients.map(c=>`<tr><td><b>${esc(c.email||'Sem e-mail')}</b></td><td><span class="type-pill ${c.role==='admin'?'admin-pill':''}">${c.role==='admin'?'Administrador':'Cliente'}</span></td><td>${new Date(c.created_at).toLocaleString('pt-BR')}</td><td>${c.id!==currentUserId?`<button class="small-btn" onclick="resetClientPassword('${c.id}','${esc(c.email||'')}')">✉ Redefinir senha</button><button class="small-btn danger-outline" onclick="removeClient('${c.id}','${esc(c.email||'')}')">🗑 Remover</button>`:'<b class="muted">Sua conta</b>'}</td></tr>`).join('')||'<tr><td colspan="4" class="empty-state">Nenhum cliente cadastrado.</td></tr>'}
function filterClients(){const q=($('clientSearch')?.value||'').toLowerCase(),f=$('clientFilter')?.value||'all';const rows=(window.adminClients||[]).filter(c=>(!q||(c.email||'').toLowerCase().includes(q))&&(f==='all'||c.role===f));$('clientRows').innerHTML=clientRows(rows)}
async function resetClientPassword(id,email){if(!email)return alert('Este cliente não possui e-mail cadastrado.');if(!confirm('Enviar um link de redefinição de senha para '+email+'?'))return;const redirectTo=new URL('../login/',window.location.href).href;const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});if(error)alert('Erro: '+error.message);else alert('Link enviado para '+email+'.')}
async function removeClient(id,email){if(id===currentUserId)return alert('Você não pode remover sua própria conta.');if(!confirm('Remover definitivamente a conta de '+email+'?'))return;const {error}=await client.rpc('admin_delete_user',{target_user_id:id});if(error)return alert('Não foi possível remover: '+error.message);alert('Cliente removido.');clientsTab()}
async function ordersTab(){const {data,error}=await client.from('orders').select('*').order('created_at',{ascending:false});if(error){$('tab').innerHTML='<div class="notice">Não foi possível carregar os pedidos: '+esc(error.message)+'</div>';return}const orders=data||[];$('tab').innerHTML=`${pageTitle('Pedidos','Pedidos feitos pelo site e recebidos diretamente neste painel.') }<div class="order-filters"><button class="filter-btn active" onclick="filterOrders('all',this)">Todos</button><button class="filter-btn" onclick="filterOrders('received',this)">Novos</button><button class="filter-btn" onclick="filterOrders('accepted',this)">Aceitos</button><button class="filter-btn" onclick="filterOrders('separating',this)">Em separação</button><button class="filter-btn" onclick="filterOrders('waiting_payment',this)">Esperando pagamento</button><button class="filter-btn" onclick="filterOrders('ready_pickup',this)">Prontos para retirada</button><button class="filter-btn" onclick="filterOrders('completed',this)">Finalizados</button><button class="filter-btn" onclick="filterOrders('cancelled',this)">Cancelados</button></div><div id="ordersList" class="orders-list">${orders.length?orders.map(orderCard).join(''):'<div class="panel-card empty-state">Nenhum pedido recebido.</div>'}</div>`;window.adminOrders=orders}
function orderCard(o){
  const items=Array.isArray(o.items)?o.items:[];
  const rawPhone=String(o.customer_phone||'');
  let phone=rawPhone.replace(/\D/g,'');if((phone.length===10||phone.length===11)&&!phone.startsWith('55'))phone='55'+phone;
  const phoneLabel=rawPhone.trim()?rawPhone:'Não informado';
  const waButton=phone.length>=10&&phone.length<=15
    ? `<a class="whatsapp-btn order-whatsapp-link" href="https://wa.me/${phone}" target="_blank" rel="noopener">💬 WhatsApp ${esc(phoneLabel)}</a>`
    : `<span class="whatsapp-missing">📱 WhatsApp: não informado</span>`;
  return `<article class="order-card" data-status="${esc(o.status)}"><div class="order-head"><div><span class="order-number">Pedido #${o.order_number}</span><small>${new Date(o.created_at).toLocaleString('pt-BR')}</small></div><span class="status ${statusClass[o.status]||''}">${statusLabel[o.status]||o.status}</span></div><div class="order-body"><div class="customer-box"><b>Cliente</b><strong>${esc(o.customer_name)}</strong><span class="customer-phone">📱 <b>Contato:</b> ${esc(phoneLabel)}</span>${o.customer_email?`<span>✉ ${esc(o.customer_email)}</span>`:''}${o.document_number?`<span>🪪 ${o.document_type==='cnpj'?'CNPJ':'CPF'}: ${esc(o.document_number)}</span>`:''}${o.zipcode?`<span>📍 CEP: ${esc(o.zipcode)}</span>`:''}${o.sales_customer?`<span>💬 Cadastro no WhatsApp de vendas</span>`:''}${o.delivery_method?`<span>🚚 Forma: ${o.delivery_method==='delivery'?'Entrega':o.delivery_method==='store'?'Retirada em loja':'Retirada por aplicativo (Uber)'}</span>`:''}${o.note?`<div class="note">📝 ${esc(o.note)}</div>`:''}</div><div class="order-items">${items.map(i=>`<div><span>${esc(i.name)} × ${i.qty}</span><strong>${money(i.subtotal)}</strong></div>`).join('')}<div class="order-total"><span>Total</span><strong>${money(o.total)}</strong></div></div></div><div class="order-actions">${waButton}<div class="order-status-control"><label>Alterar status<select onchange="changeOrderStatus('${o.id}',this.value)">${Object.entries(statusLabel).filter(([k])=>k!=='cancelled').map(([k,v])=>`<option value="${k}" ${o.status===k?'selected':''}>${v}</option>`).join('')}</select></label></div>${o.status==='waiting_payment'?`<button class="whatsapp-btn" onclick="contactCustomer('${o.customer_phone}','${esc(o.customer_name)}','ready_payment',${o.order_number})">💬 Avisar para pagar</button>`:''}${['received','accepted','separating','waiting_payment','ready_pickup','paid'].includes(o.status)?`<button class="order-chat-btn" type="button" onclick="openOrderChat('${o.id}',${o.order_number},'${esc(o.customer_name||'Cliente')}',true)">💬 Chat do pedido</button><button class="order-edit-btn" type="button" onclick="openEditOrder('${o.id}')">✏ Alterar pedido</button>`:''}${o.status==='completed'?`<button class="whatsapp-btn" onclick="contactCustomer('${o.customer_phone}','${esc(o.customer_name)}','completed',${o.order_number})">💬 Contatar cliente</button>`:''}${['completed','cancelled'].includes(o.status)?'':`<button class="danger" onclick="cancelOrder('${o.id}')">Cancelar</button>`}<button class="danger-outline" onclick="deleteOrder('${o.id}',${o.order_number})">🗑 Apagar pedido</button></div></article>`
}
function filterOrders(status,btn){document.querySelectorAll('.filter-btn').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.order-card').forEach(c=>c.style.display=status==='all'||c.dataset.status===status?'block':'none')}

function orderEditEsc(v){return String(v??'').replace(/\\/g,'\\\\').replace(/`/g,'\\`').replace(/\$/g,'\\$')}
async function openEditOrder(orderId){
  const order=(window.adminOrders||[]).find(o=>String(o.id)===String(orderId));
  if(!order)return alert('Pedido não encontrado.');
  if(!['received','accepted','separating','waiting_payment','ready_pickup','paid'].includes(order.status))return alert('Este pedido já não está em andamento e não pode mais ser alterado.');
  const {data:prods,error}=await client.from('products').select('id,name,price,promo_price,unit,wholesale_price,wholesale_qty,wholesale_mode,image_url,active').eq('active',true).order('name');
  if(error)return alert('Não foi possível carregar os produtos: '+error.message);
  const productList=prods||[];
  const current=Array.isArray(order.items)?order.items:[];
  const rows=current.map(i=>({product_id:i.product_id||i.id,qty:Number(i.qty)||1}));
  const modal=document.createElement('div');modal.id='editOrderModal';modal.className='order-edit-modal';
  modal.innerHTML=`<div class="order-edit-box"><button class="order-chat-close" type="button" onclick="closeEditOrder()">×</button><div class="order-edit-head"><div><h2>✏ Alterar pedido #${order.order_number}</h2><p>Cliente: ${esc(order.customer_name||'Cliente')}</p></div><span>Em separação</span></div><div class="order-edit-note">Você pode adicionar/remover produtos e alterar quantidades. O sistema recalcula automaticamente o atacado e o total usando os preços atuais cadastrados.</div><div id="editOrderRows" class="order-edit-rows"></div><div class="order-edit-add"><select id="editOrderProduct"><option value="">Adicionar produto...</option>${productList.map(p=>`<option value="${p.id}">${esc(p.name)} — ${money(p.price)}</option>`).join('')}</select><button class="secondary" type="button" onclick="addEditOrderProduct()">+ Adicionar</button></div><div class="order-edit-summary"><span>Novo total</span><strong id="editOrderTotal">${money(order.total)}</strong></div><div class="order-edit-actions"><button class="secondary" type="button" onclick="closeEditOrder()">Cancelar</button><button class="primary" type="button" onclick="saveEditedOrder('${order.id}')">💾 Salvar alteração</button></div></div>`;
  document.body.appendChild(modal);window.editingOrderData={order,productList,rows};renderEditOrderRows();modal.addEventListener('click',e=>{if(e.target===modal)closeEditOrder()});
}
function closeEditOrder(){document.getElementById('editOrderModal')?.remove();window.editingOrderData=null}
function renderEditOrderRows(){
  const state=window.editingOrderData,el=document.getElementById('editOrderRows');if(!state||!el)return;
  const map=new Map(state.productList.map(p=>[String(p.id),p]));
  el.innerHTML=state.rows.length?state.rows.map((r,i)=>{const p=map.get(String(r.product_id));if(!p)return '';return `<div class="order-edit-row"><img src="${esc(p.image_url||'')}" alt=""><div class="grow"><b>${esc(p.name)}</b><small>${money(p.price)} / ${p.unit==='kg'?'kg':'un.'}</small></div><label>Quantidade<input type="number" min="${p.unit==='kg'?'0.001':'1'}" max="9999" step="${p.unit==='kg'?'0.001':'1'}" value="${Number(r.qty)|| (p.unit==='kg'?0.001:1)}" onchange="changeEditOrderQty(${i},this.value)"></label><button class="danger" type="button" onclick="removeEditOrderProduct(${i})">Remover</button></div>`}).join(''):'<div class="empty-state">Nenhum produto no pedido.</div>';
  let total=0;state.rows.forEach(r=>{const p=map.get(String(r.product_id));if(p)total+=calculateEditLine(p,Number(r.qty)||0)});$('editOrderTotal').textContent=money(total);
}
function calculateEditLine(p,qty){if(!Number.isFinite(qty)||qty<0.001)return 0;const base=Number(p.promo_price)>0&&Number(p.promo_price)<Number(p.price)?Number(p.promo_price):Number(p.price);const wp=Number(p.wholesale_price),wq=Number(p.wholesale_qty);if(wp>0&&wq>0&&wp<base&&p.wholesale_mode==='block'){const w=Math.floor(qty/wq)*wq;return w*wp+(qty-w)*base}if(wp>0&&wq>0&&wp<base&&p.wholesale_mode==='threshold'&&qty>=wq)return qty*wp;return qty*base}
function addEditOrderProduct(){const state=window.editingOrderData,sel=$('editOrderProduct');if(!state||!sel?.value)return;const id=String(sel.value);const existing=state.rows.find(r=>String(r.product_id)===id);if(existing)existing.qty=(Number(existing.qty)||0)+1;else state.rows.push({product_id:id,qty:1});sel.value='';renderEditOrderRows()}
function changeEditOrderQty(i,value){const state=window.editingOrderData;if(!state)return; const r=state.rows[i], p=state.productList.find(x=>String(x.id)===String(r?.product_id)); const q=Number(value); const valid=p?.unit==='kg'?Number.isFinite(q)&&q>=0.001:q>=1&&Number.isInteger(q); if(!valid)return renderEditOrderRows();state.rows[i].qty=Math.min(Number(q.toFixed(3)),9999);renderEditOrderRows()}
function removeEditOrderProduct(i){const state=window.editingOrderData;if(!state)return;state.rows.splice(i,1);renderEditOrderRows()}
async function saveEditedOrder(orderId){
  const state=window.editingOrderData;if(!state)return;if(!state.rows.length)return alert('O pedido precisa ter pelo menos um produto.');
  const clean=state.rows.map(r=>({product_id:r.product_id,qty:Number(r.qty)}));
  if(clean.some(r=>!r.product_id||!Number.isFinite(r.qty)||r.qty<=0||r.qty>9999))return alert('Verifique as quantidades dos produtos.');
  const btn=document.querySelector('#editOrderModal .primary');if(btn){btn.disabled=true;btn.textContent='Salvando...'}
  const {data,error}=await client.rpc('admin_update_order_items',{target_order_id:orderId,new_items:clean});
  if(error){if(btn){btn.disabled=false;btn.textContent='💾 Salvar alteração'}return alert('Não foi possível alterar o pedido: '+error.message)}
  closeEditOrder();alert('Pedido alterado com sucesso. O total e os preços de atacado foram recalculados.');await ordersTab();refreshOrderBadge();
}
async function changeOrderStatus(id,status){
  if(!statusLabel[status])return;
  const {error}=await client.from('orders').update({status,updated_at:new Date().toISOString()}).eq('id',id);
  if(error)return alert('Não foi possível alterar o status: '+error.message);
  await ordersTab();refreshOrderBadge();
}
async function markReady(id){return changeOrderStatus(id,'waiting_payment')}
async function finalizeAndNotify(id,phone,name,number){const r=await client.from('orders').update({status:'waiting_payment',updated_at:new Date().toISOString()}).eq('id',id);if(r.error)return alert(r.error.message);refreshOrderBadge();contactCustomer(phone,name,'ready_payment',number);ordersTab()}
async function markPaid(id){return changeOrderStatus(id,'paid')}
async function markCompleted(id){return changeOrderStatus(id,'completed')}
async function cancelOrder(id){if(!confirm('Cancelar este pedido?'))return;const {error}=await client.from('orders').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',id);if(error)return alert(error.message);ordersTab();refreshOrderBadge()}
async function deleteOrder(id,number){
  if(!confirm('Apagar definitivamente o pedido #'+number+'? Esta ação não pode ser desfeita.'))return;
  const {error}=await client.from('orders').delete().eq('id',id);
  if(error)return alert('Não foi possível apagar o pedido: '+error.message);
  await ordersTab();refreshOrderBadge();
}
function contactCustomer(phone,name,status,number){let p=String(phone||'').replace(/\D/g,'');if((p.length===10||p.length===11)&&!p.startsWith('55'))p='55'+p;let msg='';if(status==='ready_payment')msg=`Olá, ${name}! Seu pedido #${number} foi conferido e está pronto para pagamento. Por favor, entre em contato conosco para concluir o pagamento. 🍔`;else if(status==='paid')msg=`Olá, ${name}! Recebemos a confirmação do pagamento do pedido #${number}. Estamos entrando em contato para combinar a entrega/retirada. Obrigado!`;else msg=`Olá, ${name}! Estamos falando sobre o seu pedido #${number} da Macrofood.`;location.href=`https://wa.me/${p}?text=${encodeURIComponent(msg)}`}


let adminOrderChatTimer=null;
async function openOrderChat(orderId,orderNumber,customerName,isAdmin=true){
  if(window.activeAdminOrderChat===orderId)return;
  closeOrderChat(); window.activeAdminOrderChat=orderId;
  const modal=document.createElement('div'); modal.id='orderChatModal'; modal.className='order-chat-modal';
  modal.innerHTML=`<div class="order-chat-box"><button class="order-chat-close" type="button" onclick="closeOrderChat()">×</button><div class="order-chat-head"><div><h2>💬 Pedido #${orderNumber}</h2><p>${esc(customerName||'Cliente')} • conversa do pedido</p></div><span>Atendimento</span></div><div id="orderChatMessages" class="order-chat-messages"><div class="support-empty">Carregando conversa...</div></div><form id="orderChatForm" class="order-chat-compose"><textarea id="orderChatText" maxlength="1000" placeholder="Digite uma mensagem para o cliente..." required></textarea><button class="primary" type="submit">Enviar</button></form></div>`;
  document.body.appendChild(modal); modal.addEventListener('click',e=>{if(e.target===modal)closeOrderChat()});
  document.getElementById('orderChatForm').onsubmit=async e=>{
    e.preventDefault(); const input=document.getElementById('orderChatText'),text=input.value.trim(); if(!text)return;
    const uid=await getOrderUserId(orderId); if(!uid)return alert('Não foi possível identificar o cliente deste pedido.');
    const {error}=await client.from('order_chat_messages').insert({order_id:orderId,user_id:uid,sender_role:'admin',message:text});
    if(error)return alert('Não foi possível enviar: '+error.message); input.value=''; loadAdminOrderChatMessages(orderId);
  };
  await loadAdminOrderChatMessages(orderId); adminOrderChatTimer=setInterval(()=>loadAdminOrderChatMessages(orderId),4000); setTimeout(()=>document.getElementById('orderChatText')?.focus(),100);
}
function closeOrderChat(){if(adminOrderChatTimer){clearInterval(adminOrderChatTimer);adminOrderChatTimer=null;}window.activeAdminOrderChat=null;document.getElementById('orderChatModal')?.remove();}
async function getOrderUserId(orderId){const {data}=await client.from('orders').select('user_id').eq('id',orderId).maybeSingle();return data?.user_id||null;}
async function loadAdminOrderChatMessages(orderId){const el=document.getElementById('orderChatMessages');if(!el||window.activeAdminOrderChat!==orderId)return;const {data,error}=await client.from('order_chat_messages').select('id,user_id,sender_role,message,created_at').eq('order_id',orderId).order('created_at',{ascending:true});if(error){el.innerHTML='<div class="support-empty">Não foi possível carregar o chat: '+esc(error.message)+'</div>';return;}const wasNear=el.scrollHeight-el.scrollTop-el.clientHeight<90;el.innerHTML=(data||[]).length?(data||[]).map(m=>`<div class="order-chat-msg ${m.sender_role==='admin'?'admin':'user'}"><div>${esc(m.message).replace(/\n/g,'<br>')}</div><small>${m.sender_role==='admin'?'Você':'Cliente'} • ${new Date(m.created_at).toLocaleString('pt-BR')}</small></div>`).join(''):'<div class="support-empty">Nenhuma mensagem ainda. O cliente poderá falar aqui enquanto o pedido estiver em andamento.</div>';if(wasNear)el.scrollTop=el.scrollHeight;}

async function suggestionsTab(){
  const {data,error}=await client.from('product_suggestions').select('id,user_id,product_name,note,storage_path,created_at').order('created_at',{ascending:false});
  if(error){$('tab').innerHTML='<div class="notice">Não foi possível carregar as sugestões: '+esc(error.message)+'</div>';return}
  const rows=data||[];
  if(!rows.length){
    $('tab').innerHTML=`${pageTitle('Sugestões de clientes','Fotos e sugestões enviadas somente por clientes logados.')}<div class="panel-card empty-state">💡 Nenhuma sugestão recebida ainda.</div>`;
    return;
  }
  const userIds=[...new Set(rows.map(x=>x.user_id).filter(Boolean))];
  let profiles=[];
  if(userIds.length){
    const r=await client.from('profiles').select('id,email,nickname,avatar_url').in('id',userIds);
    profiles=r.data||[];
  }
  const map=new Map(profiles.map(x=>[x.id,x]));
  const cards=await Promise.all(rows.map(async s=>{
    let url='';
    if(s.storage_path){
      const signed=await client.storage.from('product-suggestions').createSignedUrl(s.storage_path,3600);
      url=signed.data?.signedUrl||'';
    }
    const profile=map.get(s.user_id)||{};
    return `<article class="suggestion-card">${url?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer"><img src="${esc(url)}" alt="Foto sugerida por cliente"></a>`:`<div class="suggestion-image-missing">📷 Foto indisponível</div>`}<div class="suggestion-card-body"><h3>${esc(s.product_name)}</h3><p><b>Cliente:</b> ${esc(profile.nickname||'Cliente')} ${profile.email?`• ${esc(profile.email)}`:''}</p>${s.note?`<p><b>Observação:</b> ${esc(s.note)}</p>`:''}<small>${new Date(s.created_at).toLocaleString('pt-BR')}</small><div class="suggestion-card-actions">${url?`<a class="outline-btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">🔎 Ver foto</a>`:''}<button class="danger" onclick="removeSuggestion('${s.id}','${esc(s.storage_path||'')}')">🗑 Excluir</button></div></div></article>`;
  }));
  $('tab').innerHTML=`${pageTitle('Sugestões de clientes','Veja as fotos e produtos sugeridos pelos clientes. Essas imagens não aparecem no catálogo público.')}<div class="metric-grid compact"><div class="metric orange"><span>💡</span><div><small>Total de sugestões</small><strong>${rows.length}</strong><em>Enviadas por clientes</em></div></div></div><div class="suggestion-admin-grid">${cards.join('')}</div>`;
}
async function removeSuggestion(id,path){if(!confirm('Excluir esta sugestão e a foto enviada pelo cliente?'))return;const {error}=await client.from('product_suggestions').delete().eq('id',id);if(error)return alert('Não foi possível excluir: '+error.message);if(path)await client.storage.from('product-suggestions').remove([path]);suggestionsTab()}

async function supportTab(){
  const {data:rows,error}=await client.from('support_messages').select('id,user_id,sender_role,message,created_at').order('created_at',{ascending:false});
  if(error){$('tab').innerHTML='<div class="notice">Não foi possível carregar o suporte: '+esc(error.message)+'</div>';return}
  const all=rows||[],ids=[...new Set(all.map(x=>x.user_id).filter(Boolean))];let profiles=[];
  if(ids.length){const r=await client.from('profiles').select('id,email,nickname,avatar_url').in('id',ids);profiles=r.data||[]}
  const {data:states}=await client.from('support_conversations').select('user_id,status,resolved_at,admin_id').in('user_id',ids.length?ids:['00000000-0000-0000-0000-000000000000']);
  const stateMap=new Map((states||[]).map(x=>[x.user_id,x]));const map=new Map(profiles.map(p=>[p.id,p]));
  const convs=ids.map(uid=>{const list=all.filter(m=>m.user_id===uid);const p=map.get(uid)||{};const st=stateMap.get(uid)||{status:'open'};return {uid,p,last:list[0],count:list.length,status:st.status,resolved_at:st.resolved_at}});
  window.supportRows=all;window.supportProfiles=map;window.supportStates=stateMap;
  $('tab').innerHTML=`${pageTitle('Suporte ao cliente','Converse com clientes e finalize os atendimentos.')}<div class="support-admin-layout"><div class="support-conversations" id="supportConversations">${convs.length?convs.map((c,i)=>`<button class="support-conv ${i===0?'active':''}" onclick="openSupportConversation('${c.uid}',this)"><b>${esc(c.p.nickname||'Cliente')} ${c.status==='resolved'?'<span class="resolved-chip">✓ Resolvido</span>':''}</b><small>${esc(c.p.email||'')} • ${c.count} mensagem(ns)</small><small>${esc((c.last?.message||'').slice(0,70))}</small></button>`).join(''):'<div class="support-empty">Nenhuma conversa ainda.</div>'}</div><div class="admin-chat-card"><div class="admin-chat-head"><div><h3 id="supportChatTitle">${convs.length?esc(convs[0].p.nickname||'Cliente'):'Selecione um cliente'}</h3><small id="supportChatEmail">${convs.length?esc(convs[0].p.email||''):''}</small><small class="support-counterpart">Atendendo: ${convs.length?esc(currentAdminName):'Administrador'}</small></div><span id="adminSupportStatus" class="support-status"></span></div><div id="adminChatMessages" class="admin-chat-messages">${convs.length?'':'<div class="support-empty">Selecione uma conversa.</div>'}</div><form id="adminChatForm" class="admin-chat-compose" style="${convs.length?'':'display:none'}"><textarea id="adminChatText" maxlength="1000" placeholder="Digite uma resposta..."></textarea><button class="primary">Enviar</button></form><div id="adminSupportActions" class="admin-support-actions"></div></div></div>`;
  window.selectedSupportUser=window.selectedSupportUser||convs[0]?.uid||null;
  if(window.selectedSupportUser&&convs.some(c=>c.uid===window.selectedSupportUser)){
    const c=convs.find(c=>c.uid===window.selectedSupportUser);activateSupportConversation(c);
  }else if(convs[0]){window.selectedSupportUser=convs[0].uid;activateSupportConversation(convs[0])}
  refreshSupportBadge();
}
function activateSupportConversation(c){
  document.querySelectorAll('.support-conv').forEach(x=>x.classList.remove('active'));
  const btn=[...document.querySelectorAll('.support-conv')].find(x=>x.getAttribute('onclick')?.includes(c.uid));if(btn)btn.classList.add('active');
  window.selectedSupportUser=c.uid;$('supportChatTitle').textContent=c.p.nickname||'Cliente';$('supportChatEmail').textContent=c.p.email||'';const counterpart=document.querySelector('.support-counterpart');if(counterpart)counterpart.textContent='Atendendo: '+currentAdminName;renderAdminChat(c.uid);$('adminChatForm').style.display='flex';$('adminChatForm').onsubmit=sendAdminSupport;updateAdminSupportState(c);
}
function openSupportConversation(uid,btn){
  const p=window.supportProfiles.get(uid)||{};const st=window.supportStates?.get(uid)||{status:'open'};activateSupportConversation({uid,p,status:st.status,resolved_at:st.resolved_at,admin_id:st.admin_id||null});
}
function updateAdminSupportState(c){
  const status=$('adminSupportStatus'),actions=$('adminSupportActions');if(status){status.textContent=c.status==='resolved'?'✓ Problema resolvido':'● Atendimento em andamento';status.className='support-status '+(c.status==='resolved'?'resolved':'open')}
  if(actions)actions.innerHTML=c.status==='resolved'?`<button class="secondary" type="button" onclick="reopenAdminSupport('${c.uid}')">↩ Reabrir conversa</button>`:`<button class="resolve-btn" type="button" onclick="resolveAdminSupport('${c.uid}')">✓ Problema resolvido</button>`;
  const form=$('adminChatForm');if(form)form.style.display='flex';
}
function renderAdminChat(uid){const rows=(window.supportRows||[]).filter(m=>m.user_id===uid).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));$('adminChatMessages').innerHTML=rows.length?rows.map(m=>`<div class="support-msg ${m.sender_role==='admin'?'admin':'user'}">${esc(m.message).replace(/\n/g,'<br>')}<small>${m.sender_role==='admin'?currentAdminName:'Cliente'} • ${new Date(m.created_at).toLocaleString('pt-BR')}</small></div>`).join(''):'<div class="support-empty">Nenhuma mensagem.</div>';const el=$('adminChatMessages');el.scrollTop=el.scrollHeight}
async function sendAdminSupport(e){e.preventDefault();const text=$('adminChatText').value.trim(),uid=window.selectedSupportUser;if(!text||!uid)return;const {error}=await client.from('support_conversations').upsert({user_id:uid,status:'open',resolved_at:null,updated_at:new Date().toISOString(),admin_id:currentUserId},{onConflict:'user_id'});if(error)return alert(error.message);const {error:sendError}=await client.from('support_messages').insert({user_id:uid,sender_role:'admin',sender_id:currentUserId,message:text});if(sendError)return alert('Não foi possível enviar: '+sendError.message);$('adminChatText').value='';const {data}=await client.from('support_messages').select('id,user_id,sender_role,message,created_at').order('created_at',{ascending:false});window.supportRows=data||[];if(window.supportStates)window.supportStates.set(uid,{user_id:uid,status:'open'});renderAdminChat(uid);updateAdminSupportState({uid,status:'open'});}
async function resolveAdminSupport(uid){if(!confirm('Marcar esta conversa como problema resolvido?'))return;const {error}=await client.from('support_conversations').upsert({user_id:uid,status:'resolved',resolved_at:new Date().toISOString(),updated_at:new Date().toISOString(),admin_id:currentUserId},{onConflict:'user_id'});if(error)return alert('Não foi possível finalizar: '+error.message);window.supportStates.set(uid,{user_id:uid,status:'resolved'});updateAdminSupportState({uid,status:'resolved'});const btn=[...document.querySelectorAll('.support-conv')].find(x=>x.getAttribute('onclick')?.includes(uid));if(btn&&!btn.innerHTML.includes('Resolvido'))btn.querySelector('b').insertAdjacentHTML('beforeend',' <span class="resolved-chip">✓ Resolvido</span>');}
async function reopenAdminSupport(uid){const {error}=await client.from('support_conversations').upsert({user_id:uid,status:'open',resolved_at:null,updated_at:new Date().toISOString(),admin_id:currentUserId},{onConflict:'user_id'});if(error)return alert(error.message);window.supportStates.set(uid,{user_id:uid,status:'open'});updateAdminSupportState({uid,status:'open'});}
async function refreshSupportBadge(){const {count}=await client.from('support_messages').select('id',{count:'exact',head:true}).eq('sender_role','user');const b=$('supportBadge');if(b){b.textContent=count||0;b.classList.toggle('hidden',!count)}}
async function refreshSupportConversation(){if(!document.querySelector('[data-nav=\"support\"]')?.classList.contains('active'))return;const {data,error}=await client.from('support_messages').select('id,user_id,sender_role,message,created_at').order('created_at',{ascending:false});if(error)return;window.supportRows=data||[];if(window.selectedSupportUser)renderAdminChat(window.selectedSupportUser);refreshSupportBadge()}
setInterval(refreshSupportConversation,5000)
async function settingsTab(){
  const {data,error}=await client.from('site_settings').select('key,value').in('key',['whatsapp_orders','orders_enabled','delivery_enabled','store_pickup_enabled','uber_pickup_enabled']);
  if(error){$('tab').innerHTML=`${pageTitle('Configurações','Ajustes básicos do atendimento.')}<div class="panel-card"><div class="notice">${esc(error.message)}</div></div>`;return}
  const m=Object.fromEntries((data||[]).map(x=>[x.key,String(x.value).toLowerCase()]));
  $('tab').innerHTML=`${pageTitle('Configurações','Controle de pedidos, formas de retirada e atendimento.')}
  <div class="panel-card"><div class="card-head"><div><h3>🛒 Função de pedidos</h3><p>Quando desativada, o catálogo continua visível, mas o cliente não consegue finalizar pedidos.</p></div></div>
  <label class="settings-switch"><input id="ordersEnabled" type="checkbox" ${m.orders_enabled!=='false'?'checked':''}><span>Permitir que clientes façam pedidos</span></label>
  <div class="maintenance-preview">Mensagem exibida quando estiver desativado: <b>“Função de pedidos está em manutenção, voltaremos em breve.”</b></div>
  </div>
  <div class="panel-card"><div class="card-head"><div><h3>🚚 Formas de recebimento</h3><p>O administrador pode deixar cada opção disponível ou indisponível.</p></div></div>
  <label class="settings-switch"><input id="deliveryEnabled" type="checkbox" ${m.delivery_enabled!=='false'?'checked':''}><span>🚚 Entrega</span></label>
  <label class="settings-switch"><input id="storeEnabled" type="checkbox" ${m.store_pickup_enabled!=='false'?'checked':''}><span>🏪 Retirada em loja</span></label>
  <label class="settings-switch"><input id="uberEnabled" type="checkbox" ${m.uber_pickup_enabled!=='false'?'checked':''}><span>🚗 Retirada por aplicativo (Uber)</span></label>
  <div class="notice">Na opção Uber, o cliente será orientado a entrar em contato pelo <b>+55 (81) 97117-8793</b> para informar a placa do veículo.</div>
  </div>
  <div class="panel-card"><label>WhatsApp da Macrofood<input id="wa" value="${esc(m.whatsapp_orders||'5581971178793')}" placeholder="5581999999999"></label><button class="primary" onclick="saveSiteSettings()">Salvar configurações</button></div>`;
}
async function saveSiteSettings(){
  const vals={
    whatsapp_orders:($('wa').value||'').replace(/\D/g,''),
    orders_enabled:$('ordersEnabled').checked?'true':'false',
    delivery_enabled:$('deliveryEnabled').checked?'true':'false',
    store_pickup_enabled:$('storeEnabled').checked?'true':'false',
    uber_pickup_enabled:$('uberEnabled').checked?'true':'false'
  };
  for(const [key,value] of Object.entries(vals)){const {error}=await client.from('site_settings').upsert({key,value});if(error)return alert('Erro ao salvar '+key+': '+error.message);}
  alert('Configurações salvas!');
}
init();
