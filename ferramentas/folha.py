#!/usr/bin/env python3
"""Lê uma folha de referência de um prédio (várias vistas lado a lado sobre fundo liso) e diz onde está cada vista.

Uso:
  python3 ferramentas/folha.py assets/predios/hotel.png                  # acha as quatro vistas, em uma ou duas fileiras
  python3 ferramentas/folha.py assets/predios/hotel.png --conferir /tmp/f.png

A folha deve ter as quatro vistas separadas por fundo liso: frente, lateral direita, fundos e telhado visto de cima.
Elas podem vir numa fileira (nessa ordem, da esquerda para a direita) ou em duas (2 x 2, com rótulos embaixo).
A ferramenta acha o fundo a partir da borda da imagem, separa cada vista, reconhece qual é qual, tira a linha de chão
desenhada embaixo das elevações, iguala a altura das três (para os andares baterem), confere se as medidas combinam
e imprime o trecho pronto para colar no campo "folhas" do mapa.
--conferir grava a folha com os retângulos desenhados; --tolerancia N (padrão 28) é quanto a cor do fundo pode variar.

  python3 ferramentas/folha.py assets/predios/capela_modular.png --pecas --conferir /tmp/f.png
--pecas  Para folhas MODULARES (várias peças soltas: paredes, torres, portas, pilares): lista o retângulo de cada
         peça, numeradas da esquerda para a direita e de cima para baixo. --minimo N ignora o que tiver menos de N px
         de lado (padrão 30; etiquetas de número costumam ser menores). Cada peça vira um item de "folhas" só com
         "frente" (e "profundidade" pequena, se for uma parede).

  python3 ferramentas/folha.py folha_suja.png --limpar folha_limpa.png --manter X Y X Y X Y ... --manter ...
--limpar Para folhas SUJAS (a IA misturou a imagem de referência no fundo, ou pôs névoa em volta): grava uma cópia em
         que só fica o que está dentro dos polígonos dados em --manter (um por vista, contornando o prédio; pontos
         x y em sequência) e o resto vira fundo liso. --fundo "#rrggbb" escolhe a cor (padrão: a do canto de baixo,
         à esquerda). Meça os contornos com grade.py em recortes ampliados; deixe de fora rótulos e linha de chão.
--papel  Junto com --limpar: para folhas em PERGAMINHO, com moldura, manchas e rótulos (o fundo não é liso). Em cada área
         mantida, tira o papel ligado à borda dela e deixa TRANSPARENTES os vãos de papel presos no desenho (entre as pernas
         de uma torre, sob uma mesa); sem isso eles virariam placas opacas em 3D. Use um retângulo por vista, cortando os
         rótulos de fora. Grava PNG com transparência.
--espelhar X0 Y0 X1 Y1   Junto com --limpar: desvira na horizontal esse retângulo (uma vista que a IA desenhou espelhada:
         na lateral DIREITA, a frente do prédio fica do lado ESQUERDO da vista; se a varanda ou a escada está do outro lado,
         ela veio espelhada). Pode repetir.
--nevoa N  Junto com --limpar: tira também a névoa LISA que sobrou dentro das áreas mantidas (o fundo borrado em volta
         do prédio). Entra pelas bordas e avança enquanto a cor muda menos que N de um pixel para o vizinho (use 5 a
         8); para no traço do desenho. Com isso o --manter pode ser um retângulo folgado em volta da vista, em vez de
         um contorno justo. O que for nítido (um carro, um rótulo por cima do prédio) não sai: remende com apagar.py.
"""
import json, sys
from imagem import ler_png, escrever_png
from grade import opcao, recortar


