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

Além da imagem, a ferramenta mede o deslocamento em várias regiões (pelas bordas do desenho, que não mudam com a luz)
e diz o resultado:
  - "batem": nenhuma região sai mais que 0,4% da largura (6 px numa imagem de 1500). Use a de noite.
  - "não batem": o desenho da segunda está noutro lugar, em geral um pouco diferente em cada região (comum quando a
    IA de imagem refaz a cena para a noite). As peças 3D, postas pela de dia, ficariam fora do lugar à noite nessa
    medida. Deixe "imagemNoite" de fora e diga à pessoa o deslocamento medido; ela decide se aceita ou se pede a de
    noite de novo. Olhe também a imagem gravada: é nela que se vê onde está a diferença.
"""
import math, sys
from operator import mul
from imagem import ler_png, escrever_png, redimensionar
from grade import opcao


def _bordas(rgb, W, H):
    """Força das bordas (o desenho, não a luz): é o que continua no mesmo lugar do dia para a noite."""
    L = [rgb[i] * 299 + rgb[i + 1] * 587 + rgb[i + 2] * 114 for i in range(0, W * H * 3, 3)]
    g = [0.0] * (W * H)
    for y in range(1, H - 1):
        b = y * W
        for x in range(1, W - 1):
            k = b + x
            g[k] = float(abs(L[k + 1] - L[k - 1]) + abs(L[k + W] - L[k - W]))
    return g


def _melhor(A, B, W, x0, y0, x1, y1, cands):
    """O (dx, dy) entre os candidatos que faz a região de B mais parecida com a de A (correlação), e a nota dele."""
    la = [A[y * W + x0:y * W + x1] for y in range(y0, y1)]
    n = (x1 - x0) * (y1 - y0)
    sa = sum(map(sum, la)); va = sum(sum(map(mul, l, l)) for l in la) - sa * sa / n
    if va <= 1e-9: return None
    melhor = None
    for dx, dy in cands:
        lb = [B[(y + dy) * W + x0 + dx:(y + dy) * W + x1 + dx] for y in range(y0, y1)]
        sb = sum(map(sum, lb)); vb = sum(sum(map(mul, l, l)) for l in lb) - sb * sb / n
        if vb <= 1e-9: continue
        r = (sum(sum(map(mul, p, q)) for p, q in zip(la, lb)) - sa * sb / n) / (va * vb) ** 0.5
        if melhor is None or r > melhor[2]: melhor = (dx, dy, r)
    return melhor


def deslocamentos(w1, h1, p1, w2, h2, p2, colunas=4, R=8):
    """Deslocamento da segunda imagem em relação à primeira, em várias regiões: lista de (x, y, dx, dy) em pixels da
    primeira (x, y = centro da região). Mede numa cópia reduzida a 256 px de largura (até R px para cada lado) e
    refina no dobro disso. Regiões lisas ou sem semelhança nenhuma ficam de fora."""
    W1 = min(256, w1); H1 = max(16, round(W1 * h1 / w1)); W2, H2 = 2 * W1, 2 * H1
    linhas = max(2, round(colunas * H1 / W1)); m = R + 2
    if W1 - 2 * m < 4 * colunas or H1 - 2 * m < 4 * linhas: return []
    a2, _ = redimensionar(w1, p1, None, (0, 0, w1, h1), W2, H2); b2, _ = redimensionar(w2, p2, None, (0, 0, w2, h2), W2, H2)
    a1, _ = redimensionar(W2, a2, None, (0, 0, W2, H2), W1, H1); b1, _ = redimensionar(W2, b2, None, (0, 0, W2, H2), W1, H1)
    A1, B1, A2, B2 = _bordas(a1, W1, H1), _bordas(b1, W1, H1), _bordas(a2, W2, H2), _bordas(b2, W2, H2)
    cands = [(dx, dy) for dy in range(-R, R + 1) for dx in range(-R, R + 1)]
    out = []
    for j in range(linhas):
        for i in range(colunas):
            x0, x1 = m + (W1 - 2 * m) * i // colunas, m + (W1 - 2 * m) * (i + 1) // colunas
            y0, y1 = m + (H1 - 2 * m) * j // linhas, m + (H1 - 2 * m) * (j + 1) // linhas
            r = _melhor(A1, B1, W1, x0, y0, x1, y1, cands)
            if r is None or r[2] < 0.3: continue
            perto = [(2 * r[0] + a, 2 * r[1] + b) for b in (-2, -1, 0, 1, 2) for a in (-2, -1, 0, 1, 2)]
            r = _melhor(A2, B2, W2, 2 * x0, 2 * y0, 2 * x1, 2 * y1, perto)
            if r is None or r[2] < 0.3: continue
            out.append(((x0 + x1) / 2 * w1 / W1, (y0 + y1) / 2 * h1 / H1, r[0] * w1 / W2, r[1] * h1 / H2))
    return out


def veredito(w, regioes):
    """Texto do resultado da medição; devolve (bate, texto)."""
    if not regioes: return None, 'Não deu para medir o alinhamento (imagem pequena ou lisa demais): confira olhando a imagem gravada.'
    d = sorted(math.hypot(dx, dy) for _, _, dx, dy in regioes)
    mx = d[-1]; limite = 0.004 * w
    if mx <= limite:
        return True, f'Alinhamento: as duas batem ({len(regioes)} regiões medidas; deslocamento máximo de {mx:.0f} px).'
    pior = max(regioes, key=lambda r: math.hypot(r[2], r[3]))
    return False, (f'ATENÇÃO: as duas NÃO batem. O desenho da segunda está deslocado de {d[0]:.0f} a {mx:.0f} px, conforme a região '
                   f'(mediana {d[len(d) // 2]:.0f} px; o pior perto de x {pior[0]:.0f}, y {pior[1]:.0f}). As peças 3D ficariam fora do '
                   f'lugar à noite nessa medida. Deixe "imagemNoite" de fora e diga à pessoa o deslocamento; ela decide se aceita.')


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
    print(veredito(w1, deslocamentos(w1, h1, p1, w2, h2, p2))[1])


if __name__ == '__main__':
    main()
