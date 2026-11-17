#!/usr/bin/env python3
"""Compara duas imagens da mesma planta (em geral dia e noite) para ver se têm o mesmo enquadramento.

Uso:
  python3 ferramentas/comparar.py dia.png noite.png saida.png
  python3 ferramentas/comparar.py dia.png noite.png saida.png --faixa 40 --clarear 2.5

Grava uma imagem em faixas verticais alternadas: uma faixa da primeira, uma da segunda (clareada, se pedido).
Se o enquadramento é o mesmo, paredes e móveis continuam em linha de uma faixa para a outra.
Se as linhas "quebram" nas emendas, as imagens estão deslocadas e não podem ser usadas como dia e noite do mesmo mapa.

O tamanho em pixels pode ser diferente: a segunda imagem é esticada para o tamanho da primeira, como o programa faz.
O que não pode mudar é a proporção (largura dividida pela altura).
"""
import sys
from imagem import ler_png, escrever_png
from grade import opcao


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if len(a) < 3: sys.exit(__doc__)
    faixa = max(4, int(opcao(a, '--faixa', 1, [60])[0])); clarear = opcao(a, '--clarear', 1, [1.0])[0]
    w1, h1, p1 = ler_png(a[0]); w2, h2, p2 = ler_png(a[1])
    w, h = w1, h1
    if (w1, h1) != (w2, h2):
        dif = abs((w2 / h2) / (w1 / h1) - 1)
        if dif > 0.01: print(f'ATENÇÃO: proporções diferentes ({w1} x {h1} e {w2} x {h2}, {dif * 100:.1f}% de diferença). Não é o mesmo enquadramento; não use como dia e noite.')
        else: print(f'Tamanhos diferentes ({w1} x {h1} e {w2} x {h2}), mas a proporção bate; a segunda foi esticada para o tamanho da primeira.')
    if clarear != 1.0: p2 = bytearray(bytes(p2).translate(bytes(min(255, int(v * clarear)) for v in range(256))))
    saida = bytearray(w * h * 3); igual = (w1, h1) == (w2, h2)
    colunas = [x * w2 // w for x in range(w)]
    for y in range(h):
        y2 = y * h2 // h; linha2 = p2[y2 * w2 * 3:(y2 + 1) * w2 * 3]
        for x0 in range(0, w, faixa):
            x1 = min(w, x0 + faixa)
            if (x0 // faixa) % 2 == 0: trecho = p1[(y * w + x0) * 3:(y * w + x1) * 3]
            elif igual: trecho = linha2[x0 * 3:x1 * 3]
            else: trecho = b''.join(linha2[c * 3:c * 3 + 3] for c in colunas[x0:x1])
            saida[(y * w + x0) * 3:(y * w + x1) * 3] = trecho
    escrever_png(a[2], w, h, saida)
    print(f'{a[2]}: {w} x {h} px, faixas de {faixa} px (pares: primeira imagem; ímpares: segunda)')


if __name__ == '__main__':
    main()
