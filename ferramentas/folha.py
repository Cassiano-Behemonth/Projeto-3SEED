#!/usr/bin/env python3
"""Lê uma folha de referência de um prédio (várias vistas lado a lado sobre fundo liso) e diz onde está cada vista.

Uso:
  python3 ferramentas/folha.py assets/predios/hotel.png                  # acha as quatro vistas, em uma ou duas fileiras
  python3 ferramentas/folha.py assets/predios/hotel.png --conferir rascunho/f.png

A folha deve ter as quatro vistas separadas por fundo liso: frente, lateral direita, fundos e telhado visto de cima.
Elas podem vir numa fileira (nessa ordem, da esquerda para a direita) ou em duas (2 x 2, com rótulos embaixo).
A ferramenta acha o fundo a partir da borda da imagem, separa cada vista, reconhece qual é qual, tira a linha de chão
desenhada embaixo das elevações, iguala a altura das três (para os andares baterem), confere se as medidas combinam
e imprime o trecho pronto para colar no campo "folhas" do mapa.
--conferir grava a folha com os retângulos desenhados; --tolerancia N (padrão 28) é quanto a cor do fundo pode variar.

  python3 ferramentas/folha.py assets/predios/capela_modular.png --pecas --conferir rascunho/f.png
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

  python3 ferramentas/folha.py assets/predios/hotel.png --alinhar rascunho/alinhar.png
--alinhar  Conferência de LATERAL ESPELHADA e de DETALHE FORA DO LUGAR (chaminé, torre, cúpula em lugares diferentes
         em cada vista, que no 3D viram duas ou três). Grava uma imagem com o telhado girado em cima de cada vista, na
         mesma escala, com linhas-guia a cada 10%: o que sobe do telhado tem que cair na mesma linha na vista de baixo.
         Mostra também a lateral desvirada e a "volta" (frente, lateral e fundos lado a lado, como quem dá a volta no
         prédio: a quina direita da frente continua na esquerda da lateral). Se a lateral desvirada bate melhor, use
         --limpar ... --espelhar naquela vista. Se a chaminé muda de lugar entre as vistas, corrija a folha (ou peça
         de novo) antes de montar o prédio. Nenhuma ferramenta decide isso sozinha: as fachadas são parecidas demais.
         As vistas são as que a ferramenta achou; para dar à mão: --frente X0 Y0 X1 Y1 --lado ... --fundos ... --telhado ...
         --telhado-frente direita|esquerda|cima diz de que lado da vista do telhado fica a frente (padrão: embaixo).
"""
import json, sys
from imagem import ler_png, escrever_png, redimensionar, girar, espelhar_h, colar, Tela, manchas, np
from grade import opcao, recortar


