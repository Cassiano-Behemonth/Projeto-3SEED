#!/usr/bin/env python3
"""Endireita uma planta desenhada em perspectiva, para ela poder virar o piso de um mapa.

Uso:
  python3 ferramentas/endireitar.py entrada.png saida.png --cantos X1 Y1 X2 Y2 X3 Y3 X4 Y4
  python3 ferramentas/endireitar.py entrada.png saida.png --cantos ... --esticar 1.15
  python3 ferramentas/endireitar.py entrada.png saida.png --cantos ... --conferir conf.png

--cantos  Quatro pontos do PISO que na vida real formam um retângulo, nesta ordem: fundo à esquerda, fundo à direita,
          frente à direita, frente à esquerda. Em geral são os cantos do prédio, medidos onde a parede encosta no piso
          (o pé da parede, não o topo). Leia-os na grade (ferramentas/grade.py).
--esticar Corrige a profundidade. Uma vista inclinada achata o que está no chão; depois de endireitar, meça algo
          redondo ou quadrado (mesa redonda, ladrilho). Se ficou com 80 px de largura e 70 de altura, rode de novo
          com --esticar 1.14 (80 / 70). Padrão: 1.
--recortar Corta a saída no maior retângulo sem cantos pretos. Sem ela, a imagem original inteira é mantida e sobram
          dois cantos pretos (em geral embaixo); com ela, perde-se uma fatia das bordas, que pode incluir o topo das
          paredes externas.
--encaixar X0 Y0 X1 Y1 W H
          Para a versão de noite quando ela NÃO tem o mesmo enquadramento da de dia: meça os cantos da noite à parte e
          passe aqui os números que a execução da de dia imprimiu. A saída fica com W x H px e o retângulo dos cantos
          no mesmo lugar da de dia.
--conferir Grava a imagem original com o quadrilátero dos cantos desenhado, para ver se os pontos estão no lugar.

A imagem de saída mostra o piso como um retângulo, com as laterais na vertical e a mesma escala no fundo e na frente.
Só o piso fica exato: o que tem altura (paredes, móveis) continua mostrando a face, e é coberto pelas peças em 3D
(veja "Paredes com a face aparente" no guia). Se a versão de noite tem o mesmo enquadramento (confira com
comparar.py nas originais), use nela os MESMOS cantos e o mesmo --esticar; se não tem, use --encaixar.
"""
import sys
from imagem import ler_png, escrever_png
from grade import opcao, recortar


def resolver(m, v):
    """Sistema linear por eliminação de Gauss (sem bibliotecas)."""
    n = len(v); a = [linha[:] + [v[i]] for i, linha in enumerate(m)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(a[r][c]))
        if abs(a[p][c]) < 1e-12: sys.exit('Os quatro cantos não formam um quadrilátero válido (três deles estão em linha?).')
        a[c], a[p] = a[p], a[c]
        for r in range(n):
            if r != c:
                k = a[r][c] / a[c][c]
                if k: a[r] = [x - k * y for x, y in zip(a[r], a[c])]
    return [a[i][n] / a[i][i] for i in range(n)]


def projecao(de, para):
    """Transformação que leva os quatro pontos 'de' nos quatro pontos 'para': devolve (a, b, c, d, e, f, g, h)."""
    m, v = [], []
    for (X, Y), (x, y) in zip(de, para):
        m.append([X, Y, 1, 0, 0, 0, -X * x, -Y * x]); v.append(x)
        m.append([0, 0, 0, X, Y, 1, -X * y, -Y * y]); v.append(y)
    return resolver(m, v)


