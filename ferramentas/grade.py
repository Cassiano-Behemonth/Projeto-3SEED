#!/usr/bin/env python3
"""Desenha uma grade numerada sobre uma imagem de planta, para ler posições em pixels.

Serve para quem (pessoa ou IA) vai escrever um mapa em arquivo: as paredes, portas e móveis
são dados em pixels da imagem, e a grade mostra que pixel é qual.

Uso:
  python3 ferramentas/grade.py planta.png saida.png                  # imagem inteira, linha a cada 100 px
  python3 ferramentas/grade.py planta.png saida.png --passo 50
  python3 ferramentas/grade.py planta.png saida.png --recorte 400 200 600 400 --zoom 2
      (recorta a região que começa em x=400, y=200, com 600 x 400 px, e amplia 2 vezes)
  python3 ferramentas/grade.py planta.png saida.png --recorte 0 0 500 400 --recorte 500 0 500 400 --zoom 2
      (vários recortes de uma vez: grava saida_1.png, saida_2.png... lendo a imagem uma vez só)
  python3 ferramentas/grade.py planta.png saida.png --clarear 2.5     # para plantas escuras
  python3 ferramentas/grade.py planta.png --cor 700 400 --cor 120 900   # só a cor desses pontos (sem gravar imagem)

Os números na grade são sempre pixels da imagem ORIGINAL, mesmo com recorte e zoom.
--cor X Y (pode repetir) imprime a cor do ponto em hexadecimal, a mediana de 5 x 5 px em volta dele: serve para
"corEntorno", "agua", a cor de uma parede ou de um móvel, e para saber se um ponto é calçada, asfalto, grama ou água.
Só usa a biblioteca padrão do Python e lê qualquer PNG.
"""
import os, sys
from imagem import Tela, ler_png, escrever_png


def opcao(a, nome, n, padrao):
    if nome in a:
        i = a.index(nome); return [float(v) for v in a[i + 1:i + 1 + n]]
    return padrao


def zoom_inteiro(a):
    z = opcao(a, '--zoom', 1, [1])[0]
    if z != int(z) or z < 1: sys.exit('--zoom precisa ser um número inteiro (1, 2, 3...).')
    return int(z)


def opcoes(a, nome, n):
    """Todas as ocorrências de uma opção que pode se repetir."""
    return [[float(v) for v in a[i + 1:i + 1 + n]] for i, v in enumerate(a) if v == nome]


def recortar(W, H, rgb, x0, y0, rw, rh, zoom, clarear=1.0):
    """Recorta, amplia e (se pedido) clareia; devolve uma Tela."""
    ow, oh = rw * zoom, rh * zoom; pix = bytearray(ow * oh * 3)
    for y in range(oh):
        sy = y0 + y // zoom; base = y * ow * 3
        if zoom == 1:
            pix[base:base + ow * 3] = rgb[(sy * W + x0) * 3:(sy * W + x0 + rw) * 3]
        elif y % zoom:
            pix[base:base + ow * 3] = pix[base - ow * 3:base]  # linha repetida do zoom
        else:
            for x in range(ow):
                k = (sy * W + x0 + x // zoom) * 3
                pix[base + x * 3:base + x * 3 + 3] = rgb[k:k + 3]
    if clarear != 1.0:
        tabela = bytes(min(255, int(v * clarear)) for v in range(256))
        pix = bytearray(bytes(pix).translate(tabela))
    return Tela(ow, oh, pix)


def cor_da_borda(W, H, rgb):
    """Cor mediana de uma moldura de 3% em volta da imagem, em hexadecimal."""
    m = max(2, int(min(W, H) * 0.03)); canais = ([], [], [])
    for y in range(0, H, 3):
        for x in range(0, W, 3):
            if x < m or x >= W - m or y < m or y >= H - m:
                k = (y * W + x) * 3
                for c in range(3): canais[c].append(rgb[k + c])
    return '#' + ''.join(f'{sorted(c)[len(c) // 2]:02x}' for c in canais)


def desenhar_grade(t, x0, y0, rw, rh, zoom, passo):
    AM = (255, 230, 0)
    primeiro = lambda ini: (ini // passo + (1 if ini % passo else 0)) * passo
    xs = list(range(primeiro(x0), x0 + rw, passo)); ys = list(range(primeiro(y0), y0 + rh, passo))
    for gx in xs: t.linha((gx - x0) * zoom, 0, (gx - x0) * zoom, t.h - 1, AM, 1, 0.6)
    for gy in ys: t.linha(0, (gy - y0) * zoom, t.w - 1, (gy - y0) * zoom, AM, 1, 0.6)
    # Rótulos: pula os que cairiam em cima do anterior (grade fina) e deixa o canto livre para o eixo x.
    ultimo = -999
    for gx in xs:
        px = (gx - x0) * zoom + 3
        if px - ultimo >= len(str(gx)) * 8 + 8: t.texto(gx, px, 3, AM); ultimo = px
    ultimo = -999
    for gy in ys:
        py = (gy - y0) * zoom + 3
        if py >= 18 and py - ultimo >= 16: t.texto(gy, 3, py, AM); ultimo = py


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    cores = opcoes(a, '--cor', 2); sem_saida = len(a) < 2 or a[1].startswith('--')
    if len(a) < 1 or (sem_saida and not cores): sys.exit(__doc__)
    passo = int(opcao(a, '--passo', 1, [100])[0]); zoom = zoom_inteiro(a); clarear = opcao(a, '--clarear', 1, [1.0])[0]
    W, H, rgb = ler_png(a[0])
    for x, y in cores:
        x, y = int(x), int(y)
        if not (0 <= x < W and 0 <= y < H): print(f'x {x}, y {y}: fora da imagem ({W} x {H} px)'); continue
        viz = [(xx, yy) for yy in range(max(0, y - 2), min(H, y + 3)) for xx in range(max(0, x - 2), min(W, x + 3))]
        c = [sorted(rgb[(yy * W + xx) * 3 + k] for xx, yy in viz)[len(viz) // 2] for k in range(3)]
        print(f'x {x}, y {y}: #{c[0]:02x}{c[1]:02x}{c[2]:02x}  ({c[0]}, {c[1]}, {c[2]})')
    if sem_saida: return
    recortes = opcoes(a, '--recorte', 4) or [[0, 0, W, H]]
    raiz, ext = os.path.splitext(a[1])
    if len(recortes) == 1 and recortes[0][:2] == [0, 0]: print('Cor mediana da borda da imagem (serve para "corEntorno"): ' + cor_da_borda(W, H, rgb))
    for n, r in enumerate(recortes, 1):
        x0, y0, rw, rh = [int(v) for v in r]
        rw, rh = min(rw, W - x0), min(rh, H - y0)
        t = recortar(W, H, rgb, x0, y0, rw, rh, zoom, clarear)
        desenhar_grade(t, x0, y0, rw, rh, zoom, passo)
        saida = a[1] if len(recortes) == 1 else f'{raiz}_{n}{ext}'
        escrever_png(saida, t.w, t.h, t.pix)
        print(f'{saida}: {t.w} x {t.h} px (imagem original {W} x {H}; recorte começa em {x0},{y0}; zoom {zoom}; linha a cada {passo} px)')


if __name__ == '__main__':
    main()
