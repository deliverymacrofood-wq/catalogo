const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const msg=(t,c='#a00000')=>{const el=$('msg');if(el){el.textContent=t;el.style.color=c}};
async function updateCatalogHeader(){try{const {data:{session}}=await client.auth.getSession();if(!session)return;const {data:p}=await client.from('profiles').select('nickname,avatar_url').eq('id',session.user.id).maybeSingle();}catch(e){}}
async function init(){
  try{
    const {data:{session},error}=await client.auth.getSession();
    if(error) throw error;
    const isRecovery=window.location.hash.includes('type=recovery') || new URLSearchParams(window.location.search).get('type')==='recovery';
    if(session && isRecovery){return showResetPassword()}
    if(session){
      const {data:p}=await client.from('profiles').select('role,email,nickname,avatar_url').eq('id',session.user.id).maybeSingle();
      const nickname=p?.nickname?.trim()||session.user.user_metadata?.nickname?.trim()||'Cliente';
      const avatar=p?.avatar_url||'';
      $('authApp').innerHTML=`<div class="account-page">
        <section class="account-hero-card">
          <div class="account-identity">
            <div class="profile-photo-wrap"><img id="profilePhoto" class="profile-photo" src="${esc(avatar||'')}" alt="Foto de ${esc(nickname)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="profile-photo-placeholder" style="display:${avatar?'none':'flex'}">👤</div></div>
            <div class="account-intro"><h2>Olá, ${esc(nickname)}! <span>👋</span></h2><p>Gerencie suas informações, pedidos e preferências.</p><div class="account-meta"><span>✉️ ${esc(session.user.email)}</span><span>👤 Cliente</span></div></div>
          </div>
          <label class="photo-label account-photo-btn">📷 Alterar foto<input id="avatarInput" type="file" accept="image/*" hidden></label>
        </section>

        <h3 class="account-section-title">Acesso rápido</h3>
        <section class="account-quick-grid">
          <a class="account-quick-card" href="pedidos.html"><span class="quick-icon wine">🛍</span><span><b>Meus pedidos</b><small>Acompanhe e gerencie seus pedidos.</small></span><strong>›</strong></a>
          <div class="account-quick-card"><span class="quick-icon orange">👤</span><span><b>Dados da conta</b><small>Seu apelido e e-mail cadastrados.</small></span><strong>✓</strong></div>
          <a class="account-quick-card" href="suporte.html"><span class="quick-icon purple">💬</span><span><b>Suporte ao cliente</b><small>Converse diretamente com a MacroFood.</small></span><strong>›</strong></a>
          <div class="account-quick-card"><span class="quick-icon green">🔒</span><span><b>Segurança</b><small>Senha protegida pelo Supabase.</small></span><strong>✓</strong></div>
          ${p?.role==='admin'?'<a class="account-quick-card admin-quick" href="admin.html"><span class="quick-icon purple">⚙️</span><span><b>Painel do administrador</b><small>Acessar a área administrativa.</small></span><strong>›</strong></a>':''}
        </section>

        <h3 class="account-section-title">Dados da conta</h3>
        <section class="account-edit-card">
          <form id="nicknameForm" class="nickname-form"><label>Apelido<input id="nicknameEdit" type="text" maxlength="30" value="${esc(nickname)}" placeholder="Seu apelido"></label><button class="primary" type="submit">Salvar apelido</button></form>
          <p id="nicknameMsg" class="muted" style="margin:8px 0 0;font-size:12px">O apelido aparece no topo do catálogo quando você estiver logado.</p>
        </section>
        <h3 class="account-section-title">Gerenciar conta</h3>
        <section class="account-actions-card">
          <button id="logout" class="account-action"><span class="action-icon">↪</span><span><b>Sair da conta</b><small>Encerra sua sessão neste dispositivo.</small></span><strong>›</strong></button>
          <a class="account-action" href="pedidos.html"><span class="action-icon">📦</span><span><b>Meus pedidos</b><small>Veja o andamento dos seus pedidos.</small></span><strong>›</strong></a>
          <a class="account-action" href="suporte.html"><span class="action-icon">💬</span><span><b>Suporte ao cliente</b><small>Fale com o administrador pelo chat.</small></span><strong>›</strong></a>
          <a class="account-action" href="index.html"><span class="action-icon">←</span><span><b>Voltar ao catálogo</b><small>Continuar comprando.</small></span><strong>›</strong></a>
        </section>
        <p class="account-footer">♥ Obrigado por escolher a MacroFood!<small>Qualidade e praticidade para o seu dia a dia.</small></p>
      </div>`;
      $('avatarInput').onchange=()=>uploadAvatar($('avatarInput').files[0]);
      $('nicknameForm').onsubmit=async(e)=>{e.preventDefault();const value=$('nicknameEdit').value.trim();if(value.length<2||value.length>30){$('nicknameMsg').textContent='O apelido deve ter entre 2 e 30 caracteres.';return}const {error}=await client.from('profiles').update({nickname:value}).eq('id',session.user.id);if(error){$('nicknameMsg').textContent='Não foi possível salvar: '+error.message;return}await client.auth.updateUser({data:{nickname:value}});$('nicknameMsg').textContent='Apelido atualizado com sucesso!';$('nicknameMsg').style.color='#23733a';const title=document.querySelector('.account-intro h2');if(title)title.innerHTML='Olá, '+esc(value)+'! <span>👋</span>';updateCatalogHeader();};
      $('logout').onclick=async()=>{await client.auth.signOut();location.href='index.html'};
      return;
    }
    showLogin();
  }catch(e){
    $('authApp').innerHTML=`<div class="panel login"><h2>Erro ao carregar</h2><p>${esc(e.message)}</p><a class="secondary" href="index.html">Voltar ao catálogo</a></div>`;
  }
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function showResetPassword(){
  $('authApp').innerHTML=`<div class="panel login"><h2>Nova senha</h2><p>Digite sua nova senha para concluir a recuperação da conta.</p><input id="newPass" type="password" autocomplete="new-password" placeholder="Nova senha (mínimo 6 caracteres)"><input id="newPass2" type="password" autocomplete="new-password" placeholder="Repita a nova senha"><button class="primary" id="savePass">Salvar nova senha</button><p id="msg"></p></div>`;
  $('savePass').onclick=async()=>{
    const a=$('newPass').value,b=$('newPass2').value;
    if(a.length<6)return msg('A senha precisa ter pelo menos 6 caracteres.');
    if(a!==b)return msg('As senhas não são iguais.');
    const {error}=await client.auth.updateUser({password:a});
    if(error)return msg('Não foi possível alterar a senha: '+error.message);
    msg('Senha alterada com sucesso! Você já pode entrar com a nova senha.','green');
    setTimeout(()=>{history.replaceState({},document.title,'login.html');location.href='login.html'},900);
  };
}
let signupMethod='email';
let pendingPhone='';
let pendingPhonePassword='';

function showLogin(){
  $('authApp').innerHTML=`<div class="panel login auth-card">
    <div class="auth-brand-mini"><span>👤</span><div><h2>Entrar na minha conta</h2><p>Acesse seus pedidos, suporte e seus dados.</p></div></div>
    <div class="auth-choice"><button type="button" class="active" id="loginEmailChoice" onclick="setLoginMethod('email')">✉️ E-mail</button><button type="button" id="loginPhoneChoice" onclick="setLoginMethod('phone')">📱 Celular</button></div>
    <div id="loginIdentity"><input id="email" type="email" autocomplete="email" placeholder="E-mail" required></div>
    <input id="pass" type="password" autocomplete="current-password" placeholder="Senha" required>
    <button class="primary auth-main-btn" id="login">Entrar</button>
    <button class="secondary auth-register-btn" id="goSignup">Ainda não tenho conta — Criar conta</button>
    <button class="link-btn" id="forgot">Esqueci minha senha</button>
    <p id="msg"></p>
  </div>`;
  $('login').onclick=login;$('goSignup').onclick=showSignup;$('forgot').onclick=forgot;
  $('pass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
}
function setLoginMethod(method){
  const emailBtn=$('loginEmailChoice'),phoneBtn=$('loginPhoneChoice'),box=$('loginIdentity');
  if(!emailBtn||!phoneBtn||!box)return;
  emailBtn.classList.toggle('active',method==='email'); phoneBtn.classList.toggle('active',method==='phone');
  box.innerHTML=method==='email'?'<input id="email" type="email" autocomplete="email" placeholder="E-mail" required>':'<input id="email" type="tel" autocomplete="tel" placeholder="Celular com DDD" inputmode="tel" required>';
  box.dataset.method=method;
}
function showSignup(){
  $('authApp').innerHTML=`<div class="panel login auth-card">
    <div class="auth-brand-mini"><span>✨</span><div><h2>Criar minha conta</h2><p>Escolha como deseja confirmar sua conta.</p></div></div>
    <label>Apelido<input id="nickname" type="text" autocomplete="nickname" placeholder="Como quer aparecer no site" maxlength="30" required></label>
    <label class="photo-label">📷 Foto do perfil<input id="avatar" type="file" accept="image/*"></label><small class="photo-help">Opcional. JPG, PNG ou WEBP, até 2 MB.</small>
    <div class="auth-choice"><button type="button" class="active" id="signupEmailChoice" onclick="setSignupMethod('email')">✉️ Confirmar por e-mail</button><button type="button" id="signupPhoneChoice" onclick="setSignupMethod('phone')">📱 Confirmar por celular</button></div>
    <div id="signupIdentity"><input id="email" type="email" autocomplete="email" placeholder="E-mail" required></div>
    <input id="pass" type="password" autocomplete="new-password" placeholder="Senha (mínimo 6 caracteres)" required>
    <button class="primary auth-main-btn" id="signup">Criar minha conta</button>
    <button class="secondary auth-register-btn" id="goLogin">Já tenho conta — Entrar</button>
    <p id="msg"></p>
  </div>`;
  $('signup').onclick=signup;$('goLogin').onclick=showLogin;
}
function setSignupMethod(method){
  signupMethod=method;
  $('signupEmailChoice')?.classList.toggle('active',method==='email');$('signupPhoneChoice')?.classList.toggle('active',method==='phone');
  const box=$('signupIdentity'); if(!box)return;
  box.innerHTML=method==='email'?'<input id="email" type="email" autocomplete="email" placeholder="E-mail" required>':'<input id="email" type="tel" autocomplete="tel" placeholder="Celular com DDD (ex.: 81999999999)" inputmode="tel" required>';
}
async function login(){
  const identity=$('email').value.trim(),password=$('pass').value;
  if(!identity||!password)return msg('Preencha seus dados.');
  const isPhone=$('loginIdentity')?.dataset.method==='phone';
  const credentials=isPhone?{phone:normalizePhoneAuth(identity),password}:{email:identity.toLowerCase(),password};
  if(isPhone && credentials.phone.length<10)return msg('Informe um celular válido com DDD.');
  const {error}=await client.auth.signInWithPassword(credentials);
  if(error){
    if(/email not confirmed/i.test(error.message)) return msg('Seu e-mail ainda não foi confirmado. Use o link enviado para seu e-mail e depois tente novamente.');
    if(/phone not confirmed/i.test(error.message)) return msg('Seu celular ainda não foi confirmado. Use o código SMS recebido.');
    return msg('Não foi possível entrar: '+error.message);
  }
  location.href='index.html';
}
function normalizePhoneAuth(v){let n=String(v||'').replace(/\D/g,'');if(n.length===11)n='55'+n;return n;}
async function signup(){
  const nickname=$('nickname').value.trim(),identity=$('email').value.trim(),password=$('pass').value;
  if(nickname.length<2)return msg('Informe um apelido com pelo menos 2 caracteres.');
  if(nickname.length>30)return msg('O apelido pode ter no máximo 30 caracteres.');
  if(password.length<6)return msg('A senha precisa ter pelo menos 6 caracteres.');
  const file=$('avatar')?.files?.[0];
  if(file && file.size>2*1024*1024)return msg('A foto precisa ter no máximo 2 MB.');
  if(signupMethod==='email'){
    const email=identity.toLowerCase();
    if(!/^\S+@\S+\.\S+$/.test(email))return msg('Informe um e-mail válido.');
    const redirectTo=new URL('login.html',window.location.href).href;
    const {data,error}=await client.auth.signUp({email,password,options:{data:{nickname},emailRedirectTo:redirectTo}});
    if(error)return msg('Não foi possível criar a conta: '+error.message);
    if(data.session){await finishProfile(data.user,nickname,file);msg('Conta criada e confirmada.','green');setTimeout(()=>location.href='index.html',500);}
    else showEmailConfirmation(email);
  }else{
    const phone=normalizePhoneAuth(identity);
    if(phone.length<12)return msg('Informe um celular válido com DDD.');
    const {data,error}=await client.auth.signUp({phone,password,options:{data:{nickname}}});
    if(error)return msg('Não foi possível criar a conta: '+error.message);
    if(data.user){pendingPhone=phone;pendingPhonePassword=password;showPhoneVerification(phone,nickname,file);}
  }
}
function showEmailConfirmation(email){
  $('authApp').innerHTML=`<div class="panel login auth-card"><div class="auth-brand-mini"><span>✉️</span><div><h2>Confirme seu e-mail</h2><p>Enviamos um link de confirmação para <b>${esc(email)}</b>.</p></div></div><div class="verify-box"><p>Abra a mensagem do Supabase e clique em <b>Confirmar seu e-mail</b>. Depois volte para esta página.</p></div><button class="primary" onclick="showLogin()">Já confirmei — entrar</button><button class="secondary auth-register-btn" onclick="showSignup()">Voltar ao cadastro</button><p id="msg"></p></div>`;
}
function showPhoneVerification(phone,nickname,file){
  window.pendingNickname=nickname;window.pendingAvatar=file||null;
  $('authApp').innerHTML=`<div class="panel login auth-card"><div class="auth-brand-mini"><span>📱</span><div><h2>Confirme seu celular</h2><p>Enviamos um código SMS para <b>${esc(phone)}</b>.</p></div></div><div class="verify-box"><input id="phoneOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000"><button class="primary" style="width:100%;margin-top:10px" onclick="verifyPhoneCode()">Confirmar código</button></div><button class="secondary auth-register-btn" onclick="resendPhoneCode()">Reenviar código</button><button class="link-btn" onclick="showSignup()">Voltar</button><p id="msg"></p></div>`;
}
async function verifyPhoneCode(){
  const token=$('phoneOtp').value.trim();if(token.length<4)return msg('Digite o código recebido por SMS.');
  const {data,error}=await client.auth.verifyOtp({phone:pendingPhone,token,type:'sms'});
  if(error)return msg('Código inválido ou expirado: '+error.message);
  if(data.user){await finishProfile(data.user,window.pendingNickname,window.pendingAvatar);msg('Celular confirmado! Conta criada.','green');setTimeout(()=>location.href='index.html',500);}
}
async function resendPhoneCode(){const {error}=await client.auth.signInWithOtp({phone:pendingPhone});if(error)return msg('Não foi possível reenviar: '+error.message);msg('Novo código enviado por SMS.','green');}
async function finishProfile(user,nickname,file){
  try{await client.from('profiles').update({nickname,phone:user.phone||null}).eq('id',user.id);if(file)await uploadAvatar(file,user.id);}catch(e){}
}

async function uploadAvatar(file,userId){
  if(!file)return;
  if(!file.type.startsWith('image/'))return msg('Escolha uma imagem válida.');
  if(file.size>2*1024*1024)return msg('A foto precisa ter no máximo 2 MB.');
  const uid=userId||((await client.auth.getUser()).data.user?.id);
  if(!uid)return msg('Entre na conta para alterar a foto.');
  msg('Enviando foto...','#7a4b00');
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${uid}/avatar.${ext}`;
  const {error:up}=await client.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type});
  if(up)return msg('Não foi possível enviar a foto: '+up.message);
  const {data}=client.storage.from('avatars').getPublicUrl(path);
  const avatarUrl=data.publicUrl+'?v='+Date.now();
  const {error}=await client.from('profiles').update({avatar_url:avatarUrl}).eq('id',uid);
  if(error)return msg('Foto enviada, mas não foi possível salvar o perfil: '+error.message);
  const img=$('profilePhoto');
  if(img){img.src=avatarUrl;img.style.display='block';if(img.nextElementSibling)img.nextElementSibling.style.display='none';}
  msg('Foto atualizada com sucesso!','green');
}
async function forgot(){
  const email=$('email').value.trim().toLowerCase();
  if(!email||!/^\S+@\S+\.\S+$/.test(email))return msg('Digite seu e-mail para receber o link de redefinição.');
  const redirectTo=new URL('login.html',window.location.href).href;
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)return msg('Não foi possível enviar o e-mail: '+error.message);
  msg('Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha.','green');
}
init();
