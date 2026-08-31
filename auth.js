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
          ${p?.role==='admin'?'<a class="account-quick-card admin-quick" href="admin/"><span class="quick-icon purple">⚙️</span><span><b>Painel do administrador</b><small>Acessar a área administrativa.</small></span><strong>›</strong></a>':''}
        </section>

        <h3 class="account-section-title">Confirmação da conta</h3>
        <section class="account-edit-card verification-account-card">
          <div id="verificationStatus"></div>
          <div class="verification-choice-grid">
            <div class="verify-option"><b>✉️ Confirmar e-mail</b><small>Receba um código de 6 dígitos no seu e-mail cadastrado.</small><button type="button" class="secondary" id="sendEmailVerification">Enviar código por e-mail</button></div>
            <div class="verify-option"><b>📱 Confirmar celular</b><small>Informe seu celular e receba um código por SMS.</small><input id="accountPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+55 (81) 99999-9999"><button type="button" class="secondary" id="sendPhoneVerification">Enviar código SMS</button></div>
          </div>
          <div id="emailVerifyBox" class="verify-box hidden"><input id="accountEmailOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Código recebido por e-mail"><button type="button" class="primary" id="confirmEmailCode">Confirmar e-mail</button></div>
          <div id="phoneVerifyBox" class="verify-box hidden"><input id="accountPhoneOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Código SMS"><button type="button" class="primary" id="confirmPhoneChange">Confirmar celular</button></div>
          <p id="verificationMsg" class="muted" style="margin:8px 0 0;font-size:12px"></p>
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
      initVerificationPanel(session);
      $('nicknameForm').onsubmit=async(e)=>{e.preventDefault();const value=$('nicknameEdit').value.trim();if(value.length<2||value.length>30){$('nicknameMsg').textContent='O apelido deve ter entre 2 e 30 caracteres.';return}const {error}=await client.rpc('update_my_profile',{p_nickname:value});if(error){$('nicknameMsg').textContent='Não foi possível salvar: '+error.message;return}await client.auth.updateUser({data:{nickname:value}});$('nicknameMsg').textContent='Apelido atualizado com sucesso!';$('nicknameMsg').style.color='#23733a';const title=document.querySelector('.account-intro h2');if(title)title.innerHTML='Olá, '+esc(value)+'! <span>👋</span>';updateCatalogHeader();};
      $('logout').onclick=async()=>{try{localStorage.removeItem('macrofood_cart');if(session?.user?.id)localStorage.removeItem('macrofood_cart_'+session.user.id);}catch(_){ } await client.auth.signOut();location.href='./'};
      return;
    }
    showLogin();
  }catch(e){
    $('authApp').innerHTML=`<div class="panel login"><h2>Erro ao carregar</h2><p>${esc(e.message)}</p><a class="secondary" href="index.html">Voltar ao catálogo</a></div>`;
  }
}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function showLogin(){
  $('authApp').innerHTML=`<div class="panel login auth-card">
    <div class="auth-brand-mini"><span>👤</span><div><h2>Entrar na minha conta</h2><p>Acesse sua conta MacroFood para acompanhar pedidos e gerenciar seu perfil.</p></div></div>
    <label>E-mail ou celular
      <input id="email" type="text" autocomplete="username" placeholder="Seu e-mail ou celular">
    </label>
    <input id="pass" type="password" autocomplete="current-password" placeholder="Sua senha">
    <button class="primary auth-main-btn" id="loginBtn">Entrar</button>
    <button class="secondary auth-register-btn" id="forgotBtn" type="button">Esqueci minha senha</button>
    <button class="secondary auth-register-btn" id="goSignup" type="button">Ainda não tenho conta — Criar conta</button>
    <p id="msg"></p>
  </div>`;
  $('loginBtn').onclick=login;
  $('forgotBtn').onclick=forgot;
  $('goSignup').onclick=showSignup;
  $('email').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click()});
  $('pass').addEventListener('keydown',e=>{if(e.key==='Enter')$('loginBtn').click()});
}

