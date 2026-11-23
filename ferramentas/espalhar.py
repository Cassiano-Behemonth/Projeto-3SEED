#!/usr/bin/env python3
"""Espalha mata pelo chão do mapa e encaixa postes na calçada, sem pôr nada em cima de prédios, água ou câmeras.

Uso:
  python3 ferramentas/espalhar.py mapas/meu_mapa.json arvores.json --mata
  python3 ferramentas/espalhar.py mapas/meu_mapa.json arvores.json --mata --zona 700 0 1130 345 --zona 0 0 300 200 --passo 22
  python3 ferramentas/espalhar.py mapas/meu_mapa.json postes.json --postes 420 180 735 520 100 800

--mata         Árvores onde o chão é verde (mato, grama escura). Sem --zona, vale a imagem inteira.
--zona X0 Y0 X1 Y1   Só nessa área (pode repetir). Use para dizer onde é mata de verdade e onde é gramado.
--fora X0 Y0 X1 Y1   Nada nessa área (pode repetir): clareiras, trilhas, a frente de uma casa.
--passo N      Distância média entre árvores, em pixels (padrão 24). A posição de cada uma varia um pouco.
--pinheiros F  Fração de pinheiros (padrão 0,7); o resto são árvores de copa redonda.
--cores "#24402a,#2a4a2c"   Cores das copas (padrão: quatro verdes escuros).
--postes X Y ...   Pontos aproximados; cada um vai para a calçada mais próxima, longe do asfalto.
--altura M     Altura dos postes (padrão 4,5).

Não põe nada: dentro ou perto de prédios (predios, folhas, casa, torreAndares), decalques, pisos, paredes, água,
nem nos primeiros 20 m na frente de cada câmera. Grava em arvores.json (ou postes.json) uma lista de peças para
juntar ao campo "moveis" do mapa, no seu script. Olhe o resultado com previa.py e foto.py.
"""
import json, math, os, sys
from imagem import ler_png
from grade import opcao, opcoes
from formato import normalizar, contorno_de, dentro_de

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if len(a) < 3 or not ('--mata' in a or '--postes' in a): sys.exit(__doc__)
    d = normalizar(json.load(open(a[0], encoding='utf-8'))); E = d['escala']
    W, H, rgb = ler_png(os.path.join(RAIZ, d['imagem']))
    px = lambda x, y: rgb[(min(H - 1, max(0, int(y))) * W + min(W - 1, max(0, int(x)))) * 3:][:3]

    # Áreas ocupadas, em retângulos de pixels (com folga).
    ocupado = []; m = 1.5 / E
    for p in d.get('predios') or []:
        r = p.get('area'); f = p.get('fachada') or 0
        if r: ocupado.append((min(r[0], r[2]) - m, min(r[1], r[3]) - m, max(r[0], r[2]) + m, max(r[1], r[3]) + f + m))
    for f in d.get('folhas') or []:
        fr = f.get('frente'); la = f.get('lado') or fr
        if not fr: continue
        w = f.get('largura', 20); hh = w * (fr[3] - fr[1]) / (fr[2] - fr[0]); dp = f.get('profundidade') or hh * (la[2] - la[0]) / (la[3] - la[1])
        rr = math.hypot(w, dp) / 2 / E + m; ocupado.append((f['x'] - rr, f['y'] - rr, f['x'] + rr, f['y'] + rr))
    for q in d.get('decalques') or []:
        rc = q.get('recorte'); prop = (rc[3] - rc[1]) / (rc[2] - rc[0]) if rc else 0.6
        hw = q.get('largura', 10) / 2 / E; hd = hw * prop; rr = math.hypot(hw, hd)
        ocupado.append((q['x'] - rr, q['y'] - rr, q['x'] + rr, q['y'] + rr))
    poligonos = [contorno_de(z) for z in (d.get('pisos') or []) + (d.get('plataformas') or []) if contorno_de(z)]
    segmentos = [w['p'] for w in d.get('paredes') or [] if isinstance(w, dict) and 'p' in w] + [w for w in d.get('paredes') or [] if isinstance(w, list)] + list(d.get('grades') or [])
    pecas = [(mv['x'], mv['y']) for mv in d.get('moveis') or [] if isinstance(mv.get('x'), (int, float))]
    grandes = [(mv['x'], mv['y'], max(mv.get('w', 4), mv.get('d', 4)) / E) for mv in d.get('moveis') or [] if mv.get('tipo') in ('casa', 'torreAndares', 'domo', 'chafariz')]
    cameras = [(c['de'], c['para']) for c in d.get('cameras') or [] if isinstance(c.get('de'), list)]
    agua = d.get('agua'); cor_agua = None
    if isinstance(agua, dict) and agua.get('cor'): h = agua['cor'].lstrip('#'); cor_agua = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

    def dist_seg(x, y, s):
        dx, dy = s[2] - s[0], s[3] - s[1]; c = dx * dx + dy * dy
        t = max(0, min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / c)) if c else 0
        return math.hypot(x - s[0] - dx * t, y - s[1] - dy * t)

    def livre(x, y, folga):
        if any(r[0] <= x <= r[2] and r[1] <= y <= r[3] for r in ocupado): return False
        if any(dentro_de(pg, x, y) for pg in poligonos): return False
        if any(dist_seg(x, y, s) < folga for s in segmentos): return False
        if any(math.hypot(x - gx, y - gy) < gr / 2 + folga for gx, gy, gr in grandes): return False
        for de, para in cameras:   # corredor de 20 m na frente da câmera, 2 m para cada lado
            dx, dy = para[0] - de[0], para[1] - de[1]; n = math.hypot(dx, dy) or 1
            t = ((x - de[0]) * dx + (y - de[1]) * dy) / n
            if -1 / E < t < 20 / E and abs((x - de[0]) * dy - (y - de[1]) * dx) / n < 2 / E + folga: return False
        return True

    def sorte(i, k): v = math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - math.floor(v)
    saida = []
    if '--mata' in a:
        zonas = opcoes(a, '--zona', 4) or [[0, 0, W, H]]; foras = opcoes(a, '--fora', 4)
        passo = max(6, int(opcao(a, '--passo', 1, [24])[0])); fp = opcao(a, '--pinheiros', 1, [0.7])[0]
        cores = a[a.index('--cores') + 1].split(',') if '--cores' in a else ['#24402a', '#2a4a2c', '#31502a', '#203a26']
        def verde(x, y):
            r, g, b = (sum(px(x + dx, y + dy)[c] for dx in (-3, 0, 3) for dy in (-3, 0, 3)) / 9 for c in range(3))
            if cor_agua and math.dist((r, g, b), cor_agua) < 40: return False
            return g >= r * 0.98 and g > b * 1.15 and 25 < g < 130
        n = 0
        for x0, y0, x1, y1 in zonas:
            for y in range(int(y0) + passo // 2, int(y1), passo):
                for x in range(int(x0) + passo // 2, int(x1), passo):
                    n += 1
                    cx, cy = x + (sorte(n, 1) - 0.5) * passo * 0.8, y + (sorte(n, 2) - 0.5) * passo * 0.8
                    if not (0 <= cx < W and 0 <= cy < H) or not verde(cx, cy) or not livre(cx, cy, 1.5 / E): continue
                    if any(fx0 <= cx <= fx1 and fy0 <= cy <= fy1 for fx0, fy0, fx1, fy1 in foras): continue
                    if any(math.hypot(cx - qx, cy - qy) < passo * 0.45 for qx, qy in pecas): continue
                    cor = cores[int(sorte(n, 3) * len(cores))]
                    if sorte(n, 4) < fp: saida.append({'tipo': 'pinheiro', 'x': round(cx), 'y': round(cy), 'h': round(8 + sorte(n, 5) * 5, 1), 'r': round(2 + sorte(n, 6) * 0.9, 1), 'cor': cor})
                    else: saida.append({'tipo': 'arvore', 'x': round(cx), 'y': round(cy), 'h': round(6 + sorte(n, 5) * 3, 1), 'r': round(2.2 + sorte(n, 6), 1), 'cor': cor})
                    pecas.append((cx, cy))
        print(f'{len(saida)} árvores')
    if '--postes' in a:
        i = a.index('--postes') + 1; nums = []
        while i < len(a) and not a[i].startswith('--'): nums.append(float(a[i])); i += 1
        alt = opcao(a, '--altura', 1, [4.5])[0]
        def rua(x, y):
            r, g, b = px(x, y); lum = (r + g + b) / 3
            return max(r, g, b) - min(r, g, b) < 16 and (lum < 69 or lum > 140)   # asfalto, ou faixa pintada nele
        def calcada(x, y):
            r, g, b = px(x, y); lum = (r + g + b) / 3
            return 69 <= lum <= 112 and max(r, g, b) - min(r, g, b) <= 22
        movidos = 0
        for k in range(0, len(nums) - 1, 2):
            x, y = nums[k], nums[k + 1]; achou = None
            for exigir in (True, False):
                for raio in range(0, 64, 2):
                    for j in range(max(1, raio * 2)):
                        ang = j * math.pi / max(1, raio); cx, cy = round(x + raio * math.cos(ang)), round(y + raio * math.sin(ang))
                        if not (6 < cx < W - 6 and 6 < cy < H - 6): continue
                        if any(rua(cx + dx, cy + dy) for dx in range(-4, 5, 2) for dy in range(-4, 5, 2)): continue
                        if (calcada(cx, cy) or not exigir) and livre(cx, cy, 0.5 / E): achou = (cx, cy); break
                    if achou: break
                if achou: break
            achou = achou or (round(x), round(y)); movidos += achou != (round(x), round(y))
            saida.append({'tipo': 'poste', 'x': achou[0], 'y': achou[1], 'h': alt, 'cor': '#1c1c1e'})
        print(f'{len(nums) // 2} postes ({movidos} levados para a calçada)')
    os.makedirs(os.path.dirname(os.path.abspath(a[1])), exist_ok=True)
    json.dump(saida, open(a[1], 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'{a[1]}: {len(saida)} peças. Junte-as ao campo "moveis" do mapa.')


if __name__ == '__main__':
    main()
