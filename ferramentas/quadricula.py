"""Tira a quadrícula (a grade de um mapa de batalha) de uma pintura, para ela não aparecer no chão em 3D.

Uso:
  python3 ferramentas/quadricula.py entrada.png saida.png
  python3 ferramentas/quadricula.py entrada.png saida.png --marcar /tmp/marcas.png      # mostra em rosa o que vai sair
  python3 ferramentas/quadricula.py entrada.png saida.png --agua                        # segunda passada, só na água

Como funciona: a linha da grade é fina (1 a 2 px) e corre reta por toda a imagem; um traço do desenho não. Para cada
pixel mede-se o quanto ele é mais escuro (ou mais claro) que os vizinhos a 2 px e soma-se isso ao longo da direção da
linha (uma janela de 41 px). Onde a soma é forte e é o pico da vizinhança, o pixel é trocado pela mistura dos vizinhos.
Linhas que entortam um pouco ou que não têm espaçamento igual (comum em imagem gerada) também saem.

--limiar N   quanto a linha precisa se destacar (padrão 7; abaixe para 4 ou 5 se sobrar grade, suba se apagar traços).
--janela N   meia janela, em px, ao longo da linha (padrão 20).
--agua       repete a passada com metade do limiar, só onde a pintura é azulada (na água a grade é clara e fraca).
--marcar arquivo.png   grava a imagem original com os pixels trocados em rosa, para conferir.

Antes: peça à IA de imagem a mesma pintura sem a grade ("sem quadrícula, sem grid"). Sair limpa é sempre melhor.
Depois: olhe o resultado com grade.py em recortes ampliados (água, grama, bordas de construções). A rosa dos ventos, o
título e a moldura não saem com esta ferramenta: use apagar.py --ladrilhar (cubra com um pedaço de chão vizinho) e
corte a moldura.
"""
import sys
from imagem import ler_png, escrever_png


def opcao(a, nome, padrao):
    return float(a[a.index(nome) + 1]) if nome in a else padrao


def passada(w, h, rgb, limiar, janela, so=None, maximo=60.0):
    """Linhas verticais: devolve (imagem nova, marcas). 'so' (bytearray w*h) restringe onde pode trocar."""
    n = w * h
    L = [rgb[i] + rgb[i + 1] + rgb[i + 2] for i in range(0, n * 3, 3)]
    res = [0.0] * n
    for y in range(h):
        b = y * w
        for x in range(2, w - 2): res[b + x] = L[b + x] - (L[b + x - 2] + L[b + x + 2]) * 0.5
    R = [0.0] * n
    for x in range(2, w - 2):
        col = res[x::w]; acc = [0.0] * (h + 1); s = 0.0
        for y in range(h): s += col[y]; acc[y + 1] = s
        for y in range(h):
            a0, a1 = max(0, y - janela), min(h, y + janela + 1)
            R[y * w + x] = (acc[a1] - acc[a0]) / (a1 - a0)
    marca = bytearray(n)
    for y in range(h):
        b = y * w; lin = R[b:b + w]; A = [abs(v) for v in lin]
        for x in range(3, w - 3):
            v = A[x]
            if v <= limiar or v >= maximo or v < max(A[max(0, x - 5):x + 6]): continue
            if so is not None and not so[b + x]: continue
            marca[b + x] = 1; pos = lin[x] > 0
            for xx in (x - 1, x + 1):
                if 3 <= xx < w - 3 and A[xx] > 0.45 * v and (lin[xx] > 0) == pos: marca[b + xx] = 1
    out = bytearray(rgb)
    for y in range(h):
        b = y * w; x = 3
        while x < w - 3:
            if not marca[b + x]: x += 1; continue
            x0 = x
            while x < w - 3 and marca[b + x]: x += 1
            l, r = x0 - 1, x
            for k in range(x0, x):
                t = (k - l) / (r - l)
                for c in range(3): out[(b + k) * 3 + c] = int(rgb[(b + l) * 3 + c] * (1 - t) + rgb[(b + r) * 3 + c] * t + 0.5)
    return out, marca


def transpor(w, h, rgb):
    out = bytearray(len(rgb))
    for y in range(h):
        for x in range(w):
            i, j = (y * w + x) * 3, (x * h + y) * 3
            out[j:j + 3] = rgb[i:i + 3]
    return out


def transpor_mascara(w, h, m):
    out = bytearray(len(m))
    for y in range(h): out[y::h] = m[y * w:(y + 1) * w]
    return out


def limpar(w, h, rgb, limiar, janela, so=None):
    v, mv = passada(w, h, rgb, limiar, janela, so)
    t = transpor(w, h, v)
    hz, mh = passada(h, w, t, limiar, janela, transpor_mascara(w, h, so) if so is not None else None)
    marcas = bytearray(a | b for a, b in zip(mv, transpor_mascara(h, w, mh)))
    return transpor(h, w, hz), marcas


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help') or len(a) < 2: print(__doc__); sys.exit(0)
    w, h, rgb = ler_png(a[0])
    limiar, janela = opcao(a, '--limiar', 7.0), int(opcao(a, '--janela', 20))
    out, marcas = limpar(w, h, rgb, limiar, janela)
    if '--agua' in a:
        azul = bytearray(1 if out[i * 3 + 2] > out[i * 3] + 25 else 0 for i in range(w * h))
        for _ in range(3):  # encolhe 3 px: não mexe nas pedras da margem
            novo = bytearray(azul)
            for i in range(w, w * h - w):
                if azul[i] and not (azul[i - 1] and azul[i + 1] and azul[i - w] and azul[i + w]): novo[i] = 0
            azul = novo
        out, m2 = limpar(w, h, out, limiar * 0.5, janela + 6, azul)
        marcas = bytearray(x | y for x, y in zip(marcas, m2))
    escrever_png(a[1], w, h, out)
    print(f'{a[1]}: {w} x {h} px; {marcas.count(1)} pixels de grade trocados ({100 * marcas.count(1) / (w * h):.1f}% da imagem)')
    if '--marcar' in a:
        mk = bytearray(rgb)
        for i in range(w * h):
            if marcas[i]: mk[i * 3:i * 3 + 3] = b'\xff\x00\xff'
        saida = a[a.index('--marcar') + 1]; escrever_png(saida, w, h, mk); print(f'{saida}: pixels trocados em rosa')
    print('Confira com grade.py em recortes ampliados; se sobrou grade, rode de novo com --limiar 5 (ou --agua).')


if __name__ == '__main__':
    main()