function showResetPassword(){
  $('authApp').innerHTML=`<div class="panel login"><h2>Nova senha</h2><p>Digite sua nova senha para concluir a recuperação da conta.</p><input id="newPass" type="password" autocomplete="new-password" placeholder="Nova senha (mínimo 6 caracteres)"><input id="newPass2" type="password" autocomplete="new-password" placeholder="Repita a nova senha"><button class="primary" id="savePass">Salvar nova senha</button><p id="msg"></p></div>`;
  $('savePass').onclick=async()=>{
    const a=$('newPass').value,b=$('newPass2').value;
    if(a.length<6)return msg('A senha precisa ter pelo menos 6 caracteres.');
    if(a!==b)return msg('As senhas não são iguais.');
    const {error}=await client.auth.updateUser({password:a});
    if(error)return msg('Não foi possível alterar a senha: '+error.message);
    msg('Senha alterada com sucesso! Você já pode entrar com a nova senha.','green');
    setTimeout(()=>{history.replaceState({},document.title,'./');location.href='./'},900);
  };
}
let signupMethod='email';
let pendingPhone='';
let pendingPhonePassword='';

function showSignup(){
  $('authApp').innerHTML=`<div class="panel login auth-card">
    <div class="auth-brand-mini"><span>✨</span><div><h2>Criar minha conta</h2><p>Cadastre-se agora. A confirmação de contato será feita depois, se você quiser comprar.</p></div></div>
    <label>Apelido<input id="nickname" type="text" autocomplete="nickname" placeholder="Como quer aparecer no site" maxlength="30" required></label>
    <label class="photo-label">📷 Foto do perfil<input id="avatar" type="file" accept="image/*"></label><small class="photo-help">Opcional. JPG, PNG ou WEBP, até 2 MB.</small>
    <label>E-mail<input id="email" type="email" autocomplete="email" placeholder="Seu e-mail" required></label>
    <label>Celular (opcional)<input id="signupPhone" type="tel" autocomplete="tel" value="+55 " placeholder="+55 (81) 99999-9999"></label>
    <small class="photo-help">Você poderá confirmar e-mail ou celular depois, em <b>Minha conta</b>. A confirmação é opcional e não impede suas compras.</small>
    <input id="pass" type="password" autocomplete="new-password" placeholder="Senha (mínimo 6 caracteres)" required>
    <button class="primary auth-main-btn" id="signup">Criar minha conta</button>
    <button class="secondary auth-register-btn" id="goLogin">Já tenho conta — Entrar</button>
    <p id="msg"></p>
  </div>`;
  $('signup').onclick=signup;$('goLogin').onclick=showLogin;
}
function setSignupMethod(method){signupMethod=method;}

