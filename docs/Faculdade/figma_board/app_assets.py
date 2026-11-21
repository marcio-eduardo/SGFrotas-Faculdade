"""CSS, markup e JS da experiência interativa (menu inicial + visualizador de telas estáticas)."""

APP_CSS = r"""
  #vp { display: none; }
  .real #vp { display: block; }
  .real #app { display: none; }
  #app { background: #f1f5f9; min-height: 100vh; color: #0f172a; }
  #app button { font-family: inherit; }
  .home { max-width: 1240px; margin: 0 auto; padding: 48px 24px 72px; }
  .hero { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
  .hero .logo { width: 56px; height: 56px; border-radius: 16px; background: #0284c7; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(2,132,199,.25); flex: none; }
  .hero h1 { margin: 0; font-size: 30px; font-weight: 900; letter-spacing: -.5px; }
  .hero p { margin: 4px 0 0; color: #64748b; font-size: 15px; }
  .hero .start { margin-left: auto; height: 46px; padding: 0 22px; border: 0; border-radius: 14px; background: #0284c7; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 20px rgba(2,132,199,.25); }
  .hero .start:hover { background: #0369a1; }
  .group { margin-top: 44px; }
  .group h2 { margin: 0; display: flex; align-items: baseline; gap: 12px; font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #475569; }
  .group h2 small { font: 500 12px 'JetBrains Mono', monospace; letter-spacing: 0; text-transform: none; color: #94a3b8; }
  .grid { display: grid; gap: 20px; margin-top: 16px; }
  .grid.d { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .grid.m { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); }
  .tile { display: block; width: 100%; padding: 14px; text-align: left; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; cursor: pointer; box-shadow: 0 1px 3px rgba(15,23,42,.05); transition: transform .15s, box-shadow .15s, border-color .15s; }
  .tile:hover, .tile:focus-visible { transform: translateY(-3px); border-color: #7dd3fc; box-shadow: 0 12px 28px rgba(3,105,161,.14); outline: none; }
  .meta > div { min-width: 0; }
  .thumb { display: block; width: 100%; box-sizing: border-box; position: relative; overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; pointer-events: none; }
  .meta { display: flex; align-items: center; gap: 10px; margin-top: 12px; }
  .meta .num { flex: none; padding: 2px 8px; border-radius: 9999px; background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; font: 700 12px 'JetBrains Mono', monospace; }
  .meta b { display: block; font-size: 15px; color: #0f172a; }
  .meta small { display: block; margin-top: 2px; font: 500 12px 'JetBrains Mono', monospace; color: #94a3b8; }
  .foot { margin: 48px 0 0; text-align: center; font-size: 13px; color: #94a3b8; }
  .f { position: absolute; left: 0; top: 0; transform-origin: 0 0; background: #f8fafc; overflow: hidden; pointer-events: none; user-select: none; }

  #viewer { position: fixed; inset: 0; z-index: 100; display: none; flex-direction: column; background: #e5e7eb; }
  #viewer.on { display: flex; }
  .top { flex: none; height: 60px; display: flex; align-items: center; gap: 12px; padding: 0 16px; background: #fff; border-bottom: 1px solid #e2e8f0; }
  .top .btn, .top button { height: 38px; min-width: 38px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #e2e8f0; border-radius: 10px; background: #fff; color: #0f172a; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; }
  .top .btn:hover, .top button:hover { background: #f0f9ff; border-color: #bae6fd; color: #0369a1; }
  .ttl { flex: 1; min-width: 0; }
  .ttl b { display: block; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ttl small { display: block; font: 500 12px 'JetBrains Mono', monospace; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pager { display: flex; align-items: center; gap: 8px; }
  .pager button { font-size: 20px; padding: 0 12px; }
  #cnt { min-width: 44px; text-align: center; font: 600 13px 'JetBrains Mono', monospace; color: #64748b; }
  #sb { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding: 24px; overflow: hidden; touch-action: pan-y; }
  #shot { position: relative; flex: none; overflow: hidden; border-radius: 12px; background: #f8fafc; box-shadow: 0 1px 4px rgba(0,0,0,.08), 0 16px 48px rgba(15,23,42,.14); }
  @media (max-width: 640px) {
    .home { padding: 28px 16px 56px; }
    .hero h1 { font-size: 24px; }
    .hero .start { width: 100%; margin-left: 0; }
    .grid.d { grid-template-columns: 1fr; }
    .grid.m { grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .top { padding: 0 10px; gap: 8px; }
    .top .btn .t { display: none; }
    .ttl small { display: none; }
    #sb { padding: 12px; }
  }
"""

