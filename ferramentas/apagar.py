#!/usr/bin/env python3
"""Apaga da planta uma pintura que atrapalha, copiando por cima um pedaço vizinho do piso (carimbo).

Uso:
  python3 ferramentas/apagar.py entrada.png saida.png --area X0 Y0 X1 Y1 --de DX DY
  python3 ferramentas/apagar.py entrada.png saida.png --area 620 340 665 540 --de 60 0 --area 850 330 890 550 --de -70 0
  python3 ferramentas/apagar.py entrada.png saida.png --preencher 300 200 380 260
  python3 ferramentas/apagar.py planta.png planta_chao.png --predios mapas/meu_mapa.json
  python3 ferramentas/apagar.py planta.png saida.png --ladrilhar 520 800 710 900 --amostra 525 445 600 490
  python3 ferramentas/apagar.py planta.png saida.png --colar 140 10 192 90 --em 560 810

--area  O retângulo a apagar, em pixels.
--de    De onde copiar, como deslocamento em relação à área: "--de 60 0" copia do que está 60 px à direita;
        "--de 0 -40", do que está 40 px acima. Escolha um vizinho com o mesmo piso (as mesmas tábuas, a mesma água)
        e desloque ao longo do desenho dele: num convés de tábuas horizontais, desloque na horizontal.
--borda Largura, em pixels, da transição suave na beira da área (padrão 6).
--preencher X0 Y0 X1 Y1
        Em vez de copiar um vizinho, cobre o retângulo com as cores da própria beira, misturadas (um remendo liso de
        chão). Serve quando não há vizinho igual para copiar: um prédio pintado, um rótulo, uma sombra grande.
--ladrilhar X0 Y0 X1 Y1 --amostra SX0 SY0 SX1 SY1
        "Print" de um pedaço da pintura usado como remendo: cobre a área repetindo a amostra (o retângulo SX0 SY0
        SX1 SY1 da própria imagem), espelhada a cada repetição para a emenda não aparecer. É o jeito de continuar
        uma rua, um estacionamento, um gramado ou um piso onde sobrou um buraco. Escolha uma amostra limpa (sem
        carro, sem sombra forte) e o maior pedaço que conseguir.
--colar SX0 SY0 SX1 SY1 --em X Y
        Copia um pedaço da pintura (uma casa, uma árvore, uma faixa de pedestre) para outro lugar: o canto de cima
        à esquerda da cópia fica em X Y.
--predios mapas/meu_mapa.json
        Faz o --preencher sozinho para cada prédio do mapa que tem "fachada": tira do chão o telhado e a fachada
        pintados, que sobrariam atrás do prédio 3D. Grave com outro nome, aponte "imagem" para o arquivo novo e
        "imagemPredios" para o original, de onde os telhados e as fachadas continuam saindo.

Cada --area usa o --de que vem depois dela. Serve para velas e sombras pintadas no convés, móveis pintados onde
entrou uma peça 3D menor, letreiros no chão. Funciona bem em piso regular (tábuas, ladrilho, água, neve) e mal
em desenho complicado. Guarde a original: grave a saída com outro nome e aponte o mapa para ela.
"""
import sys
from imagem import ler_png, escrever_png
from grade import opcoes


def preencher(saida, W, H, x0, y0, x1, y1):
    """Cobre o retângulo com as cores da sua própria beira, misturadas pela distância (um remendo liso de chão)."""
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 - x0 < 2 or y1 - y0 < 2: return
    px = lambda x, y: saida[(y * W + x) * 3:(y * W + x) * 3 + 3]
    def faixa(pontos):  # cores de uma beira, suavizadas ao longo dela
        cs = [px(x, y) for x, y in pontos]; n = len(cs); out = []
        for i in range(n):
            viz = cs[max(0, i - 28):i + 29]; out.append([sum(c[k] for c in viz) / len(viz) for k in range(3)])  # média larga: sem riscos
        return out
    topo = faixa([(x, y0 - 2) for x in range(x0, x1)]) if y0 >= 2 else None
    pe = faixa([(x, y1 + 1) for x in range(x0, x1)]) if y1 + 1 < H else None
    esq = faixa([(x0 - 2, y) for y in range(y0, y1)]) if x0 >= 2 else None
    dire = faixa([(x1 + 1, y) for y in range(y0, y1)]) if x1 + 1 < W else None
    for y in range(y0, y1):
        for x in range(x0, x1):
            soma = [0.0, 0.0, 0.0]; peso = 0.0
            for cor, d in ((topo and topo[x - x0], y - y0), (pe and pe[x - x0], y1 - 1 - y), (esq and esq[y - y0], x - x0), (dire and dire[y - y0], x1 - 1 - x)):
                if cor is None: continue
                w = 1.0 / (d + 2) ** 2; peso += w
                for k in range(3): soma[k] += cor[k] * w
            if not peso: continue
            g = ((x * 73856093) ^ (y * 19349663)) % 13 - 6  # granulado leve, para não ficar chapado
            k0 = (y * W + x) * 3
            for k in range(3): saida[k0 + k] = max(0, min(255, int(soma[k] / peso + g)))