def fundo_ligado(W, H, rgb, tol):
    """Marca o fundo: tudo o que se liga à borda da imagem com a cor do canto (o cinza dentro do prédio não entra).
    Um pixel é fundo se a cor dele está perto da do canto e se um vizinho já marcado tem cor quase igual à dele (o fundo
    pode ser um degradê: vale a diferença para o vizinho)."""
    r0, g0, b0 = rgb[0], rgb[1], rgb[2]
    longe = tol * 3; passo = max(4, tol // 3)
    if np is not None: return _fundo_ligado_np(W, H, rgb, r0, g0, b0, longe, passo)
    n = W * H
    perto = bytearray(map(lambda r, g, b: abs(r - r0) <= longe and abs(g - g0) <= longe and abs(b - b0) <= longe, rgb[0::3], rgb[1::3], rgb[2::3]))
    def liso(i, j):
        k, q = i * 3, j * 3
        return abs(rgb[k] - rgb[q]) <= passo and abs(rgb[k + 1] - rgb[q + 1]) <= passo and abs(rgb[k + 2] - rgb[q + 2]) <= passo
    fundo = bytearray(n)
    pilha = [x for x in range(W)] + [(H - 1) * W + x for x in range(W)] + [y * W for y in range(H)] + [y * W + W - 1 for y in range(H)]
    while pilha:   # o salto de cor é conferido ao empilhar o vizinho, a partir de um pixel já marcado
        i = pilha.pop()
        if fundo[i] or not perto[i]: continue
        fundo[i] = 1; x = i % W
        if x > 0 and not fundo[i - 1] and perto[i - 1] and liso(i, i - 1): pilha.append(i - 1)
        if x < W - 1 and not fundo[i + 1] and perto[i + 1] and liso(i, i + 1): pilha.append(i + 1)
        if i >= W and not fundo[i - W] and perto[i - W] and liso(i, i - W): pilha.append(i - W)
        if i < n - W and not fundo[i + W] and perto[i + W] and liso(i, i + W): pilha.append(i + W)
    return fundo


def _fundo_ligado_np(W, H, rgb, r0, g0, b0, longe, passo):
    """O mesmo, em blocos: ligações entre vizinhos (perto do canto e cor quase igual) e crescimento por trechos."""
    im = np.frombuffer(bytes(rgb), np.uint8).reshape(H, W, 3).astype(np.int16)
    perto = (np.abs(im - np.array([r0, g0, b0], np.int16)) <= longe).all(axis=2)
    liga_h = perto[:, 1:] & perto[:, :-1] & (np.abs(im[:, 1:] - im[:, :-1]) <= passo).all(axis=2)   # (y, x) com (y, x + 1)
    liga_v = perto[1:, :] & perto[:-1, :] & (np.abs(im[1:, :] - im[:-1, :]) <= passo).all(axis=2)   # (y, x) com (y + 1, x)
    alc = np.zeros((H, W), bool)
    alc[0, :] = perto[0, :]; alc[-1, :] = perto[-1, :]; alc[:, 0] |= perto[:, 0]; alc[:, -1] |= perto[:, -1]
    def varrer(liga, a_):   # trechos: pixels seguidos ligados um ao outro; um trecho alcançado fica todo alcançado
        h_, w_ = a_.shape; ini = np.ones((h_, w_), bool); ini[:, 1:] = ~liga
        rot = np.cumsum(ini.ravel()).reshape(h_, w_); tem = np.zeros(rot.max() + 1, bool); tem[rot[a_]] = True
        return tem[rot]
    while True:
        antes = int(alc.sum())
        alc = varrer(liga_h, alc) & perto
        alc = (varrer(liga_v.T, alc.T.copy()).T) & perto
        if int(alc.sum()) == antes: break
    return bytearray(alc.astype(np.uint8).tobytes())


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
    """Retângulos das peças soltas: grupos de pixels que não são fundo, ligados entre si (também na diagonal)."""
    ret = [c for _, c, _ in manchas(W, H, fundo, 1, pixels=False) if c[2] - c[0] >= minimo and c[3] - c[1] >= minimo]
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


def alinhar(W, H, rgb, v, saida, telhado_frente='baixo'):
    """Imagem de conferência: o telhado girado em cima de cada vista, na mesma largura, com linhas-guia; e a volta no prédio."""
    LB, GAP, ROT = 760, 34, 22
    def pedaco(r, largura=None, altura=None, quartos=0, desvirar=False):
        x0, y0, x1, y1 = r; w, h = x1 - x0, y1 - y0
        if quartos % 2: w, h = h, w
        nw, nh = (largura, max(1, round(largura * h / w))) if largura else (max(1, round(altura * w / h)), altura)
        if quartos % 2: px, _ = redimensionar(W, rgb, None, r, nh, nw)
        else: px, _ = redimensionar(W, rgb, None, r, nw, nh)
        if quartos:
            ww, hh = (nh, nw) if quartos % 2 else (nw, nh)
            nw, nh, px, _ = girar(ww, hh, px, None, quartos)
        if desvirar: px, _ = espelhar_h(nw, nh, px, None)
        return nw, nh, px
    base = {'baixo': 0, 'cima': 2, 'direita': 1, 'esquerda': 3}.get(telhado_frente, 0)
    T = v.get('telhado')
    blocos = [('FRENTE', v['frente'], 0, False), ('LATERAL DIREITA', v['lado'], 1, False),
              ('FUNDOS', v.get('fundos'), 2, False), ('LATERAL DESVIRADA', v['lado'], 1, True)]
    pecas_ = []
    for nome, r, q, desv in blocos:
        if not r: continue
        tel = pedaco(T, largura=LB, quartos=base + q) if T else None
        vis = pedaco(r, largura=LB, desvirar=desv)
        pecas_.append((nome, tel, vis))
    # volta no prédio: frente, lateral e fundos lado a lado, na mesma altura
    HV = 300; volta = []
    for desv in (False, True):
        fila = [pedaco(v['frente'], altura=HV), pedaco(v['lado'], altura=HV, desvirar=desv)] + ([pedaco(v['fundos'], altura=HV)] if v.get('fundos') else [])
        volta.append(fila)
    alt_bloco = lambda p: ROT + (p[1][1] + 8 if p[1] else 0) + p[2][1]
    linhas_ = [pecas_[i:i + 2] for i in range(0, len(pecas_), 2)]
    larg_volta = max(sum(f[0] for f in fila) + 6 * (len(fila) - 1) for fila in volta)
    CW = max(2 * LB + 3 * GAP, larg_volta + 2 * GAP)
    CH = GAP + sum(max(alt_bloco(p) for p in ln) + GAP for ln in linhas_) + 2 * (ROT + HV + GAP)
    pix = bytearray(bytes((38, 40, 44)) * (CW * CH)); t = Tela(CW, CH, pix); y = GAP
    for ln in linhas_:
        for k, (nome, tel, vis) in enumerate(ln):
            x = GAP + k * (LB + GAP); yy = y
            t.texto(nome + ('  (TELHADO GIRADO EM CIMA)' if tel else ''), x, yy, (255, 230, 120), 3, False); yy += ROT
            topo = yy
            if tel: colar(CW, CH, pix, None, x, yy, tel[0], tel[1], tel[2], None); yy += tel[1] + 8
            colar(CW, CH, pix, None, x, yy, vis[0], vis[1], vis[2], None); fim = yy + vis[1]
            for i in range(11):
                gx = x + round(i * (LB - 1) / 10)
                t.linha(gx, topo, gx, fim, (0, 255, 255) if i % 5 else (255, 80, 200), 1, 0.55, 0 if i % 5 else 6)
                t.texto(f'{i * 10}', gx + 2, fim + 2, (0, 255, 255), 2, False)
        y += max(alt_bloco(p) for p in ln) + GAP
    for nome, fila in zip(('VOLTA: FRENTE > LATERAL > FUNDOS', 'VOLTA COM A LATERAL DESVIRADA'), volta):
        t.texto(nome, GAP, y, (255, 230, 120), 3, False); y += ROT; x = GAP
        for i, (w_, h_, px_) in enumerate(fila):
            colar(CW, CH, pix, None, x, y, w_, h_, px_, None)
            if i: t.linha(x - 3, y, x - 3, y + HV, (255, 80, 200), 2)
            x += w_ + 6
        y += HV + GAP
    escrever_png(saida, CW, CH, pix)
    print(f'{saida}: telhado em cima de cada vista e a volta no prédio.')
    print('  Chaminés, torres e cúpulas do telhado devem cair na mesma linha-guia na vista de baixo. Se só baterem na')
    print('  "LATERAL DESVIRADA" (ou se a volta só continua com ela), a lateral veio espelhada: --limpar ... --espelhar.')
    print('  Se um detalhe está numa linha no telhado e em outra na vista, ele vai aparecer repetido no 3D: corrija a folha.')
    if not T: print('  A folha não tem telhado: confira pela volta (a quina direita da frente continua na esquerda da lateral).')


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
    if '--alinhar' in a and '--frente' in a:
        v = {k: [int(float(n)) for n in opcao(a, '--' + k, 4, [None] * 4)] for k in ('frente', 'lado', 'fundos', 'telhado') if '--' + k in a}
        if 'lado' not in v: sys.exit('--alinhar com vistas à mão precisa pelo menos de --frente e --lado.')
        alinhar(W, H, rgb, v, a[a.index('--alinhar') + 1], (a[a.index('--telhado-frente') + 1] if '--telhado-frente' in a else 'baixo')); return
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
        if '--alinhar' in a:
            alinhar(W, H, rgb, dict(zip(nomes, ret)), a[a.index('--alinhar') + 1], (a[a.index('--telhado-frente') + 1] if '--telhado-frente' in a else 'baixo'))
        else: print('Confira a lateral (pode vir espelhada) e a posição das chaminés e torres com --alinhar rascunho/alinhar.png.')
    if '--conferir' in a:
        t = recortar(W, H, rgb, 0, 0, W, H, 1)
        for i, r in enumerate(ret): t.retangulo(r[0], r[1], r[2], r[3], (255, 60, 60), 2); t.texto(nomes[i].upper() if i < 4 else str(i + 1), r[0] + 4, max(0, r[1] - 18), (255, 230, 0), 2)
        saida = a[a.index('--conferir') + 1]; escrever_png(saida, t.w, t.h, t.pix); print(f'{saida}: vistas marcadas')


if __name__ == '__main__':
    main()