def fundo_ligado(W, H, rgb, tol):
    """Marca o fundo: tudo o que se liga à borda da imagem com a cor do canto (o cinza dentro do prédio não entra)."""
    r0, g0, b0 = rgb[0], rgb[1], rgb[2]
    longe = tol * 3; passo = max(4, tol // 3)   # o fundo pode ser um degradê: vale a diferença para o vizinho
    fundo = bytearray(W * H); pilha = []
    for x in range(W): pilha += [(x, -1), ((H - 1) * W + x, -1)]
    for y in range(H): pilha += [(y * W, -1), (y * W + W - 1, -1)]
    while pilha:
        i, de = pilha.pop()
        if fundo[i]: continue
        k = i * 3
        if abs(rgb[k] - r0) > longe or abs(rgb[k + 1] - g0) > longe or abs(rgb[k + 2] - b0) > longe: continue
        if de >= 0:
            q = de * 3
            if abs(rgb[k] - rgb[q]) > passo or abs(rgb[k + 1] - rgb[q + 1]) > passo or abs(rgb[k + 2] - rgb[q + 2]) > passo: continue
        fundo[i] = 1; x = i % W
        if x > 0: pilha.append((i - 1, i))
        if x < W - 1: pilha.append((i + 1, i))
        if i >= W: pilha.append((i - W, i))
        if i < W * (H - 1): pilha.append((i + W, i))
    return fundo


def vistas(W, H, fundo, vao=12):
    cheias = [any(not fundo[y * W + x] for y in range(0, H, 2)) for x in range(W)]
    grupos, ini, vazio = [], None, 0
    for x in range(W + 1):
        tem = x < W and cheias[x]
        if tem:
            if ini is None: ini = x
            vazio = 0
        elif ini is not None:
            vazio += 1
            if vazio >= vao or x == W: grupos.append((ini, x - vazio)); ini = None
    ret = []
    for x0, x1 in grupos:
        if x1 - x0 < 20: continue
        ys = [y for y in range(H) if any(not fundo[y * W + x] for x in range(x0, x1 + 1, 2))]
        ret.append([x0, ys[0], x1 + 1, ys[-1] + 1])
    return ret


def pecas(W, H, fundo, minimo):
    """Retângulos das peças soltas: grupos de pixels que não são fundo, ligados entre si."""
    visto = bytearray(fundo); ret = []
    for i0 in range(W * H):
        if visto[i0]: continue
        pilha = [i0]; visto[i0] = 1; x0 = x1 = i0 % W; y0 = y1 = i0 // W
        while pilha:
            i = pilha.pop(); x, y = i % W, i // W
            if x < x0: x0 = x
            if x > x1: x1 = x
            if y < y0: y0 = y
            if y > y1: y1 = y
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < W and 0 <= ny < H and not visto[ny * W + nx]: visto[ny * W + nx] = 1; pilha.append(ny * W + nx)
        if x1 - x0 + 1 >= minimo and y1 - y0 + 1 >= minimo: ret.append([x0, y0, x1 + 1, y1 + 1])
    ret.sort(key=lambda r: (round(r[1] / 120), r[0]))
    return ret


def limpar(W, H, rgb, poligonos, cor):
    """Só o que está dentro dos polígonos fica; o resto vira a cor de fundo. Preenchimento por linhas."""
    out = bytearray(bytes(cor) * (W * H))
    for pts in poligonos:
        ys = [q[1] for q in pts]
        for y in range(max(0, int(min(ys))), min(H, int(max(ys)) + 1)):
            xs = []; yc = y + 0.5
            for i in range(len(pts)):
                (xa, ya), (xb, yb) = pts[i], pts[(i + 1) % len(pts)]
                if (ya > yc) != (yb > yc): xs.append(xa + (yc - ya) * (xb - xa) / (yb - ya))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                x0, x1 = max(0, int(a + 0.5)), min(W, int(b + 0.5))
                if x1 > x0: out[(y * W + x0) * 3:(y * W + x1) * 3] = rgb[(y * W + x0) * 3:(y * W + x1) * 3]
    return out


def tirar_nevoa(W, H, out, cor, passo):
    """Dentro das áreas mantidas, apaga o fundo liso ligado à borda: avança enquanto a cor muda pouco de vizinho a vizinho."""
    n = W * H; fora = bytearray(n); fundo = bytes(cor)
    for i in range(n):
        if out[i * 3:i * 3 + 3] == fundo: fora[i] = 1
    liso = lambda i, j: abs(out[i * 3] - out[j * 3]) <= passo and abs(out[i * 3 + 1] - out[j * 3 + 1]) <= passo and abs(out[i * 3 + 2] - out[j * 3 + 2]) <= passo
    def cinza(i):   # parecido com fundo: pouca cor e nem muito escuro nem muito claro
        r, g, b = out[i * 3], out[i * 3 + 1], out[i * 3 + 2]
        return max(r, g, b) - min(r, g, b) <= 26 and 70 <= (r + g + b) // 3 <= 175
    def viz(i):
        x = i % W
        if x > 0: yield i - 1
        if x < W - 1: yield i + 1
        if i >= W: yield i - W
        if i < n - W: yield i + W
    pilha = []
    for i in range(n):          # sementes: pixels mantidos, encostados no fundo, cinzentos e lisos em volta
        if fora[i]: continue
        vs = list(viz(i))
        if any(fora[j] for j in vs) and cinza(i) and all(fora[j] or liso(i, j) for j in vs): pilha.append(i)
    apagar = bytearray(n)
    for i in pilha: apagar[i] = 1
    while pilha:
        i = pilha.pop()
        for j in viz(i):
            if not fora[j] and not apagar[j] and cinza(j) and liso(i, j): apagar[j] = 1; pilha.append(j)
    total = 0
    for i in range(n):
        if apagar[i]: out[i * 3:i * 3 + 3] = fundo; total += 1
    return total


def tirar_papel(W, H, out, poligonos, cor):
    """Pergaminho: em cada área mantida, o papel ligado à borda vira fundo; manchas de papel presas no desenho viram
    furos (transparentes). Depois, o que tem a cor do fundo e não se liga à borda da imagem também vira furo (o programa
    só tira o fundo ligado à borda). Devolve (alfa, papel apagado, furos)."""
    papel = lambda i: max(out[i * 3:i * 3 + 3]) - min(out[i * 3:i * 3 + 3]) < 48 and sum(out[i * 3:i * 3 + 3]) > 480
    alfa = bytearray(b'\xff') * (W * H); apagados = 0
    amostra = [tuple(out[i * 3:i * 3 + 3]) for i in range(0, W * H, 97) if papel(i)]
    ref = tuple(sorted(c[k] for c in amostra)[len(amostra) // 2] for k in range(3)) if amostra else cor
    fundo = bytes(cor)
    for pol in poligonos:
        x0, y0 = max(0, int(min(p[0] for p in pol))), max(0, int(min(p[1] for p in pol)))
        x1, y1 = min(W, int(max(p[0] for p in pol)) + 1), min(H, int(max(p[1] for p in pol)) + 1)
        fora = set(); pilha = []
        for x in range(x0, x1):
            for y in (y0, y1 - 1): i = y * W + x; (papel(i) or out[i * 3:i * 3 + 3] == fundo) and i not in fora and (fora.add(i) or pilha.append(i))
        for y in range(y0, y1):
            for x in (x0, x1 - 1): i = y * W + x; (papel(i) or out[i * 3:i * 3 + 3] == fundo) and i not in fora and (fora.add(i) or pilha.append(i))
        while pilha:
            i = pilha.pop(); x, y = i % W, i // W
            for j, ok in ((i - 1, x > x0), (i + 1, x < x1 - 1), (i - W, y > y0), (i + W, y < y1 - 1)):
                if ok and j not in fora and (papel(j) or out[j * 3:j * 3 + 3] == fundo): fora.add(j); pilha.append(j)
        for i in fora: out[i * 3:i * 3 + 3] = fundo
        apagados += len(fora)
        # manchas de papel presas (vãos do desenho): componentes de 25 px ou mais, perto da cor do papel
        perto = lambda i: i not in fora and papel(i) and max(abs(out[i * 3 + k] - ref[k]) for k in range(3)) < 30
        visto = set()
        for y in range(y0, y1):
            for x in range(x0, x1):
                i = y * W + x
                if i in visto or not perto(i): continue
                comp = [i]; visto.add(i); pilha = [i]
                while pilha:
                    q = pilha.pop(); qx, qy = q % W, q // W
                    for j, ok in ((q - 1, qx > x0), (q + 1, qx < x1 - 1), (q - W, qy > y0), (q + W, qy < y1 - 1)):
                        if ok and j not in visto and perto(j): visto.add(j); pilha.append(j); comp.append(j)
                if len(comp) >= 25:
                    for q in comp: alfa[q] = 0; out[q * 3:q * 3 + 3] = fundo
    # cor do fundo presa dentro do desenho (não ligada à borda da imagem): furo também
    liga = bytearray(W * H); pilha = []
    parece = lambda i: max(abs(out[i * 3 + k] - cor[k]) for k in range(3)) <= 30
    for x in range(W):
        for y in (0, H - 1):
            i = y * W + x
            if not liga[i] and parece(i): liga[i] = 1; pilha.append(i)
    for y in range(H):
        for x in (0, W - 1):
            i = y * W + x
            if not liga[i] and parece(i): liga[i] = 1; pilha.append(i)
    while pilha:
        i = pilha.pop(); x = i % W
        for j, ok in ((i - 1, x > 0), (i + 1, x < W - 1), (i - W, i >= W), (i + W, i < W * (H - 1))):
            if ok and not liga[j] and parece(j): liga[j] = 1; pilha.append(j)
    for i in range(W * H):
        if not liga[i] and alfa[i] and parece(i): alfa[i] = 0
    return alfa, apagados, alfa.count(0)


def espelhar(W, out, x0, y0, x1, y1):
    for y in range(y0, y1):
        lin = [bytes(out[(y * W + x) * 3:(y * W + x) * 3 + 3]) for x in range(x0, x1)]
        for k, px in enumerate(reversed(lin)): out[(y * W + x0 + k) * 3:(y * W + x0 + k) * 3 + 3] = px


def aparar_chao(W, H, f, r):
    """Tira a linha de chão desenhada sob uma vista (uma faixa cheia, mais larga que o prédio). Devolve (ret, tinha)."""
    x0, y0, x1, y1 = r; larg = x1 - x0
    ocup = lambda y: sum(1 for x in range(x0, x1) if not f[y * W + x])
    cheias = [y for y in range(max(y0, y1 - 24), y1) if ocup(y) >= 0.985 * larg]
    if not cheias: return r, False
    b = min(cheias)
    if y1 - b > 14: return r, False   # linha de chão é fina; uma faixa grossa é parte do prédio
    # Só é linha de chão se for fina e mais larga que o prédio logo acima; a base cheia de um prédio retangular não é.
    acima = sorted(ocup(y) for y in range(max(y0, b - 12), b))
    if not acima or acima[len(acima) // 2] >= 0.96 * larg: return r, False
    while b > y0 and ocup(b - 1) >= 0.97 * larg: b -= 1   # a borda suavizada da linha também sai
    xs = [x for x in range(x0, x1) if any(not f[y * W + x] for y in range(y0, max(y0 + 1, b - 6), 2))]
    return ([min(xs), y0, max(xs) + 1, b] if xs else [x0, y0, x1, b]), True


def apagar_etiquetas(W, H, rgb, f):
    """Marca como fundo as etiquetas de número da folha: caixinhas quase pretas, de 14 a 48 px, cheias, com o algarismo
    claro dentro. Elas encostam no topo das peças e iam junto. Devolve quantas achou."""
    escuro = bytearray(W * H)
    for i in range(W * H):
        if not f[i]: k = i * 3; escuro[i] = (rgb[k] * 3 + rgb[k + 1] * 6 + rgb[k + 2]) // 10 < 48
    visto = bytearray(W * H); n = 0
    for i0 in range(W * H):
        if not escuro[i0] or visto[i0]: continue
        pilha = [i0]; visto[i0] = 1; px = []
        while pilha:
            i = pilha.pop(); px.append(i); x = i % W
            for j in (i - 1 if x else -1, i + 1 if x < W - 1 else -1, i - W, i + W):
                if 0 <= j < W * H and escuro[j] and not visto[j]: visto[j] = 1; pilha.append(j)
        xs = [i % W for i in px]; ys = [i // W for i in px]
        bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
        if 14 <= bw <= 48 and 14 <= bh <= 48 and 0.6 <= bw / bh <= 1.6 and len(px) >= 0.55 * bw * bh:
            n += 1
            for y in range(min(ys) - 1, max(ys) + 2):
                for x in range(min(xs) - 1, max(xs) + 2):
                    if 0 <= x < W and 0 <= y < H: f[y * W + x] = 1
    return n


def aparar_etiqueta(W, H, rgb, f, r):
    """Tira do topo de uma peça uma etiqueta de número encostada nela: uma caixa escura, de largura constante,
    com o algarismo claro no meio. Para quando a largura muda (começa a peça)."""
    x0, y0, x1, y1 = r; larguras = []; fracoes = []; corte = y0
    for y in range(y0, min(y1, y0 + 70)):
        cols = [x for x in range(x0, x1) if not f[y * W + x]]
        if not cols: break
        lums = [(rgb[(y * W + x) * 3] * 3 + rgb[(y * W + x) * 3 + 1] * 6 + rgb[(y * W + x) * 3 + 2]) // 10 for x in cols]
        lg = max(cols) - min(cols)
        fr = sum(1 for v in lums if v < 60) / len(lums); escura = fr >= 0.35   # o algarismo claro ocupa parte das fileiras
        if larguras:
            med = sorted(larguras)[len(larguras) // 2]
            if abs(lg - med) > 3: break
        if not escura or not (10 <= lg <= 0.6 * (x1 - x0)): break
        larguras.append(lg); fracoes.append(fr); corte = y + 1
    if len(larguras) >= 12 and sum(fracoes) / len(fracoes) >= 0.55: return [x0, corte, x1, y1], True
    return r, False


def reconhecer(W, H, f, pecas4):
    """Diz qual das quatro peças é frente, lateral, fundos e telhado; tira a linha de chão e iguala as alturas."""
    info = [aparar_chao(W, H, f, p) for p in pecas4]
    sem = [i for i, (_, tinha) in enumerate(info) if not tinha]
    # O telhado é o único sem linha de chão; sem essa pista, é a vista de baixo à direita (o lugar dele nos dois arranjos comuns).
    if len(sem) == 1: it = sem[0]
    else: it = max(range(4), key=lambda i: (info[i][0][0] + info[i][0][2]) / (2 * W) + (info[i][0][1] + info[i][0][3]) / (2 * H))
    elev = sorted((i for i in range(4) if i != it), key=lambda i: (round(info[i][0][1] / 150), info[i][0][0]))
    fr = info[elev[0]][0]; wf = fr[2] - fr[0]
    a, b = elev[1], elev[2]
    fundos, lado = (a, b) if abs((info[a][0][2] - info[a][0][0]) - wf) <= abs((info[b][0][2] - info[b][0][0]) - wf) else (b, a)
    v = {'frente': list(fr), 'lado': list(info[lado][0]), 'fundos': list(info[fundos][0]), 'telhado': list(info[it][0])}
    hf = fr[3] - fr[1]; avisos = []
    for k in ('lado', 'fundos'):
        q = v[k]; h = q[3] - q[1]
        if abs(h - hf) <= 0.25 * hf: q[1] = max(0, q[3] - hf)
        else: avisos.append(f'a vista "{k}" tem {h} px de altura e a frente {hf}: não deu para igualar; confira se estão na mesma escala')
    return v, avisos


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if not a: sys.exit(__doc__)
    W, H, rgb = ler_png(a[0]); tol = int(opcao(a, '--tolerancia', 1, [28])[0])
    if '--limpar' in a:
        pols = []
        for i, v in enumerate(a):
            if v != '--manter': continue
            nums = []; j = i + 1
            while j < len(a) and not a[j].startswith('--'): nums.append(float(a[j])); j += 1
            if len(nums) >= 6: pols.append([(nums[k], nums[k + 1]) for k in range(0, len(nums) - 1, 2)])
        if not pols: sys.exit('--limpar precisa de pelo menos um --manter com três pontos ou mais.')
        k = ((H - 8) * W + 8) * 3; cor = tuple(rgb[k:k + 3])
        if '--fundo' in a: h = a[a.index('--fundo') + 1].lstrip('#'); cor = tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
        limpa = limpar(W, H, rgb, pols, cor)
        if '--nevoa' in a: print(f'névoa: {tirar_nevoa(W, H, limpa, cor, int(opcao(a, "--nevoa", 1, [6])[0]))} pixels de fundo liso apagados')
        for i, v in enumerate(a):
            if v == '--espelhar': espelhar(W, limpa, *[int(float(n)) for n in a[i + 1:i + 5]])
        alfa = None
        if '--papel' in a:
            alfa, apagados, furos = tirar_papel(W, H, limpa, pols, cor)
            print(f'papel: {apagados} pixels apagados em volta das vistas; {furos} pixels de vãos presos ficaram transparentes')
        saida = a[a.index('--limpar') + 1]; escrever_png(saida, W, H, limpa, alfa)
        print(f'{saida}: {len(pols)} áreas mantidas; o resto virou fundo #{cor[0]:02x}{cor[1]:02x}{cor[2]:02x}. Confira com --pecas --conferir.')
        return
    fundo = fundo_ligado(W, H, rgb, tol)
    if '--pecas' in a:
        etiquetas = 0 if '--sem-etiquetas' in a else apagar_etiquetas(W, H, rgb, fundo)
        ret = pecas(W, H, fundo, int(opcao(a, '--minimo', 1, [30])[0]))
        aparadas = etiquetas
        if '--sem-etiquetas' not in a:
            for i, q in enumerate(ret):
                ret[i], tinha = aparar_etiqueta(W, H, rgb, fundo, q); aparadas += tinha
        print(f'{a[0]}: {W} x {H} px, {len(ret)} peças' + (f' ({aparadas} etiquetas de número tiradas)' if aparadas else ''))
        for i, r in enumerate(ret, 1): print(f'  peça {i}: {r}  ({r[2] - r[0]} x {r[3] - r[1]} px)')
        print('A numeração é desta ferramenta (de cima para baixo, da esquerda para a direita). Se a folha tem números pintados, eles podem não bater: confira com --conferir.')
        if '--conferir' in a:
            t = recortar(W, H, rgb, 0, 0, W, H, 1)
            for i, r in enumerate(ret, 1): t.retangulo(r[0], r[1], r[2], r[3], (255, 60, 60), 2); t.texto(str(i), r[0] + 3, r[1] + 3, (255, 230, 0), 2)
            saida = a[a.index('--conferir') + 1]; escrever_png(saida, t.w, t.h, t.pix); print(f'{saida}: peças marcadas')
        return
    ret = vistas(W, H, fundo); avisos = []
    if len(ret) != 4:
        # Talvez as vistas venham em duas fileiras: separa as peças grandes (rótulos e linhas soltas ficam de fora).
        grandes = pecas(W, H, fundo, max(60, int(min(W, H) * 0.06)))
        if len(grandes) == 4:
            v, avisos = reconhecer(W, H, fundo, grandes)
            ret = [v['frente'], v['lado'], v['fundos'], v['telhado']]
            print('As vistas estão em duas fileiras; reconheci qual é qual pelo formato (confira com --conferir).')
        else:
            print(f'Achei {len(ret)} vistas numa fileira e {len(grandes)} peças grandes. Se as vistas estão misturadas com outra coisa, limpe com --limpar;')
            print('se é uma folha modular (peças soltas), use --pecas.')
    else:
        ret = [list(aparar_chao(W, H, fundo, q)[0]) for q in ret[:3]] + [ret[3]]
        hf = ret[0][3] - ret[0][1]
        for q in ret[1:3]:
            if abs((q[3] - q[1]) - hf) <= 0.25 * hf: q[1] = max(0, q[3] - hf)
    nomes = ['frente', 'lado', 'fundos', 'telhado']
    print(f'{a[0]}: {W} x {H} px, {len(ret)} vistas (fundo #{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x})')
    for i, r in enumerate(ret): print(f'  {nomes[i] if i < 4 else "vista " + str(i + 1)}: {r}  ({r[2] - r[0]} x {r[3] - r[1]} px)')
    if len(ret) != 4: print('Esperava quatro vistas (frente, lateral, fundos, telhado). Confira a folha, ou ajuste --tolerancia.')
    else:
        fw, fh = ret[0][2] - ret[0][0], ret[0][3] - ret[0][1]
        lw, tw, th = ret[1][2] - ret[1][0], ret[3][2] - ret[3][0], ret[3][3] - ret[3][1]
        p_lado, p_tel = 20 * fh / fw * lw / fh, 20 * th / tw
        if fw > fh * 1.3 and th > tw * 1.3: print('O telhado está deitado (mais alto que largo, e a frente é larga): use "telhadoFrente": "direita" ou "esquerda".'); p_tel = 20 * tw / th
        if abs(tw - lw) <= 0.15 * lw and abs(th - fh) <= 0.2 * fh:
            avisos.append('a quarta vista tem o tamanho de uma LATERAL, não de um telhado visto de cima: a folha pode trazer as duas laterais e nenhum telhado. Use só frente, lado e fundos (tire "telhado" do trecho); o topo fica com a cor da fachada')
        if abs(p_lado - p_tel) > 0.2 * max(p_lado, p_tel): avisos.append(f'as vistas não combinam: com 20 m de frente, a lateral pede {p_lado:.1f} m de fundo e o telhado {p_tel:.1f} m. Dê "profundidade" pela laje do chão, ou pelo telhado')
        for a_ in avisos: print('Atenção: ' + a_)
        print('Trecho para o mapa (troque x, y e "largura", em metros; a altura sai da proporção da frente):')
        print('  ' + json.dumps({'imagem': a[0], **{n: r for n, r in zip(nomes, ret)}, 'x': 0, 'y': 0, 'giro': 0, 'largura': 20}, ensure_ascii=False))
        print(f'  Com largura 20 m, a altura fica em {20 * fh / fw:.1f} m.')
    if '--conferir' in a:
        t = recortar(W, H, rgb, 0, 0, W, H, 1)
        for i, r in enumerate(ret): t.retangulo(r[0], r[1], r[2], r[3], (255, 60, 60), 2); t.texto(nomes[i].upper() if i < 4 else str(i + 1), r[0] + 4, max(0, r[1] - 18), (255, 230, 0), 2)
        saida = a[a.index('--conferir') + 1]; escrever_png(saida, t.w, t.h, t.pix); print(f'{saida}: vistas marcadas')


if __name__ == '__main__':
    main()