def carimbar(saida, W, H, amostra, x0, y0, x1, y1, borda):
    """Cobre o retângulo repetindo a amostra (um "print" de outro pedaço da pintura), espelhada a cada repetição
    para a emenda não aparecer, e com a beira suavizada."""
    sx0, sx1 = sorted((int(amostra[0]), int(amostra[2]))); sy0, sy1 = sorted((int(amostra[1]), int(amostra[3])))
    sw, sh = sx1 - sx0, sy1 - sy0
    if sw < 2 or sh < 2: sys.exit('A amostra precisa ter pelo menos 2 px de lado.')
    fonte = bytes(saida); x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    for y in range(y0, y1):
        j = (y - y0) % (2 * sh); sy = sy0 + (j if j < sh else 2 * sh - 1 - j)
        for x in range(x0, x1):
            i = (x - x0) % (2 * sw); sx = sx0 + (i if i < sw else 2 * sw - 1 - i)
            m = min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y); w = 1.0 if m >= borda else (m + 1) / (borda + 1)
            k, f = (y * W + x) * 3, (sy * W + sx) * 3
            if w >= 1: saida[k:k + 3] = fonte[f:f + 3]
            else:
                for c in range(3): saida[k + c] = int(saida[k + c] * (1 - w) + fonte[f + c] * w)


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    areas, des, cheias = opcoes(a, '--area', 4), opcoes(a, '--de', 2), opcoes(a, '--preencher', 4)
    ladrilhos, amostras, colas, ems = opcoes(a, '--ladrilhar', 4), opcoes(a, '--amostra', 4), opcoes(a, '--colar', 4), opcoes(a, '--em', 2)
    if len(ladrilhos) != len(amostras) or len(colas) != len(ems): sys.exit('Cada --ladrilhar precisa da sua --amostra, e cada --colar do seu --em.')
    mapa = a[a.index('--predios') + 1] if '--predios' in a else None
    if len(a) < 2 or len(areas) != len(des) or not (areas or cheias or mapa or ladrilhos or colas): sys.exit(__doc__)
    borda = int(opcoes(a, '--borda', 1)[0][0]) if '--borda' in a else 6
    W, H, rgb = ler_png(a[0]); saida = bytearray(rgb)
    # As áreas são aplicadas em sequência: cada uma já enxerga o resultado das anteriores.
    for (x0, y0, x1, y1), (dx, dy) in zip(areas, des):
        origem = bytes(saida)
        x0, x1 = sorted((int(x0), int(x1))); y0, y1 = sorted((int(y0), int(y1))); dx, dy = int(dx), int(dy)
        x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
        fora = 0
        for y in range(y0, y1):
            sy = y + dy
            for x in range(x0, x1):
                sx = x + dx
                if not (0 <= sx < W and 0 <= sy < H): fora += 1; continue
                # Peso 1 no miolo da área e caindo a 0 na beira, para a emenda não aparecer.
                m = min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y); w = 1.0 if m >= borda else (m + 1) / (borda + 1)
                k, s = (y * W + x) * 3, (sy * W + sx) * 3
                if w >= 1: saida[k:k + 3] = origem[s:s + 3]
                else:
                    for c in range(3): saida[k + c] = int(origem[k + c] * (1 - w) + origem[s + c] * w)
        aviso = f' ({fora} px ficaram como estavam: a origem caía fora da imagem)' if fora else ''
        print(f'área {x0},{y0} a {x1},{y1}: coberta com o que estava a {dx:+d},{dy:+d}{aviso}')
    for r in cheias:
        x0, x1 = sorted((int(r[0]), int(r[2]))); y0, y1 = sorted((int(r[1]), int(r[3])))
        preencher(saida, W, H, x0, y0, x1, y1); print(f'área {x0},{y0} a {x1},{y1}: preenchida com as cores da beira')
    if mapa:
        import json
        n = 0
        for pr in json.load(open(mapa, encoding='utf-8')).get('predios') or []:
            r, f, sil = pr.get('area'), pr.get('fachada') or 0, pr.get('silhueta')
            if isinstance(sil, list) and len(sil) >= 3:  # prédio recortado: sai do chão tudo o que a silhueta cobre
                xs, ys = [q[0] for q in sil], [q[1] for q in sil]
                preencher(saida, W, H, int(min(xs)) - 3, int(min(ys)) - 3, int(max(xs)) + 3, int(max(ys)) + 2); n += 1; continue
            if not (isinstance(r, list) and len(r) == 4 and f > 0): continue
            # O prédio 3D fica no pé da fachada; o telhado e a fachada pintados atrás dele saem do chão.
            preencher(saida, W, H, int(min(r[0], r[2])) - 3, int(min(r[1], r[3])) - 3, int(max(r[0], r[2])) + 3, int(max(r[1], r[3]) + f) + 2); n += 1
        print(f'{n} prédios com fachada: a pintura de cada um foi tirada do chão')
    for r_, am in zip(ladrilhos, amostras):
        x0, x1 = sorted((int(r_[0]), int(r_[2]))); y0, y1 = sorted((int(r_[1]), int(r_[3])))
        carimbar(saida, W, H, am, x0, y0, x1, y1, borda); print(f'área {x0},{y0} a {x1},{y1}: coberta com a amostra {[int(v) for v in am]}, repetida')
    for c, em in zip(colas, ems):
        w, h = abs(int(c[2] - c[0])), abs(int(c[3] - c[1])); x0, y0 = int(em[0]), int(em[1])
        carimbar(saida, W, H, c, x0, y0, x0 + w, y0 + h, min(borda, 3)); print(f'amostra {[int(v) for v in c]} colada em {x0},{y0}')
    escrever_png(a[1], W, H, saida)
    print(f'{a[1]}: {W} x {H} px. Olhe o resultado com grade.py; se a emenda aparecer, mude o --de ou divida a área.')


if __name__ == '__main__':
    main()
