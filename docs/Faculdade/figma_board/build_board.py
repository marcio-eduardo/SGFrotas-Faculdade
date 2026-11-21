"""Gera board.html: canvas estilo Figma com as telas do SGFrotas (tema claro).

Reaproveita o markup das telas em ../telas_prototipo/ (já no tema claro) e as
posiciona como frames separados: capa, painel de instruções e seção de telas.

    python build_board.py
"""
import json
import re
from pathlib import Path

from app_assets import APP_BODY, APP_CSS, APP_JS

HERE = Path(__file__).parent
TELAS = HERE.parent / "telas_prototipo"

# (arquivo, rótulo, história, largura, altura, tipo)
DESKTOP = [
    ("tela_01_login.html", "01 · Login", "Acesso corporativo SSO/RBAC", 1440, 900),
    ("tela_02_torre_de_controle.html", "02 · Torre de Controle", "US02 · US03", 1440, 900),
    ("tela_03_ficha_veiculo_360.html", "03 · Ficha do Veículo 360°", "US06", 1440, 900),
    ("tela_04_central_multas_anti_nic.html", "04 · Central Anti-NIC", "US04", 1440, 900),
    ("tela_05_combustivel_dropdown.html", "05 · Combustível ValeCard", "US09 · US10 · US11", 1440, 900),
]
MOBILE = [
    ("tela_06_pwa_meu_veiculo.html", "06 · Meu Veículo", "US12", 375, 812),
    ("tela_07_pwa_checklist_360.html", "07 · Checklist 360°", "US13", 375, 812),
    ("tela_08_pwa_registro_abastecimento.html", "08 · Abastecimento", "US15", 375, 812),
    ("tela_09_pwa_modo_offline.html", "09 · Modo Offline", "US14", 375, 812),
]

GAP = 160
PAD = 120
LABEL_H = 70
SECTION_X = 2500


def read(name):
    return (TELAS / name).read_text(encoding="utf-8")


def body_parts(html):
    """Retorna (classes do body, markup interno sem <script>, scripts inline)."""
    m = re.search(r"<body class=\"([^\"]*)\">(.*)</body>", html, re.S)
    classes, inner = m.group(1), m.group(2)
    scripts = re.findall(r"<script>(.*?)</script>", inner, re.S)
    inner = re.sub(r"<script>.*?</script>", "", inner, flags=re.S)
    return classes, inner.strip(), scripts


def desktop_frame(name):
    classes, inner, scripts = body_parts(read(name))
    classes = classes.replace("min-h-screen", "min-h-full")
    inner = inner.replace("sticky top-0", "relative").replace("fixed inset-0", "absolute inset-0")
    return f'<div class="{classes} w-full h-full overflow-hidden relative">{inner}</div>', scripts


def mobile_frame(name):
    """Remove a moldura de smartphone e devolve só a tela (375x812)."""
    _, inner, scripts = body_parts(read(name))
    m = re.search(r'<div class="(bg-slate-50 rounded-\[36px\][^"]*)">', inner)
    classes = m.group(1).replace("rounded-[36px]", "")
    rest = inner[m.end():].rstrip()
    for _ in range(2):  # fecha a tela e a moldura
        rest = rest[: rest.rindex("</div>")].rstrip()
    return f'<div class="{classes} w-full h-full">{rest}</div>', scripts


def frame_block(x, y, w, h, label, caption, content):
    return f"""
  <div class="label" style="left:{x}px;top:{y}px;width:{w}px">{label}<small>{caption} · {w}×{h}</small></div>
  <div class="frame" style="left:{x}px;top:{y + LABEL_H}px;width:{w}px;height:{h}px">{content}</div>"""


