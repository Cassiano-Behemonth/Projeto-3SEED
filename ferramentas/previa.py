#!/usr/bin/env python3
"""Desenha o mapa por cima da planta e grava uma imagem, para conferir sem abrir o navegador.

Uso:
  python3 ferramentas/previa.py mapas/meu_mapa.json saida.png
  python3 ferramentas/previa.py mapas/meu_mapa.json saida.png --recorte 400 200 600 400 --zoom 2
  python3 ferramentas/previa.py mapas/meu_mapa.json saida.png --recorte 0 0 500 400 --recorte 500 0 500 400 --zoom 2
      (vários recortes de uma vez: grava saida_1.png, saida_2.png...)
  python3 ferramentas/previa.py mapas/meu_mapa.json saida.png --contorno       # paredes só em contorno, para ver a planta por baixo
  python3 ferramentas/previa.py mapas/meu_mapa.json saida.png --sem-rotulos    # sem os nomes de salas, móveis e portas (mapas com muitos móveis)
  python3 ferramentas/previa.py mapas/meu_mapa.json saida.png --clarear 2.5    # para plantas escuras
  python3 ferramentas/previa.py mapas/meu_mapa.json saida.png --passo 50       # com a grade numerada por cima, como em grade.py

Legenda: paredes em branco, portas em laranja, salas ocultas em azul, móveis em ciano (o risco aponta a frente),
luzes em amarelo, câmeras em rosa, chegada em verde, passagens em dourado, grades em cinza, barreiras em azul-claro.
Olhe a imagem: cada peça deve cair em cima do desenho correspondente da planta.
"""
import json, math, os, sys
from imagem import ler_png, escrever_png
from grade import opcao, opcoes, recortar, zoom_inteiro, desenhar_grade
from formato import normalizar, contorno_de

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Pegada (largura, profundidade) de cada móvel, em metros, quando o mapa não informa.
PEGADA = {'cama': ('w', 0.95, 'l', 2), 'mesa': ('w', 1, 'd', 1), 'sofa': ('w', 0.85, None, 0.82), 'balcao': ('w', 2, 'd', 0.6), 'estante': ('w', 2, 'd', 0.35),
          'caixote': ('w', 0.8, 'd', 0.6), 'caixa': ('w', 1, 'd', 1), 'lareira': ('w', 2, None, 0.7), 'rackArmas': ('w', 2, None, 0.15), 'alcapao': ('w', 1.5, 'd', 1.6),
          'cadeira': (None, 0.45, None, 0.45), 'banqueta': (None, 0.36, None, 0.36), 'maca': (None, 0.86, None, 2), 'banheira': (None, 1.75, None, 0.8),
          'vaso': (None, 0.4, None, 0.6), 'pia': (None, 0.5, None, 0.4), 'sinuca': (None, 1.56, None, 2.76), 'jukebox': (None, 0.85, None, 0.55),
          'barril': (None, 0.6, None, 0.6), 'vela': (None, 0.12, None, 0.12), 'castical': (None, 0.25, None, 0.25)}

PEGADA.update({'mastro': ('w', 9, None, 0.7), 'canhao': (None, 0.8, 'l', 1.7), 'timao': (None, 1.2, None, 0.5), 'gurupes': (None, 0.4, 'l', 6), 'bote': ('w', 1.4, 'l', 3.4),
               'casa': ('w', 6, 'd', 5), 'torii': ('w', 4, None, 0.5), 'ponte': ('w', 8, 'd', 3), 'tenda': ('w', 3, 'd', 2.4), 'cerca': ('w', 10, None, 0.2), 'container': ('w', 6, 'd', 2.4),
               'torreTrelica': ('w', 2.4, 'w', 2.4), 'portao': ('w', 4, 'd', 2.2), 'banco': ('w', 1.8, None, 0.5), 'transformador': ('w', 3.2, 'd', 2.2), 'portico': ('w', 8, None, 0.9), 'cabo': (None, 0.3, 'l', 20), 'radar': (None, 3.2, None, 0.4), 'veiculo': (None, 1.8, None, 3.8), 'guindaste': (None, 3, None, 3.6)})