async function login(){
  const identity=$('email').value.trim(),password=$('pass').value;
  if(!identity||!password)return msg('Preencha seus dados.');
  const isPhone=$('loginIdentity')?.dataset.method==='phone';
  const credentials=isPhone?{phone:normalizePhoneAuth(identity),password}:{email:identity.toLowerCase(),password};
  if(isPhone && credentials.phone.length<10)return msg('Informe um celular válido com DDD.');
  const {error}=await client.auth.signInWithPassword(credentials);
  if(error){
    if(/email not confirmed/i.test(error.message)) return msg('Sua conta ainda não foi confirmada. Entre em Minha conta para confirmar seu e-mail ou celular.');
    if(/phone not confirmed/i.test(error.message)) return msg('Seu celular ainda não foi confirmado.');
    return msg('Não foi possível entrar: '+error.message);
  }
  location.href='./';
}
function normalizePhoneAuth(v){let n=String(v||'').replace(/\D/g,'');if(n.startsWith('55'))return '+'+n;if(n.length===10||n.length===11)return '+55'+n;return n?('+'+n):'';}
function formatBrazilPhoneAuth(v){const n=normalizePhoneAuth(v).replace(/^\+/,'');const local=n.startsWith('55')?n.slice(2):n;if(local.length===11)return '+55 ('+local.slice(0,2)+') '+local.slice(2,7)+'-'+local.slice(7);if(local.length===10)return '+55 ('+local.slice(0,2)+') '+local.slice(2,6)+'-'+local.slice(6);return v||'';}
function ensureBrazilAuthPrefix(el){if(!el)return;el.addEventListener('focus',()=>{if(!el.value.trim())el.value='+55 ';});el.addEventListener('blur',()=>{const n=normalizePhoneAuth(el.value);if(n.replace(/\D/g,'').length===12||n.replace(/\D/g,'').length===13)el.value=formatBrazilPhoneAuth(n);else if(!el.value.trim())el.value='+55 ';});}
async function signup(){
  const nickname=$('nickname').value.trim(),email=$('email').value.trim().toLowerCase(),password=$('pass').value;
  const phone=normalizePhoneAuth($('signupPhone')?.value||'');
  if(nickname.length<2)return msg('Informe um apelido com pelo menos 2 caracteres.');
  if(nickname.length>30)return msg('O apelido pode ter no máximo 30 caracteres.');
  if(!/^\S+@\S+\.\S+$/.test(email))return msg('Informe um e-mail válido.');
  if(password.length<6)return msg('A senha precisa ter pelo menos 6 caracteres.');
  if(phone && (phone.replace(/\D/g,'').length<12 || phone.replace(/\D/g,'').length>13))return msg('Informe um celular válido com DDD. Exemplo: +55 (81) 99999-9999.');
  const file=$('avatar')?.files?.[0];
  if(file && file.size>2*1024*1024)return msg('A foto precisa ter no máximo 2 MB.');
  const {data,error}=await client.auth.signUp({email,password,options:{data:{nickname},emailRedirectTo:new URL('./',window.location.href).href}});
  if(error)return msg('Não foi possível criar a conta: '+error.message);
  if(!data.user)return msg('Não foi possível criar a conta.');
  if(phone){
    try{await client.rpc('update_my_profile',{p_nickname:nickname,p_phone:phone||null});}catch(e){}
  }
  if(data.session){await finishProfile(data.user,nickname,file);msg('Conta criada com sucesso! A confirmação será feita em Minha conta quando você quiser comprar.','green');setTimeout(()=>location.href='./',900);}
  else msg('Conta criada. Se o Supabase estiver exigindo confirmação de e-mail, desative “Confirm email” em Authentication > Providers > Email para permitir entrar sem confirmar agora.','green');
}

