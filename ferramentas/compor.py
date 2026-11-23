#!/usr/bin/env python3
"""Monta um chão grande com pedaços de uma pintura espalhados e ligados por trilhas: o lago num canto, a cabana longe dele,
a aldeia num terceiro lugar, e caminhos de terra entre eles. É o jeito de "afastar tudo de tudo" sem mudar a escala
(mudando a escala, as casas viram casas de gigante).

Uso:
  python3 ferramentas/compor.py chao_novo.png --tamanho 4000 3200 --fundo pintura.png 40 300 200 420 \\
      --peca pintura.png 250 110 1150 660 --em 1500 1400 --k 0.8 --forma elipse \\
      --peca pintura.png 50 430 300 560 --em 600 2600 --k 0.8 \\
      --trilha 600 2520 900 2200 1150 1900 --largura 40 --terra pintura.png 180 700 260 760

--tamanho W H              Tamanho da imagem nova, em px. A escala do mapa é a da pintura dividida por --k
                           (pintura a 0,1 m/px com --k 0.8 dá 0,125 m/px no chão novo).
--fundo ARQ X0 Y0 X1 Y1    Pedaço de chão limpo da pintura (grama, terra, areia, neve), repetido e espelhado para cobrir
                           tudo. Escolha o maior pedaço sem caminho, pedra, sombra nem quadrícula (olhe com grade.py):
                           qualquer detalhe nele se repete pelo chão inteiro. Tire a quadrícula antes (quadricula.py).
--escurecer F              Escurece o fundo (0,8 = 20% mais escuro), para o que veio da pintura se destacar.
--peca ARQ X0 Y0 X1 Y1     Recorta esse retângulo de uma pintura. Depois dela, valem só para ela:
   --em X Y                onde fica o meio do pedaço no chão novo (obrigatório);
   --k F                   tamanho (padrão 1); use o mesmo --k em todas, ou a escala muda de um pedaço para o outro;
   --forma elipse          a beira do pedaço segue uma elipse dentro do retângulo, em vez do próprio retângulo;
   --borda N               largura da emenda suave com o chão, em px do chão novo (padrão 40; nunca mais que um quarto
                           do menor lado do pedaço). A beira é irregular, para não aparecer um retângulo.
--trilha X Y X Y ...       Caminho de terra passando por esses pontos (px do chão novo), em curva suave. Depois dela:
   --largura N             largura em px (padrão 36);
   --terra ARQ X0 Y0 X1 Y1 pedaço de trilha da pintura para repetir dentro do caminho (sem ele, --cor-trilha). Tem de
                           ser todo terra, sem a beira de grama do caminho, senão a beira vira listras;
   --cor-trilha "#rrggbb"  cor da terra quando não há --terra (padrão #7a6444).
                           Uma trilha que só leva para dentro da mata e acaba é só uma trilha com o último ponto no mato.

As trilhas são pintadas antes dos pedaços: a ponta de uma trilha que chega num pedaço fica embaixo da emenda dele.
No fim, a ferramenta imprime como levar uma posição lida na pintura para o chão novo, pedaço por pedaço.
Depois: o mapa usa a imagem nova em "imagem", com "escala" = escala da pintura / k; as peças 3D de cada pedaço
mudam de lugar pela conta impressa. Confira o resultado com grade.py.
"""
import math, sys
from imagem import ler_png, escrever_png, redimensionar

_cache = {}
def imagem(arq):
    if arq not in _cache: _cache[arq] = ler_png(arq)
    return _cache[arq]


def ruido(x, y):
    """Ruído suave de 0 a 1 (soma de senos), para a beira dos pedaços e a largura das trilhas não ficarem retas."""
    return 0.5 + 0.2 * math.sin(x * 0.031 + y * 0.017) + 0.15 * math.sin(x * 0.011 - y * 0.023 + 1.7) + 0.15 * math.sin((x + y) * 0.057 + 0.4)