# Peças redondas vistas de cima: raio padrão, quando o mapa não informa "r".
RAIO = {'mesaRedonda': 0.6, 'cilindro': 0.5, 'rocha': 1, 'arvore': 2, 'pinheiro': 1.5, 'arbusto': 0.6, 'domo': 4, 'parabolica': 3, 'palmeira': 1.1, 'poste': 0.25, 'chafariz': 2.4, 'fogueira': 1.1}


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if len(a) < 2: sys.exit(__doc__)
    contorno, rotulos = '--contorno' in a, '--sem-rotulos' not in a
    d = normalizar(json.load(open(a[0], encoding='utf-8')))
    W, H, rgb = ler_png(os.path.join(RAIZ, d['imagem']))
    zoom = zoom_inteiro(a); clarear = opcao(a, '--clarear', 1, [1.0])[0]
    recortes = opcoes(a, '--recorte', 4) or [[0, 0, W, H]]
    raiz, ext = os.path.splitext(a[1])
    for n, r in enumerate(recortes, 1):
        saida = a[1] if len(recortes) == 1 else f'{raiz}_{n}{ext}'
        x0, y0, rw, rh = [int(v) for v in r]
        rw, rh = min(rw, W - x0), min(rh, H - y0)
        t = recortar(W, H, rgb, x0, y0, rw, rh, zoom, clarear)
        E = d['escala']
        P = lambda x, y: ((x - x0) * zoom, (y - y0) * zoom)
        BRANCO, LARANJA, AZUL, CIANO, AMARELO, ROSA, VERDE, OURO, CINZA, CLARO = (245, 240, 225), (255, 150, 50), (90, 140, 255), (110, 210, 255), (255, 220, 60), (255, 100, 215), (100, 255, 140), (255, 200, 120), (160, 165, 175), (80, 215, 255); AGUA = (60, 255, 200)

        for nome, rets in d.get('salas', {}).items():
            for r in rets:
                t.retangulo(*P(r[0], r[1]), *P(r[2], r[3]), AZUL, 2, 0.22)
                if rotulos: t.texto('SALA ' + nome, P(min(r[0], r[2]), min(r[1], r[3]))[0] + 14, P(min(r[0], r[2]), min(r[1], r[3]))[1] + 14, AZUL)
        for pl in d.get('plataformas') or []:
            c = contorno_de(pl)
            if not c: continue
            t.poligono([P(q[0], q[1]) for q in c], AGUA, 3)
            if rotulos: t.texto(f'PLATAFORMA {pl.get("altura", 0):g} M', P(*c[0])[0] + 8, P(*c[0])[1] + 8, AGUA)
        for pr in d.get('predios') or []:
            r = pr.get('area')
            if isinstance(r, list) and len(r) == 4:
                t.retangulo(*P(r[0], r[1]), *P(r[2], r[3]), OURO, 2)
                if rotulos: t.texto(f'PREDIO {pr.get("altura", 3):g} M', P(min(r[0], r[2]), min(r[1], r[3]))[0] + 4, P(min(r[0], r[2]), min(r[1], r[3]))[1] + 4, OURO, 1)
        for pz in d.get('pisos') or []:
            c = contorno_de(pz)
            if c: t.poligono([P(q[0], q[1]) for q in c], CINZA, 2)
        for q in d.get('decalques') or []:
            if not isinstance(q.get('x'), (int, float)): continue
            rc = q.get('recorte'); prop = (rc[3] - rc[1]) / (rc[2] - rc[0]) if rc else 0.5625
            g = math.radians(q.get('giro', 0)); cx, cy = P(q['x'], q['y']); hw = q.get('largura', 10) / E / 2 * zoom; hd = hw * prop
            canto = lambda lx, ly: (cx + lx * math.cos(g) + ly * math.sin(g), cy - lx * math.sin(g) + ly * math.cos(g))
            t.poligono([canto(-hw, -hd), canto(hw, -hd), canto(hw, hd), canto(-hw, hd)], VERDE, 2)
        for f in d.get('folhas') or []:
            fr, la = f.get('frente'), f.get('lado') or f.get('frente')
            if not (isinstance(fr, list) and isinstance(f.get('x'), (int, float))): continue
            fw = f.get('largura', 20); fh = fw * (fr[3] - fr[1]) / (fr[2] - fr[0]); fd = f.get('profundidade') or fh * (la[2] - la[0]) / (la[3] - la[1])
            g = math.radians(f.get('giro', 0)); cx, cy = P(f['x'], f['y']); hw, hd = fw / E / 2 * zoom, fd / E / 2 * zoom
            canto = lambda lx, ly: (cx + lx * math.cos(g) + ly * math.sin(g), cy - lx * math.sin(g) + ly * math.cos(g))
            t.poligono([canto(-hw, -hd), canto(hw, -hd), canto(hw, hd), canto(-hw, hd)], ROSA, 3); t.linha(cx, cy, *canto(0, hd + 6 * zoom), ROSA, 3)
            if rotulos: t.texto(f'FOLHA {fw:g} X {fd:.0f} X {fh:.0f} M', cx - hw + 4, cy - hd + 4, ROSA, 1)
        if d.get('moldura'): m = d['moldura']; t.retangulo(*P(m[0], m[1]), *P(m[2], m[3]), BRANCO, 1)
        for l in d.get('luzes', []): t.circulo(*P(l['x'], l['y']), 4 * zoom, AMARELO)
        for m in d.get('moveis', []):
            kw, pw, kd, pd = PEGADA.get(m.get('tipo'), ('w', 1, 'd', 1))
            redondo = m.get('tipo') in ('mesaRedonda', 'cilindro', 'barril', 'banqueta') or m.get('tipo') in RAIO
            if m.get('tipo') in RAIO: w = dp = 2 * m.get('r', RAIO[m['tipo']])
            elif m.get('tipo') == 'torreAndares': w = m.get('w', 8); dp = m.get('d', w)
            else: w = m.get(kw, pw) if kw else pw; dp = m.get(kd, pd) if kd else pd
            g = math.radians(m.get('giro', 0)); cx, cy = P(m['x'], m['y']); hw, hd = w / E / 2 * zoom, dp / E / 2 * zoom
            # O gurupés sai do ponto dado e vai para a frente; as outras peças ficam centradas no ponto.
            if m.get('tipo') in ('gurupes', 'cabo'): cx += hd * math.sin(g); cy += hd * math.cos(g)
            # giro 0 = frente para baixo na planta; 90 = para a direita
            canto = lambda lx, ly: (cx + lx * math.cos(g) + ly * math.sin(g), cy - lx * math.sin(g) + ly * math.cos(g))
            if redondo: t.circulo(cx, cy, hw, CIANO, cheio=False)
            else:
                t.poligono([canto(-hw, -hd), canto(hw, -hd), canto(hw, hd), canto(-hw, hd)], CIANO, 2)
                t.linha(cx, cy, *canto(0, hd + 4 * zoom), CIANO, 2)
            if rotulos: t.texto(m.get('tipo', '?') + (' +' + str(m['alt']) if m.get('alt') else ''), cx + 4, cy - 12, CIANO, 1 if zoom == 1 else 2)
        for s in d.get('barreiras', []): t.linha(*P(s[0], s[1]), *P(s[2], s[3]), CLARO, 2, 1, 8)
        for s in d.get('grades', []): t.linha(*P(s[0], s[1]), *P(s[2], s[3]), CINZA, 3, 1, 4)
        for w in d.get('paredes', []):
            o = {'p': w} if isinstance(w, list) else w
            esp = max(3, int((o.get('esp', d.get('espParede', 0.22)) / E) * zoom))
            (ax, ay), (bx, by) = P(o['p'][0], o['p'][1]), P(o['p'][2], o['p'][3])
            if contorno:
                # Mostra a área que a parede 3D ocupa de verdade: meia espessura para cada lado e além de cada ponta.
                n = math.hypot(bx - ax, by - ay) or 1; ux, uy = (bx - ax) / n, (by - ay) / n; h = esp / 2
                t.poligono([(ax - ux * h - uy * h, ay - uy * h + ux * h), (bx + ux * h - uy * h, by + uy * h + ux * h), (bx + ux * h + uy * h, by + uy * h - ux * h), (ax - ux * h + uy * h, ay - uy * h - ux * h)], BRANCO, 1)
                t.linha(ax, ay, bx, by, BRANCO, 1, 1, 3)
            else: t.linha(ax, ay, bx, by, BRANCO, esp, 0.85)
        for i, p in enumerate(d.get('portas', [])):
            s = p['p']; t.linha(*P(s[0], s[1]), *P(s[2], s[3]), LARANJA, max(4, 3 * zoom))
            if rotulos: t.texto(('FIXA' if p.get('fixa') else 'PORTA ' + ','.join(p.get('revela', []))), P((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)[0] + 6, P((s[0] + s[2]) / 2, (s[1] + s[3]) / 2)[1] - 14, LARANJA)

        def seta(de, para, cor, rotulo):
            ax, ay = P(*de); bx, by = P(*para); ang = math.atan2(by - ay, bx - ax)
            t.linha(ax, ay, bx, by, cor, 2); t.circulo(ax, ay, 5, cor)
            for s in (-0.4, 0.4): t.linha(bx, by, bx - 12 * math.cos(ang + s), by - 12 * math.sin(ang + s), cor, 2)
            t.texto(rotulo, ax + 8, ay - 14, cor)
        for c in d.get('cameras', []): seta(c['de'], c['para'], ROSA, c.get('nome', 'CAMERA'))
        if d.get('chegada'): seta(d['chegada']['de'], d['chegada']['para'], VERDE, 'CHEGADA')
        for p in d.get('passagens', []):
            x, y = P(p['x'], p['y']); t.poligono([(x, y - 8), (x + 8, y), (x, y + 8), (x - 8, y)], OURO, 3)
            t.texto(p.get('nome', 'PASSAGEM'), x + 12, y - 4, OURO)
        if '--passo' in a: desenhar_grade(t, x0, y0, rw, rh, zoom, int(opcao(a, '--passo', 1, [100])[0]))
        escrever_png(saida, t.w, t.h, t.pix)
        print(f'{saida}: {t.w} x {t.h} px' + (f' (recorte começa em {x0},{y0}; zoom {zoom})' if (x0, y0, zoom) != (0, 0, 1) else ''))


if __name__ == '__main__':
    main()
