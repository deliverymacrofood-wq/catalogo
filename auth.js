const client=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);
const $=id=>document.getElementById(id);
const msg=(t,c='#a00000')=>{const el=$('msg');if(el){el.textContent=t;el.style.color=c}};
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
      $('authApp').innerHTML=`<div class="panel login account-card"><div class="profile-photo-wrap"><img id="profilePhoto" class="profile-photo" src="${esc(avatar||'') }" alt="Foto do cliente" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="profile-photo-placeholder" style="display:${avatar?'none':'flex'}">👤</div></div><h2>Olá, ${esc(nickname)}!</h2><p>${esc(session.user.email)}</p><label class="photo-label">📷 Alterar foto<input id="avatarInput" type="file" accept="image/*" hidden></label><small class="photo-help">JPG, PNG ou WEBP. Recomendado até 2 MB.</small>${p?.role==='admin'?'<a class="primary" href="admin.html">⚙️ Painel do administrador</a>':''}<a class="secondary" href="pedidos.html">📦 Meus pedidos</a><button class="secondary" id="logout">Sair da conta</button><a class="secondary" href="index.html">Voltar ao catálogo</a></div>`;
      $('avatarInput').onchange=()=>uploadAvatar($('avatarInput').files[0]);
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
function showLogin(){
  $('authApp').innerHTML=`<div class="panel login"><h2>Minha conta</h2><p>Entre ou crie sua conta gratuitamente.</p>
  <input id="nickname" type="text" autocomplete="nickname" placeholder="Apelido (para aparecer no site)" maxlength=30>
  <label class="photo-label">📷 Foto do perfil<input id="avatar" type="file" accept="image/*"></label><small class="photo-help">Opcional. JPG, PNG ou WEBP, até 2 MB.</small>
  <input id="email" type="email" autocomplete="email" placeholder="E-mail" required>
  <input id="pass" type="password" autocomplete="current-password" placeholder="Senha (mínimo 6 caracteres)" required>
  <button class="primary" id="login">Entrar</button><button class="secondary" id="signup">Criar minha conta</button>
  <button class="secondary" id="forgot">Esqueci minha senha</button><p id="msg"></p></div>`;
  $('login').onclick=login;$('signup').onclick=signup;$('forgot').onclick=forgot;
  $('pass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
}
async function login(){
  const email=$('email').value.trim().toLowerCase(),password=$('pass').value;
  if(!email||!password)return msg('Preencha e-mail e senha.');
  const {error}=await client.auth.signInWithPassword({email,password});
  if(error){
    if(/email not confirmed/i.test(error.message)) return msg('Seu e-mail ainda não foi confirmado. Abra o e-mail enviado pelo Supabase e confirme a conta.');
    return msg('Não foi possível entrar: '+error.message);
  }
  location.href='index.html';
}
async function signup(){
  const nickname=$('nickname').value.trim(),email=$('email').value.trim().toLowerCase(),password=$('pass').value;
  if(nickname.length<2)return msg('Informe um apelido com pelo menos 2 caracteres.');
  if(nickname.length>30)return msg('O apelido pode ter no máximo 30 caracteres.');
  if(!email||!/^\S+@\S+\.\S+$/.test(email))return msg('Informe um e-mail válido.');
  if(password.length<6)return msg('A senha precisa ter pelo menos 6 caracteres.');
  const {data,error}=await client.auth.signUp({email,password,options:{data:{nickname}}});
  if(error)return msg('Não foi possível criar a conta: '+error.message);
  if(data.session){
    await client.from('profiles').update({nickname}).eq('id',data.user.id);
    const file=$('avatar')?.files?.[0];
    if(file) await uploadAvatar(file, data.user.id);
    msg('Conta criada e você já está conectado.','green');setTimeout(()=>location.href='index.html',500);
  }
  else msg('Conta criada! Verifique seu e-mail para confirmar a conta e depois faça login.','green');
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
