(function(){
  const KEY='macrofood_theme';
  function get(){return localStorage.getItem(KEY)||'light'}
  function apply(theme){
    theme=theme==='dark'?'dark':'light';
    document.documentElement.setAttribute('data-theme',theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(btn=>{
      btn.setAttribute('aria-pressed',theme==='dark'?'true':'false');
      btn.innerHTML=theme==='dark'?'☀️ <span>Modo claro</span>':'🌙 <span>Modo escuro</span>';
      btn.title=theme==='dark'?'Mudar para tema claro':'Mudar para tema escuro';
    });
  }
  window.toggleMacrofoodTheme=function(){
    const next=get()==='dark'?'light':'dark';
    localStorage.setItem(KEY,next); apply(next);
  };
  document.addEventListener('DOMContentLoaded',()=>apply(get()));
  apply(get());
})();