def aplicar(h, X, Y):
    w = h[6] * X + h[7] * Y + 1
    return (h[0] * X + h[1] * Y + h[2]) / w, (h[3] * X + h[4] * Y + h[5]) / w


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if len(a) < 2 or '--cantos' not in a: sys.exit(__doc__)
    c = opcao(a, '--cantos', 8, None)
    if len(c) != 8: sys.exit('--cantos precisa de oito números: quatro pontos x y.')
    cantos = [(c[0], c[1]), (c[2], c[3]), (c[4], c[5]), (c[6], c[7])]  # fundo esq., fundo dir., frente dir., frente esq.
    esticar = opcao(a, '--esticar', 1, [1.0])[0]
    W, H, rgb = ler_png(a[0])
    dist = lambda p, q: ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** 0.5
    fundo, frente, esq, dire = dist(cantos[0], cantos[1]), dist(cantos[3], cantos[2]), dist(cantos[0], cantos[3]), dist(cantos[1], cantos[2])
    if min(fundo, frente, esq, dire) < 20: sys.exit('Cantos próximos demais; confira a ordem: fundo esq., fundo dir., frente dir., frente esq.')
    if '--conferir' in a:
        t = recortar(W, H, rgb, 0, 0, W, H, 1, 1.6)
        for i in range(4): t.linha(*cantos[i], *cantos[(i + 1) % 4], (255, 70, 60), 3)
        for i, p in enumerate(cantos): t.circulo(p[0], p[1], 7, (255, 225, 70)); t.texto(str(i + 1), p[0] + 10, p[1] - 16, (255, 225, 70), 2)
        saida = a[a.index('--conferir') + 1]; escrever_png(saida, t.w, t.h, t.pix); print(f'{saida}: cantos desenhados sobre a imagem original')
    # O lado mais largo fica no tamanho em que foi desenhado (nada é reduzido); o mais estreito é ampliado até igualar.
    Wr = round(max(fundo, frente)); aperto = min(fundo, frente) / max(fundo, frente)
    Hr = round((esq + dire) / 2 / aperto * esticar)
    enc = opcao(a, '--encaixar', 6, None)
    if enc:
        if len(enc) != 6: sys.exit('--encaixar precisa de seis números: X0 Y0 X1 Y1 W H.')
        Wr, Hr = round(enc[2] - enc[0]), round(enc[3] - enc[1])
    ret = [(0, 0), (Wr, 0), (Wr, Hr), (0, Hr)]
    ida, volta = projecao(cantos, ret), projecao(ret, cantos)  # ida: original -> endireitada; volta: endireitada -> original
    # Enquadramento: o maior retângulo que fica inteiro dentro da imagem original depois de endireitada.
    q = [aplicar(ida, x, y) for x, y in ((0, 0), (W - 1, 0), (W - 1, H - 1), (0, H - 1))]
    if enc:
        x0, y0 = -round(enc[0]), -round(enc[1]); x1, y1 = x0 + round(enc[4]), y0 + round(enc[5])
    elif '--recortar' in a:
        x0, x1 = int(max(q[0][0], q[3][0])) + 1, int(min(q[1][0], q[2][0]))
        y0, y1 = int(max(q[0][1], q[1][1])) + 1, int(min(q[2][1], q[3][1]))
    else:
        x0, x1 = int(min(p[0] for p in q)), int(max(p[0] for p in q)) + 1
        y0, y1 = int(min(p[1] for p in q)), int(max(p[1] for p in q)) + 1
    if not enc and (x1 - x0 < Wr or y1 - y0 < Hr): x0, y0, x1, y1 = min(x0, 0), min(y0, 0), max(x1, Wr), max(y1, Hr)
    Ws, Hs = x1 - x0, y1 - y0
    if Ws * Hs > 40_000_000: sys.exit('A imagem endireitada ficaria grande demais; confira os cantos.')
    fonte = bytes(rgb) + b'\0\0\0'; fora = W * H  # um pixel preto a mais, para o que cair fora da imagem original
    ha, hb, hc, hd, he, hf, hg, hh = volta
    linhas = []
    for Y in range(y0, y1):
        A, D, K = hb * Y + hc, he * Y + hf, hh * Y + 1
        indices = []
        for X in range(x0, x1):
            w = hg * X + K; x = int((ha * X + A) / w + 0.5); y = int((hd * X + D) / w + 0.5)
            indices.append((y * W + x) * 3 if 0 <= x < W and 0 <= y < H else fora * 3)
        linhas.append(b''.join([fonte[i:i + 3] for i in indices]))
    escrever_png(a[1], Ws, Hs, bytearray(b''.join(linhas)))
    px, py = -x0, -y0
    print(f'{a[1]}: {Ws} x {Hs} px (original {W} x {H})')
    print(f'O retângulo dos cantos ficou em x de {px} a {px + Wr}, y de {py} a {py + Hr}.')
    if enc: print('Enquadramento copiado de --encaixar. Confira com comparar.py se as paredes continuam de uma faixa para a outra.'); return
    print(f'O lado mais estreito era {(1 - aperto) * 100:.0f}% menor que o mais largo e foi ampliado até igualar.')
    print(f'Profundidade: {(esq + dire) / 2:.0f} px na original, {Hr} px na saída (x{1 / aperto:.2f} pela perspectiva, x{esticar:g} de --esticar).')
    print('Confira: meça algo redondo ou quadrado no chão (mesa redonda, ladrilho, tapete). Se a largura e a altura forem diferentes,')
    print('rode de novo com --esticar igual ao valor atual multiplicado por largura / altura. Até 5% de diferença é aceitável.')
    print('Versão de noite com o mesmo enquadramento: repita com os mesmos --cantos e --esticar.')
    print(f'Versão de noite com outro enquadramento: meça os cantos dela e acrescente --encaixar {px} {py} {px + Wr} {py + Hr} {Ws} {Hs}')


if __name__ == '__main__':
    main()
