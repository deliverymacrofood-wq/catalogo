(() => {
  const scriptUrl = document.currentScript ? document.currentScript.src : location.href;
  const rootUrl = new URL('./', scriptUrl);
  const manifestUrl = new URL('manifest.webmanifest', rootUrl).href;
  if (!document.querySelector('link[rel="manifest"]')) {
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = manifestUrl;
    document.head.appendChild(link);
  }
  if (!document.querySelector('meta[name="theme-color"]')) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#f05a00';
    document.head.appendChild(meta);
  }
  const appleIcon = document.createElement('link');
  appleIcon.rel = 'apple-touch-icon';
  appleIcon.href = new URL('icon-192.png', rootUrl).href;
  document.head.appendChild(appleIcon);
  const style = document.createElement('style');
  style.textContent = `
    #macrofood-install-prompt{position:fixed;z-index:9999;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));max-width:560px;margin:auto;background:#fff;color:#222;border:1px solid #ead9d0;border-radius:16px;box-shadow:0 8px 35px #0003;padding:13px 14px;display:none;align-items:center;gap:12px;font:14px Arial,sans-serif}
    #macrofood-install-prompt .mf-icon{width:44px;height:44px;border-radius:10px;object-fit:cover}
    #macrofood-install-prompt .mf-copy{flex:1;line-height:1.35}
    #macrofood-install-prompt .mf-copy strong{display:block;font-size:15px;margin-bottom:2px}
    #macrofood-install-prompt button{border:0;border-radius:9px;padding:10px 12px;background:#8f0038;color:#fff;font-weight:bold}
    #macrofood-install-prompt .mf-close{background:#f2f2f2;color:#333;padding:8px 10px}
  `;
  document.head.appendChild(style);

  let installEvent = null;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const dismissed = sessionStorage.getItem('macrofoodInstallDismissed') === '1';

  if (!isStandalone && !dismissed) {
    const prompt = document.createElement('div');
    prompt.id = 'macrofood-install-prompt';
    prompt.innerHTML = `<img class="mf-icon" src="${new URL('icon-192.png', rootUrl).href}" alt=""><div class="mf-copy"><strong>Instale o app Macrofood</strong><span id="macrofood-install-help">Acesse seu catálogo direto pela tela inicial.</span></div><button id="macrofood-install-action" type="button">Instalar</button><button class="mf-close" id="macrofood-install-close" type="button" aria-label="Fechar">×</button>`;
    document.body.appendChild(prompt);
    const action = prompt.querySelector('#macrofood-install-action');
    const help = prompt.querySelector('#macrofood-install-help');
    const show = () => { prompt.style.display = 'flex'; };
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      installEvent = event;
      action.textContent = 'Instalar';
      help.textContent = 'Tenha a Macrofood na tela inicial do celular.';
      show();
    });
    if (isIOS) {
      action.textContent = 'Como instalar';
      help.textContent = 'No Safari, toque em Compartilhar e depois “Adicionar à Tela de Início”.';
      show();
    }
    action.addEventListener('click', async () => {
      if (installEvent) {
        installEvent.prompt();
        await installEvent.userChoice.catch(() => null);
        installEvent = null;
        prompt.style.display = 'none';
      } else if (isIOS) {
        help.textContent = 'Abra no Safari → Compartilhar (quadrado com seta) → Adicionar à Tela de Início → Adicionar.';
      } else {
        help.textContent = 'No menu do navegador, escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.';
      }
    });
    prompt.querySelector('#macrofood-install-close').addEventListener('click', () => {
      prompt.style.display = 'none';
      sessionStorage.setItem('macrofoodInstallDismissed', '1');
    });
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => {
      const swUrl = new URL('sw.js', rootUrl);
      navigator.serviceWorker.register(swUrl.href, {scope: rootUrl.pathname}).catch(err => {
        console.warn('Não foi possível ativar o modo aplicativo Macrofood:', err);
      });
    });
  }
})();