async function initVerificationPanel(session){
  const status=$('verificationStatus');
  if(!status)return;
  const u=session.user;
  let v={email_verified:false,phone_verified:false};
  try{
    const {data}=await client.from('contact_verifications').select('email_verified,phone_verified,email_verified_at,phone_verified_at').eq('user_id',u.id).maybeSingle();
    if(data)v=data;
  }catch(e){}
  const emailOk=!!v.email_verified;
  const phoneOk=!!v.phone_verified;
  status.innerHTML=`<div class="verification-summary"><b>${emailOk||phoneOk?'✅ Contato confirmado':'ℹ️ Confirmação opcional'}</b><small>${emailOk?'E-mail confirmado.':phoneOk?'Celular confirmado.':'Você pode confirmar seu e-mail ou celular aqui, se quiser.'}</small></div>`;
  if($('accountPhone')){const raw=u.phone||(await client.from('profiles').select('phone').eq('id',u.id).maybeSingle()).data?.phone||'';$('accountPhone').value=formatBrazilPhoneAuth(raw);}
  if(emailOk){$('sendEmailVerification').disabled=true;$('sendEmailVerification').textContent='E-mail confirmado ✓';}
  if(phoneOk){$('sendPhoneVerification').disabled=true;$('sendPhoneVerification').textContent='Celular confirmado ✓';}
  $('sendEmailVerification').onclick=sendEmailVerification;
  ensureBrazilAuthPrefix($('accountPhone'));ensureBrazilAuthPrefix($('signupPhone'));$('sendPhoneVerification').onclick=sendPhoneVerification;
  $('confirmEmailCode').onclick=confirmEmailCode;
  $('confirmPhoneChange').onclick=confirmPhoneChange;
}
let emailOtpCooldownUntil=0;
async function sendEmailVerification(){
  const now=Date.now();
  if(now<emailOtpCooldownUntil){
    const sec=Math.ceil((emailOtpCooldownUntil-now)/1000);
    return setVerificationMsg(`Aguarde ${sec}s antes de pedir outro código.`);
  }
  const {data:{user},error:userError}=await client.auth.getUser();
  if(userError)return setVerificationMsg('Não foi possível identificar sua sessão: '+userError.message);
  const email=user?.email?.trim();
  if(!email)return setVerificationMsg('Não encontramos o e-mail da sua conta.');
  const {error}=await client.auth.signInWithOtp({
    email,
    options:{shouldCreateUser:false, emailRedirectTo:window.location.href.split('#')[0]}
  });
  if(error){
    const raw=String(error.message||error);
    if(/magic link|smtp|email|mail/i.test(raw)){
      return setVerificationMsg('O Supabase não conseguiu enviar o e-mail. No Supabase, configure Auth > Email Templates > Magic link/OTP para usar {{ .Token }} e verifique Auth > Logs > Auth para saber se o envio foi bloqueado pelo provedor de e-mail.');
    }
    return setVerificationMsg('Não foi possível enviar o código: '+raw);
  }
  emailOtpCooldownUntil=Date.now()+60000;
  $('emailVerifyBox')?.classList.remove('hidden');
  setVerificationMsg('Código enviado. Verifique sua caixa de entrada e spam e digite o código de 6 dígitos.','green');
}
async function confirmEmailCode(){
  const {data:{user}}=await client.auth.getUser();
  const email=user?.email;
  const token=$('accountEmailOtp')?.value.trim();
  if(!email||!token)return setVerificationMsg('Digite o código recebido por e-mail.');
  const {error}=await client.auth.verifyOtp({email,token,type:'email'});
  if(error)return setVerificationMsg('Código inválido ou expirado: '+error.message);
  const {error:markError}=await client.rpc('mark_email_contact_verified');
  if(markError)return setVerificationMsg('O código foi validado, mas não conseguimos salvar a confirmação. Execute o SQL de atualização do ZIP no Supabase.');
  setVerificationMsg('E-mail confirmado com sucesso!','green');
  setTimeout(()=>location.reload(),700);
}
async function sendPhoneVerification(){
  const phone=normalizePhoneAuth($('accountPhone')?.value||'');
  if(phone.length<12)return setVerificationMsg('Informe um celular válido com DDD.');
  const {error}=await client.auth.updateUser({phone});
  if(error)return setVerificationMsg('Não foi possível enviar o SMS: '+error.message);
  window.pendingVerificationPhone=phone;
  $('phoneVerifyBox')?.classList.remove('hidden');
  setVerificationMsg('Código SMS enviado. Digite o código abaixo para confirmar.','green');
}
async function confirmPhoneChange(){
  const token=$('accountPhoneOtp')?.value.trim();
  const phone=window.pendingVerificationPhone;
  if(!phone||!token)return setVerificationMsg('Digite o código recebido por SMS.');
  const {error}=await client.auth.verifyOtp({phone,token,type:'phone_change'});
  if(error)return setVerificationMsg('Código inválido ou expirado: '+error.message);
  const {error:markError}=await client.rpc('mark_phone_contact_verified');
  if(markError)return setVerificationMsg('O celular foi validado, mas não conseguimos salvar a confirmação. Execute o SQL de atualização do ZIP no Supabase.');
  setVerificationMsg('Celular confirmado com sucesso!','green');
  setTimeout(()=>location.reload(),700);
}
function setVerificationMsg(text,color){const el=$('verificationMsg');if(el){el.textContent=text;el.style.color=color||'#a00000';}}

async function finishProfile(user,nickname,file){
  try{await client.rpc('update_my_profile',{p_nickname:nickname,p_phone:user.phone||null});if(file)await uploadAvatar(file,user.id);}catch(e){}
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
  const {error}=await client.rpc('update_my_profile',{p_avatar_url:avatarUrl});
  if(error)return msg('Foto enviada, mas não foi possível salvar o perfil: '+error.message);
  const img=$('profilePhoto');
  if(img){img.src=avatarUrl;img.style.display='block';if(img.nextElementSibling)img.nextElementSibling.style.display='none';}
  msg('Foto atualizada com sucesso!','green');
}
async function forgot(){
  const email=$('email').value.trim().toLowerCase();
  if(!email||!/^\S+@\S+\.\S+$/.test(email))return msg('Digite seu e-mail para receber o link de redefinição.');
  const redirectTo=new URL('./',window.location.href).href;
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo});
  if(error)return msg('Não foi possível enviar o e-mail: '+error.message);
  msg('Se esse e-mail estiver cadastrado, enviaremos um link para redefinir a senha.','green');
}
init();