def main():
    scripts_all, blocks, nav = [], [], []

    d_top = 200
    for i, (f, label, cap, w, h) in enumerate(DESKTOP):
        content, sc = desktop_frame(f)
        scripts_all += sc
        x = SECTION_X + PAD + i * (w + GAP)
        blocks.append(frame_block(x, d_top, w, h, label, cap, content))
        nav.append({"label": label, "cap": cap, "group": "desktop", "w": w, "h": h})

    m_top = d_top + LABEL_H + 900 + 220
    for i, (f, label, cap, w, h) in enumerate(MOBILE):
        content, sc = mobile_frame(f)
        scripts_all += sc
        x = SECTION_X + PAD + i * (w + GAP)
        blocks.append(frame_block(x, m_top, w, h, label, cap, content))
        nav.append({"label": label, "cap": cap, "group": "mobile", "w": w, "h": h})

    section_w = PAD * 2 + len(DESKTOP) * 1440 + (len(DESKTOP) - 1) * GAP
    section_h = m_top + LABEL_H + 812 + PAD
    section_x = SECTION_X
    stage_w = section_x + section_w

    # blocos extras: tokens + legenda, ao lado dos frames mobile
    extras_x = SECTION_X + PAD + len(MOBILE) * (375 + GAP) + 80
    extras = f"""
  <div class="card" style="left:{extras_x}px;top:{m_top + LABEL_H}px;width:1700px;height:812px">
    <h3>Tokens · Tema claro</h3>
    <div class="swatches">
      <div><i style="background:#f0f4f8"></i>bg<br><code>#f0f4f8</code></div>
      <div><i style="background:#ffffff;border:2px solid #e2e8f0"></i>surface<br><code>#ffffff</code></div>
      <div><i style="background:#0369a1"></i>accent<br><code>#0369a1</code></div>
      <div><i style="background:#0284c7"></i>brand.600<br><code>#0284c7</code></div>
      <div><i style="background:#0ea5e9"></i>brand.500<br><code>#0ea5e9</code></div>
      <div><i style="background:#059669"></i>success<br><code>#059669</code></div>
      <div><i style="background:#d97706"></i>warning<br><code>#d97706</code></div>
      <div><i style="background:#dc2626"></i>danger<br><code>#dc2626</code></div>
      <div><i style="background:#0f172a"></i>text<br><code>#0f172a</code></div>
      <div><i style="background:#475569"></i>text2<br><code>#475569</code></div>
      <div><i style="background:#94a3b8"></i>text3<br><code>#94a3b8</code></div>
      <div><i style="background:#0f172a"></i>sidebar<br><code>#0f172a</code></div>
    </div>
    <h3 style="margin-top:32px">Tipografia &amp; formas</h3>
    <p class="type"><b>Inter</b> — interface · <span class="mono">JetBrains Mono — SWN7F22 · 42.850 km · R$ 303k</span></p>
    <p class="type">Raios: cards <b>16px</b> · modais <b>20–24px</b> · badges <b>9999px</b> · Paginação: <b>15 linhas</b></p>
    <h3 style="margin-top:32px">Status operacional</h3>
    <div class="badges">
      <span style="background:#ecfdf5;color:#047857;border-color:#a7f3d0">DISPONÍVEL</span>
      <span style="background:#f0f9ff;color:#0369a1;border-color:#bae6fd">EM USO</span>
      <span style="background:#fffbeb;color:#b45309;border-color:#fde68a">MANUTENÇÃO</span>
      <span style="background:#fff1f2;color:#be123c;border-color:#fecdd3">SINISTRADO</span>
    </div>
  </div>"""

    def thumb(n, title, text):
        return f'<div class="step"><b>{title}</b><p>{text}</p><span class="chip">{n}</span></div>'

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SGFrotas — Protótipo de Interface</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
<script src="https://unpkg.com/lucide@latest"></script>
<style>
  html, body {{ margin: 0; background: #e5e7eb; font-family: 'Inter', sans-serif; }}
  #wrap {{ position: relative; overflow: hidden; width: {stage_w}px; height: {section_h}px; }}
  #stage {{ position: relative; width: {stage_w}px; height: {section_h}px; transform-origin: 0 0; }}
{APP_CSS}
  #stage > * {{ position: absolute; }}
  .cover {{ left: 0; top: 0; width: 1000px; height: 620px; background: #0b1120; color: #fff;
    clip-path: polygon(0 0, 90% 0, 100% 50%, 90% 100%, 0 100%); }}
  .cover h1 {{ position: absolute; left: 90px; top: 150px; margin: 0; font-size: 72px; line-height: 1.05; font-weight: 800; letter-spacing: -1px; }}
  .cover p {{ position: absolute; left: 90px; top: 340px; width: 560px; margin: 0; font-size: 24px; line-height: 1.5; color: #94a3b8; }}
  .cover .tag {{ position: absolute; left: 90px; top: 90px; font: 600 22px 'JetBrains Mono'; color: #38bdf8; }}
  .cover .s1 {{ position: absolute; left: 560px; top: 440px; width: 0; height: 0; border-left: 60px solid transparent; border-right: 60px solid transparent; border-bottom: 104px solid #10b981; }}
  .cover .s2 {{ position: absolute; left: 700px; top: 420px; width: 110px; height: 110px; background: #0ea5e9; border-radius: 16px; transform: rotate(8deg); }}
  .cover .s3 {{ position: absolute; left: 790px; top: 380px; width: 100px; height: 100px; background: #f59e0b; border-radius: 50%; }}
  .panel {{ left: 1200px; top: 0; width: 1100px; height: {section_h}px; background: #f1f5f9; }}
  .panel .n {{ position: absolute; left: 60px; font-size: 64px; font-weight: 300; color: #cbd5e1; }}
  .panel h2 {{ position: absolute; left: 150px; margin: 0; font-size: 34px; font-weight: 700; color: #0f172a; }}
  .panel .lead {{ position: absolute; left: 150px; width: 860px; margin: 0; font-size: 22px; line-height: 1.5; color: #475569; }}
  .step {{ position: absolute; left: 150px; width: 860px; background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 32px 40px; box-shadow: 0 4px 20px rgba(0,0,0,.05); }}
  .step b {{ font-size: 26px; color: #0f172a; }}
  .step p {{ margin: 12px 0 0; font-size: 20px; line-height: 1.5; color: #475569; width: 640px; }}
  .step .chip {{ position: absolute; right: 36px; top: 30px; padding: 6px 16px; border-radius: 9999px; background: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; font: 700 18px 'JetBrains Mono'; }}
  .section {{ left: {section_x}px; top: 0; width: {section_w}px; height: {section_h}px; background: #f1f5f9; }}
  .section > h2 {{ position: absolute; left: {PAD}px; margin: 0; font-size: 44px; font-weight: 800; color: #0f172a; letter-spacing: -.5px; }}
  .section > h2 small {{ margin-left: 24px; font: 500 24px 'JetBrains Mono'; color: #94a3b8; }}
  .label {{ font-size: 36px; font-weight: 500; color: #94a3b8; height: {LABEL_H}px; white-space: nowrap; }}
  .label small {{ margin-left: 20px; font: 500 20px 'JetBrains Mono'; color: #b6c0cd; }}
  .frame {{ background: #f8fafc; box-shadow: 0 1px 4px rgba(0,0,0,.08), 0 8px 32px rgba(15,23,42,.08); overflow: hidden; }}
  .card {{ background: #fff; border: 1px solid #e2e8f0; border-radius: 24px; padding: 44px 64px; box-sizing: border-box; box-shadow: 0 4px 20px rgba(0,0,0,.05); }}
  .card h3 {{ margin: 0 0 28px; font-size: 28px; font-weight: 800; color: #0f172a; }}
  .swatches {{ display: grid; grid-template-columns: repeat(6, 1fr); gap: 28px; font-size: 20px; color: #475569; line-height: 1.4; }}
  .swatches i {{ display: block; height: 96px; border-radius: 16px; margin-bottom: 10px; }}
  .swatches code {{ font: 500 18px 'JetBrains Mono'; color: #94a3b8; }}
  .type {{ margin: 0 0 12px; font-size: 24px; color: #334155; }}
  .mono {{ font-family: 'JetBrains Mono'; font-weight: 600; }}
  .badges span {{ display: inline-block; margin-right: 16px; padding: 10px 24px; border-radius: 9999px; border: 2px solid; font-size: 20px; font-weight: 700; }}
</style>
</head>
<body>
<div id="vp">
<div id="wrap">
<div id="stage">

  <div class="cover">
    <span class="tag">SGFrotas · Tarefa 3</span>
    <h1>Prototipagem<br>de Interface</h1>
    <p>Board do protótipo em tema claro: fluxo do Gestor de Frotas (desktop) e do Técnico em campo (PWA mobile).</p>
    <div class="s1"></div><div class="s2"></div><div class="s3"></div>
  </div>

  <div class="panel">
    <span class="n" style="top:70px">1</span>
    <h2 style="top:90px">Ver o protótipo</h2>
    <p class="lead" style="top:150px">Percorra as telas da esquerda para a direita. A seção superior traz o fluxo do gestor; a inferior, o do técnico em campo.</p>

    <span class="n" style="top:330px">2</span>
    <h2 style="top:350px">Como está organizado</h2>
    <p class="lead" style="top:410px">Cada tela é um frame independente, nomeado com a história de usuário do backlog (US02, US04…).</p>

    <div style="position:absolute;left:0;top:520px;width:100%">
      {thumb("1440×900", "Gestor de Frotas · 5 telas", "Login, Torre de Controle, Ficha 360°, Central Anti-NIC e Combustível ValeCard.").replace('class="step"', 'class="step" style="top:0"')}
      {thumb("375×812", "Técnico PWA · 4 telas", "Meu Veículo, Checklist 360°, Registro de Abastecimento e Modo Offline.").replace('class="step"', 'class="step" style="top:230px"')}
      {thumb("tokens", "Tema claro", "Cores, tipografia (Inter + JetBrains Mono) e raios no card ao final da seção mobile; JSON em figma_tokens_sgfrotas.json.").replace('class="step"', 'class="step" style="top:460px"')}
    </div>
  </div>

  <div class="section">
    <h2 style="top:90px">Gestor de Frotas <small>Desktop · 1440×900</small></h2>
    <h2 style="top:{m_top - 110}px">Técnico em Campo <small>PWA mobile · 375×812 · offline-first</small></h2>
  </div>
{''.join(blocks)}{extras}
</div>
</div>
</div>

{APP_BODY}
<script>
{APP_JS.replace('__NAV__', json.dumps(nav, ensure_ascii=False))}
</script>
</body>
</html>
"""
    (HERE / "board.html").write_text(html, encoding="utf-8")
    print("board.html gerado:", stage_w, "x", section_h)

    # Variante para publicar como Artifact (esqueleto, título e libs fixadas são do publicador)
    art = html.replace(
        '<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        '<title>SGFrotas — Protótipo de Interface</title>\n',
        '<title>Protótipo SGFrotas</title>\n',
    )
    art = art.replace("https://cdn.tailwindcss.com", "https://cdn.tailwindcss.com/3.4.17")
    art = art.replace("https://unpkg.com/lucide@latest", "https://unpkg.com/lucide@0.469.0/dist/umd/lucide.min.js")
    art = art.replace("</style>\n</head>\n<body>\n", "</style>\n").replace("</body>\n</html>\n", "")
    (HERE / "prototipo_artifact.html").write_text(art, encoding="utf-8")


if __name__ == "__main__":
    main()
