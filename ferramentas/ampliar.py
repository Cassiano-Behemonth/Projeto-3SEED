"""Aumenta o chão em volta de uma pintura: põe a imagem no meio de uma maior e cobre a sobra com um pedaço do próprio chão.

Uso:
  python3 ferramentas/ampliar.py chao.png chao_grande.png --tamanho 2600 1900 --amostra 257 1 757 59
  python3 ferramentas/ampliar.py chao.png chao_grande.png --tamanho 4000 3200 --amostra 300 800 740 842 --escurecer 0.65

Para que serve: no programa, só se anda até 2 m além da borda da imagem. Um mapa de perseguição, uma floresta em volta
de um acampamento ou uma estrada que continua precisam de chão maior que a pintura. Aumentar a "escala" não resolve:
tudo cresce junto (as casas viram casas de gigante).

--tamanho W H     tamanho da imagem nova, em px (a escala continua a mesma: mais pixels são mais metros).
--posicao X Y     onde fica o canto de cima, à esquerda, da pintura original (padrão: no meio).
--amostra X0 Y0 X1 Y1   pedaço do chão da pintura usado para cobrir a sobra (grama, terra, areia), repetido e espelhado
                  para a emenda não aparecer. Escolha o maior pedaço limpo, sem caminho, pedra ou sombra (olhe com grade.py).
--escurecer F     longe da pintura o chão escurece até F (0,65 = chão de mata); a transição leva --transicao px (padrão 300).
--borda N         largura, em px, da emenda suave entre a pintura e o chão novo (padrão 14).

Depois: posições lidas na pintura original somam (X, Y) da --posicao (a ferramenta imprime). Estradas que chegam à borda
da pintura continuam com apagar.py --ladrilhar, usando um trecho da própria estrada como amostra.
"""
import sys
from imagem import ler_png, escrever_png


def nums(a, nome, n):
    i = a.index(nome); return [int(float(v)) for v in a[i + 1:i + 1 + n]]


def main():
    a = sys.argv[1:]
    if len(a) < 2 or a[0] in ('-h', '--help') or '--tamanho' not in a or '--amostra' not in a: print(__doc__); sys.exit(0)
    w, h, rgb = ler_png(a[0])
    W, H = nums(a, '--tamanho', 2)
    if W < w or H < h: sys.exit('--tamanho precisa ser maior que a imagem.')
    ox, oy = nums(a, '--posicao', 2) if '--posicao' in a else ((W - w) // 2, (H - h) // 2)
    sx0, sy0, sx1, sy1 = nums(a, '--amostra', 4)
    esc = float(a[a.index('--escurecer') + 1]) if '--escurecer' in a else 1.0
    trans = int(float(a[a.index('--transicao') + 1])) if '--transicao' in a else 300
    borda = int(float(a[a.index('--borda') + 1])) if '--borda' in a else 14
    # amostra e suas versões espelhadas (na horizontal e na vertical), linha a linha
    tw, th = sx1 - sx0, sy1 - sy0
    linhas = [bytes(rgb[((sy0 + y) * w + sx0) * 3:((sy0 + y) * w + sx1) * 3]) for y in range(th)]
    def espelha(lin): return b''.join(lin[k:k + 3] for k in range(len(lin) - 3, -3, -3))
    linhas_e = [espelha(l) for l in linhas]
    out = bytearray(W * H * 3)
    for y in range(H):
        j = y % (2 * th); src = linhas if j < th else linhas[::-1]; k = j % th
        normal, espelho = src[k], (linhas_e if j < th else linhas_e[::-1])[k]
        par = normal + espelho; n = len(par)
        desl = ((y // th) * 2654435761 % (n // 3)) * 3      # cada faixa começa num ponto diferente: as colunas não se alinham
        lin = (par * (W * 3 // n + 3))[desl:desl + W * 3]
        out[y * W * 3:(y + 1) * W * 3] = lin
    # escurece com a distância à pintura (tabelas por nível, aplicadas em trechos de 16 px)
    if esc < 0.999:
        niveis = 48; tabelas = [bytes(min(255, int(v * (1 - (1 - esc) * k / (niveis - 1)) + 0.5)) for v in range(256)) for k in range(niveis)]
        for y in range(H):
            dy = max(oy - y, y - (oy + h - 1), 0)
            for x0 in range(0, W, 16):
                xm = x0 + 8; dx = max(ox - xm, xm - (ox + w - 1), 0)
                d = (dx * dx + dy * dy) ** 0.5
                if d <= 0: continue
                t = min(1.0, d / trans); t = t * t * (3 - 2 * t)
                k = int(t * (niveis - 1) + 0.5)
                if k: i0, i1 = (y * W + x0) * 3, (y * W + min(W, x0 + 16)) * 3; out[i0:i1] = bytes(out[i0:i1]).translate(tabelas[k])
    # a pintura por cima, com a beira misturada
    for y in range(h):
        i0 = ((oy + y) * W + ox) * 3; out[i0:i0 + w * 3] = rgb[y * w * 3:(y + 1) * w * 3]
    if borda > 0:
        for y in range(h):
            for x in range(w):
                b = min(x, y, w - 1 - x, h - 1 - y)
                if b >= borda: continue
                al = b / borda; i, j = (y * w + x) * 3, ((oy + y) * W + ox + x) * 3
                yy, xx = oy + y, ox + x  # chão novo naquele ponto (refeito da amostra)
                jj = yy % (2 * th); src = linhas if jj < th else linhas[::-1]; k = jj % th
                par = src[k] + (linhas_e if jj < th else linhas_e[::-1])[k]; p = (xx * 3 + ((yy // th) * 2654435761 % (len(par) // 3)) * 3) % len(par)
                for c in range(3): out[j + c] = int(rgb[i + c] * al + par[p + c] * (1 - al) + 0.5)
    escrever_png(a[1], W, H, out)
    print(f'{a[1]}: {W} x {H} px; a pintura original está em ({ox}, {oy}). Some ({ox}, {oy}) às posições lidas nela.')


if __name__ == '__main__':
    main()
