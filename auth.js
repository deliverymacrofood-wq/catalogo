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
      const {data:p}=await client.from('profiles').select('role,email').eq('id',session.user.id).maybeSingle();
      $('authApp').innerHTML=`<div class="panel login"><h2>Olá!</h2><p>${esc(session.user.email)}</p>${p?.role==='admin'?'<a class="primary" href="admin.html">⚙️ Painel do administrador</a>':''}<button class="secondary" id="logout">Sair da conta</button><a class="secondary" href="index.html">Voltar ao catálogo</a></div>`;
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
  const email=$('email').value.trim().toLowerCase(),password=$('pass').value;
  if(!email||!/^\S+@\S+\.\S+$/.test(email))return msg('Informe um e-mail válido.');
  if(password.length<6)return msg('A senha precisa ter pelo menos 6 caracteres.');
  const {data,error}=await client.auth.signUp({email,password});
  if(error)return msg('Não foi possível criar a conta: '+error.message);
  if(data.session){msg('Conta criada e você já está conectado.','green');setTimeout(()=>location.href='index.html',500);}
  else msg('Conta criada! Verifique seu e-mail para confirmar a conta e depois faça login.','green');
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