APP_BODY = r"""
<div id="app">
  <main class="home" id="home">
    <header class="hero">
      <div class="logo"><i data-lucide="shield-check" style="width:30px;height:30px"></i></div>
      <div>
        <h1>SGFrotas · Protótipo de Interface</h1>
        <p>Tarefa 3 — Prototipagem de Interface e Planejamento Ágil · tema claro</p>
      </div>
      <button class="start" id="start">Iniciar apresentação →</button>
    </header>
    <section class="group">
      <h2>Gestor de Frotas <small>Desktop · 1440×900</small></h2>
      <div class="grid d" id="gd"></div>
    </section>
    <section class="group">
      <h2>Técnico em Campo <small>PWA mobile · 375×812 · offline-first</small></h2>
      <div class="grid m" id="gm"></div>
    </section>
    <p class="foot">Telas estáticas ajustadas ao navegador · ← → navegam · Esc volta ao menu</p>
  </main>

  <section id="viewer" aria-live="polite">
    <div class="top">
      <a class="btn" href="#" id="back">← <span class="t">&nbsp;Menu</span></a>
      <div class="ttl"><b id="vt"></b><small id="vc"></small></div>
      <div class="pager"><button id="prev" title="Anterior (←)">‹</button><span id="cnt"></span><button id="next" title="Próxima (→)">›</button></div>
    </div>
    <div id="sb"><div id="shot"></div></div>
  </section>
</div>
"""

APP_JS = r"""
(function () {
  var NAV = __NAV__;
  var $ = function (id) { return document.getElementById(id); };
  // ?real → board completo em tamanho real, sem menu (use este endereço na importação do html.to.design)
  if (/[?&]real/.test(location.search)) { document.documentElement.className = 'real'; return; }

  lucide.createIcons();
  var frames = [].slice.call(document.querySelectorAll('#stage .frame'));
  var home = $('home'), viewer = $('viewer'), sb = $('sb'), shot = $('shot');
  var cur = -1, baseTitle = document.title;

  function cloneFrame(i) {
    var c = frames[i].cloneNode(true);
    c.removeAttribute('style');
    c.className = 'f';
    [].forEach.call(c.querySelectorAll('[id]'), function (e) { e.removeAttribute('id'); });
    c.style.width = NAV[i].w + 'px';
    c.style.height = NAV[i].h + 'px';
    return c;
  }

  // ---- menu inicial ----
  var thumbs = [];
  NAV.forEach(function (f, i) {
    var parts = f.label.split(' · ');
    var card = document.createElement('div');
    card.className = 'tile';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } };
    card.innerHTML = '<div class="thumb"></div><div class="meta"><span class="num">' + parts[0] +
      '</span><div><b>' + parts[1] + '</b><small>' + f.cap + '</small></div></div>';
    var th = card.firstChild, c = cloneFrame(i);
    th.appendChild(c);
    thumbs.push({ th: th, c: c, f: f });
    card.onclick = function () { location.hash = '#tela-' + (i + 1); };
    $(f.group === 'mobile' ? 'gm' : 'gd').appendChild(card);
  });
  function layoutThumbs() {
    thumbs.forEach(function (t) {
      var k = t.th.clientWidth / t.f.w;
      t.th.style.height = Math.min(t.f.h * k, 300) + 'px';
      t.c.style.transform = 'scale(' + k + ')';
    });
  }

  // ---- visualizador (telas estáticas, ajustadas à janela) ----
  function fit() {
    if (cur < 0) return;
    var f = NAV[cur], pad = sb.clientWidth <= 640 ? 24 : 48;
    var k = Math.min((sb.clientWidth - pad) / f.w, (sb.clientHeight - pad) / f.h, 1.6);
    shot.style.width = (f.w * k) + 'px';
    shot.style.height = (f.h * k) + 'px';
    shot.firstChild.style.transform = 'scale(' + k + ')';
  }
  function open(i) {
    cur = i;
    shot.innerHTML = '';
    shot.appendChild(cloneFrame(i));
    $('vt').textContent = NAV[i].label;
    $('vc').textContent = NAV[i].cap + ' · ' + NAV[i].w + '×' + NAV[i].h;
    $('cnt').textContent = (i + 1) + ' / ' + NAV.length;
    viewer.classList.add('on');
    document.body.style.overflow = 'hidden';
    document.title = NAV[i].label + ' — SGFrotas';
    fit();
  }
  function close() {
    cur = -1;
    viewer.classList.remove('on');
    document.body.style.overflow = '';
    document.title = baseTitle;
    layoutThumbs();
  }
  function route() {
    var m = /^#tela-(\d+)/.exec(location.hash);
    if (m && +m[1] >= 1 && +m[1] <= NAV.length) open(+m[1] - 1); else close();
  }
  function step(d) { location.replace('#tela-' + ((cur + d + NAV.length) % NAV.length + 1)); }

  $('start').onclick = function () { location.hash = '#tela-1'; };
  $('prev').onclick = function () { step(-1); };
  $('next').onclick = function () { step(1); };
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', function () { if (cur < 0) layoutThumbs(); else fit(); });
  window.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || cur < 0) return;
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Escape') location.hash = '';
    else if (/^[1-9]$/.test(e.key) && +e.key <= NAV.length) location.replace('#tela-' + e.key);
  });
  var tx = null;
  sb.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  sb.addEventListener('touchend', function (e) {
    if (tx === null) return;
    var dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 60) step(dx < 0 ? 1 : -1);
  });

  layoutThumbs();
  route();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (cur < 0) layoutThumbs(); else fit(); });
})();
"""