class Amostra:
    """Um pedaço de imagem repetido e espelhado, com cada faixa deslocada para as colunas não se alinharem."""
    def __init__(self, arq, r):
        w, h, rgb = imagem(arq); x0, y0, x1, y1 = r
        if not (0 <= x0 < x1 <= w and 0 <= y0 < y1 <= h): sys.exit(f'{arq}: o retângulo {r} sai da imagem ({w} x {h}).')
        self.tw, self.th = x1 - x0, y1 - y0
        lin = [bytes(rgb[((y0 + y) * w + x0) * 3:((y0 + y) * w + x1) * 3]) for y in range(self.th)]
        esp = lambda l: b''.join(l[k:k + 3] for k in range(len(l) - 3, -3, -3))
        self.par = [l + esp(l) for l in lin]
    def linha(self, y, W):
        j = y % (2 * self.th); k = j if j < self.th else 2 * self.th - 1 - j
        p = self.par[k]; n = len(p); d = ((y // self.th) * 2654435761 % (n // 3)) * 3
        return (p * (W * 3 // n + 3))[d:d + W * 3]
    def px(self, x, y):
        j = y % (2 * self.th); k = j if j < self.th else 2 * self.th - 1 - j
        p = self.par[k]; n = len(p); d = ((y // self.th) * 2654435761 % (n // 3)) * 3
        i = (d + x * 3) % n; return p[i], p[i + 1], p[i + 2]


def catmull(pts, passo=8):
    """Curva suave que passa por todos os pontos."""
    if len(pts) < 3: return pts
    q = [pts[0]] + pts + [pts[-1]]; out = []
    for i in range(1, len(q) - 2):
        p0, p1, p2, p3 = q[i - 1], q[i], q[i + 1], q[i + 2]
        n = max(2, int(math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / passo))
        for s in range(n):
            t = s / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3) for c in (0, 1)))
    out.append(pts[-1]); return out


def ler_args(a):
    """Separa as opções gerais, os pedaços e as trilhas (as opções de cada um vêm logo depois dele)."""
    geral, pecas, trilhas = {}, [], []; atual = None; i = 1
    def nums(k, n): return [float(v) for v in a[k:k + n]]
    while i < len(a):
        o = a[i]
        if o == '--peca': atual = {'arq': a[i + 1], 'r': [int(v) for v in nums(i + 2, 4)], 'k': 1.0, 'borda': 40, 'forma': 'ret'}; pecas.append(atual); i += 6
        elif o == '--trilha':
            j = i + 1; pts = []
            while j + 1 < len(a) and not a[j].startswith('--'): pts.append((float(a[j]), float(a[j + 1]))); j += 2
            atual = {'pts': pts, 'largura': 36, 'terra': None, 'cor': (0x7a, 0x64, 0x44)}; trilhas.append(atual); i = j
        elif o == '--em': atual['em'] = nums(i + 1, 2); i += 3
        elif o == '--k': atual['k'] = float(a[i + 1]); i += 2
        elif o == '--borda': atual['borda'] = int(float(a[i + 1])); i += 2
        elif o == '--forma': atual['forma'] = a[i + 1]; i += 2
        elif o == '--largura': atual['largura'] = float(a[i + 1]); i += 2
        elif o == '--terra': atual['terra'] = (a[i + 1], [int(v) for v in nums(i + 2, 4)]); i += 6
        elif o == '--cor-trilha': h = a[i + 1].lstrip('#'); atual['cor'] = tuple(int(h[k:k + 2], 16) for k in (0, 2, 4)); i += 2
        elif o == '--tamanho': geral['tamanho'] = [int(v) for v in nums(i + 1, 2)]; i += 3
        elif o == '--fundo': geral['fundo'] = (a[i + 1], [int(v) for v in nums(i + 2, 4)]); i += 6
        elif o == '--escurecer': geral['escurecer'] = float(a[i + 1]); i += 2
        else: sys.exit(f'Opção desconhecida ou fora do lugar: {o}. Veja --help.')
    return geral, pecas, trilhas


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    geral, pecas, trilhas = ler_args(a)
    if 'tamanho' not in geral or 'fundo' not in geral: sys.exit('Precisa de --tamanho e --fundo. Veja --help.')
    W, H = geral['tamanho']; fundo = Amostra(*geral['fundo'])
    out = bytearray(W * H * 3)
    for y in range(H): out[y * W * 3:(y + 1) * W * 3] = fundo.linha(y, W)
    esc = geral.get('escurecer', 1.0)
    if esc < 0.999:
        tab = bytes(min(255, int(v * esc + 0.5)) for v in range(256)); out = bytearray(bytes(out).translate(tab))
    # trilhas
    for t in trilhas:
        pts = catmull(t['pts']); r0 = t['largura'] / 2; terra = Amostra(*t['terra']) if t['terra'] else None
        cobre = {}
        s_acum = 0.0
        for (xa, ya), (xb, yb) in zip(pts, pts[1:]):
            L = math.hypot(xb - xa, yb - ya) or 1; ux, uy = (xb - xa) / L, (yb - ya) / L
            r = r0 * (0.85 + 0.3 * ruido(s_acum, 0))      # a largura varia um pouco ao longo do caminho
            for y in range(max(0, int(min(ya, yb) - r - 2)), min(H, int(max(ya, yb) + r + 3))):
                for x in range(max(0, int(min(xa, xb) - r - 2)), min(W, int(max(xa, xb) + r + 3))):
                    s = max(0.0, min(L, (x - xa) * ux + (y - ya) * uy))
                    d = math.hypot(x - (xa + ux * s), y - (ya + uy * s))
                    if d >= r: continue
                    al = min(1.0, (r - d) / (0.45 * r)); i = y * W + x
                    if al > cobre.get(i, 0): cobre[i] = al
            s_acum += L
        for i, al in cobre.items():
            x, y = i % W, i // W; c = terra.px(x, y) if terra else t['cor']
            if not terra: c = tuple(min(255, max(0, int(v * (0.92 + 0.16 * ruido(x * 3, y * 3))))) for v in c)
            k = i * 3
            for ch in range(3): out[k + ch] = int(out[k + ch] * (1 - al) + c[ch] * al + 0.5)
        print(f'trilha com {len(t["pts"])} pontos, {s_acum:.0f} px de comprimento, {t["largura"]:.0f} px de largura')
    # pedaços
    for n, p in enumerate(pecas, 1):
        if 'em' not in p: sys.exit(f'pedaço {n}: falta --em X Y (onde fica o meio dele no chão novo).')
        w, h, rgb = imagem(p['arq']); x0, y0, x1, y1 = p['r']
        if not (0 <= x0 < x1 <= w and 0 <= y0 < y1 <= h): sys.exit(f'pedaço {n}: o retângulo {p["r"]} sai da imagem ({w} x {h}).')
        nw, nh = max(1, round((x1 - x0) * p['k'])), max(1, round((y1 - y0) * p['k']))
        px, _ = redimensionar(w, rgb, None, p['r'], nw, nh)
        cx, cy = p['em']; ox, oy = round(cx - nw / 2), round(cy - nh / 2)
        b = max(1, min(p['borda'], min(nw, nh) // 4))   # num pedaço pequeno, a emenda não come o desenho
        for yy in range(nh):
            Y = oy + yy
            if not 0 <= Y < H: continue
            for xx in range(nw):
                X = ox + xx
                if not 0 <= X < W: continue
                if p['forma'] == 'elipse':
                    rx, ry = nw / 2, nh / 2; e = math.hypot((xx + 0.5 - rx) / rx, (yy + 0.5 - ry) / ry)
                    dist = (1 - e) * min(rx, ry)
                else: dist = min(xx, yy, nw - 1 - xx, nh - 1 - yy)
                dist -= b * 0.6 * ruido(X, Y)              # beira irregular
                if dist <= 0: continue
                al = min(1.0, dist / (b * 0.5)); al = al * al * (3 - 2 * al)
                s, d = (yy * nw + xx) * 3, (Y * W + X) * 3
                for ch in range(3): out[d + ch] = int(out[d + ch] * (1 - al) + px[s + ch] * al + 0.5)
        k = p['k']; mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        print(f'pedaço {n} ({p["arq"]} {p["r"]}): no chão novo, x = {cx:g} + (x_pintura - {mx:g}) * {k:g};  y = {cy:g} + (y_pintura - {my:g}) * {k:g}')
    escrever_png(a[0], W, H, out)
    ks = sorted(set(p['k'] for p in pecas))
    print(f'{a[0]}: {W} x {H} px.' + (f' Escala do mapa = escala da pintura / {ks[0]:g}.' if len(ks) == 1 else ' Atenção: os pedaços têm --k diferentes, então cada um fica numa escala.'))


if __name__ == '__main__':
    main()
