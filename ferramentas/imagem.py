"""Leitura e escrita de PNG, redimensionar e girar, e desenho simples, só com a biblioteca padrão do Python.
Usado por todas as ferramentas que leem ou gravam imagem.

Aceleração opcional: se o numpy estiver instalado, as contas pesadas (redimensionar, colar, tirar fundo) usam ele; se o
Pillow estiver instalado, ele decodifica os PNG. O resultado é o mesmo, só mais rápido. Para forçar o Python puro (ao
testar), defina SEED_SEM_NUMPY=1 e SEED_SEM_PIL=1 no ambiente."""
import os, re, struct, sys, zlib

np = None
if not os.environ.get('SEED_SEM_NUMPY'):
    try: import numpy as np
    except ImportError: np = None
_PIL = None
if not os.environ.get('SEED_SEM_PIL'):
    try: from PIL import Image as _PIL
    except ImportError: _PIL = None

# A saída sai sempre em UTF-8, também quando vai para um arquivo ou para outro programa (um assistente de IA no terminal
# lê assim). Sem isso, no Windows ela sairia na codificação antiga do sistema, com os acentos trocados, e um símbolo
# fora dela derrubaria a ferramenta. Quem precisar de outra codificação define PYTHONIOENCODING.
if not os.environ.get('PYTHONIOENCODING'):
    for _f in (sys.stdout, sys.stderr):
        try: _f.reconfigure(encoding='utf-8', errors='replace')
        except (AttributeError, ValueError): pass


def tamanho_png(caminho):
    """(largura, altura) lendo só o cabeçalho; None se não for PNG."""
    with open(caminho, 'rb') as f:
        b = f.read(24)
    return struct.unpack('>II', b[16:24]) if b[:8] == b'\x89PNG\r\n\x1a\n' else None


def _desfiltrar(bruto, h, passo, bpp):
    """Desfaz os filtros do PNG, linha a linha. Devolve a lista de linhas (bytearray) já sem filtro."""
    linhas = []; ant = bytearray(passo); p = 0
    for _ in range(h):
        f = bruto[p]; lin = bytearray(bruto[p + 1:p + 1 + passo]); p += 1 + passo
        if f == 1:
            for k in range(bpp, passo): lin[k] = (lin[k] + lin[k - bpp]) & 255
        elif f == 2:
            for k in range(passo): lin[k] = (lin[k] + ant[k]) & 255
        elif f == 3:
            for k in range(min(bpp, passo)): lin[k] = (lin[k] + (ant[k] >> 1)) & 255
            for k in range(bpp, passo): lin[k] = (lin[k] + ((lin[k - bpp] + ant[k]) >> 1)) & 255
        elif f == 4:   # Paeth: no começo da linha (sem vizinho à esquerda) o palpite é o de cima
            for k in range(min(bpp, passo)): lin[k] = (lin[k] + ant[k]) & 255
            for k in range(bpp, passo):
                a = lin[k - bpp]; bb = ant[k]; c = ant[k - bpp]
                pa = bb - c; pb = a - c; pc = pa + pb
                if pa < 0: pa = -pa
                if pb < 0: pb = -pb
                if pc < 0: pc = -pc
                lin[k] = (lin[k] + (a if pa <= pb and pa <= pc else bb if pb <= pc else c)) & 255
        elif f != 0: sys.exit(f'PNG com filtro desconhecido ({f}): o arquivo pode estar corrompido.')
        linhas.append(lin); ant = lin
    return linhas


ADAM7 = ((0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2))


def ler_png(caminho, com_alfa=False):
    """Devolve (largura, altura, bytearray RGB). Com com_alfa=True, devolve também a transparência (bytearray de
    largura x altura, 0 = transparente; tudo 255 se o PNG não tem transparência).
    Lê qualquer PNG: cor, cinza e paleta, de 1 a 16 bits, com ou sem transparência, entrelaçado ou não."""
    b = open(caminho, 'rb').read()
    if b[:8] != b'\x89PNG\r\n\x1a\n':
        tipo = 'JPEG' if b[:3] == b'\xff\xd8\xff' else 'WebP' if b[8:12] == b'WEBP' else 'GIF' if b[:3] == b'GIF' else 'outro formato'
        sys.exit(f'{caminho}: não é um PNG de verdade ({tipo}, mesmo com extensão .png). Converta antes: ffmpeg -i entrada saida.png'
                 ' (ou, no Mac, sips -s format png entrada --out saida.png).')
    if _PIL is not None:
        try:
            im = _PIL.open(caminho); im.load()
            if im.mode in ('I', 'F') or im.mode.startswith('I;'): raise ValueError   # 16 bits de cinza: o Pillow corta em vez de reduzir
            tem_alfa = im.mode in ('RGBA', 'LA', 'PA') or 'transparency' in im.info
            im = im.convert('RGBA' if com_alfa and tem_alfa else 'RGB')
            w, h = im.size
            if im.mode == 'RGBA':
                bruto = im.tobytes(); rgb = bytearray(w * h * 3); al = bytearray(bruto[3::4])
                rgb[0::3] = bruto[0::4]; rgb[1::3] = bruto[1::4]; rgb[2::3] = bruto[2::4]
                return w, h, rgb, al
            rgb = bytearray(im.tobytes())
            return (w, h, rgb, bytearray(b'\xff') * (w * h)) if com_alfa else (w, h, rgb)
        except Exception: pass   # se o Pillow não der conta, o leitor abaixo tenta
    i, idat, plte, trns = 8, [], b'', b''
    while i < len(b):
        n, tipo = struct.unpack('>I4s', b[i:i + 8]); dado = b[i + 8:i + 8 + n]; i += 12 + n
        if tipo == b'IHDR': w, h, bits, cor, _, _, entrel = struct.unpack('>IIBBBBB', dado)
        elif tipo == b'PLTE': plte = dado
        elif tipo == b'tRNS': trns = dado
        elif tipo == b'IDAT': idat.append(dado)
        elif tipo == b'IEND': break
    canais = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(cor)
    if canais is None or bits not in (1, 2, 4, 8, 16) or (cor in (2, 4, 6) and bits < 8) or (cor == 3 and bits == 16):
        sys.exit(f'{caminho}: PNG não suportado (bits={bits}, tipo de cor={cor}).')
    bpp = max(1, canais * bits // 8); bruto = zlib.decompress(b''.join(idat))
    if cor == 3:
        pal = [plte[k * 3:k * 3 + 3] for k in range(len(plte) // 3)]
        tab_rgb = [pal[k] if k < len(pal) else b'\x00\x00\x00' for k in range(256)]
        tab_alfa = bytes(list(trns[:256]) + [255] * (256 - len(trns[:256])))
    elif trns and cor in (0, 2):   # uma cor só é transparente (tRNS em cinza ou RGB)
        alvo = struct.unpack('>H', trns[:2])[0] if cor == 0 else struct.unpack('>HHH', trns[:6])
        if bits == 16: alvo = (alvo >> 8) if cor == 0 else tuple(v >> 8 for v in alvo)
        elif cor == 0 and bits < 8: alvo *= 255 // ((1 << bits) - 1)
        alvo = bytes([alvo] * 3) if cor == 0 else bytes(alvo)

    def pixels(lin, n):
        """Uma linha sem filtro vira (n pixels RGB, n de transparência ou None)."""
        if bits == 16: lin = lin[0::2]   # fica o byte mais alto de cada amostra
        elif bits < 8:                   # vários pixels por byte (paleta ou cinza de 1, 2 ou 4 bits)
            por = 8 // bits; masc = (1 << bits) - 1; vals = bytearray(n)
            for x in range(n): vals[x] = (lin[x // por] >> (8 - bits * (x % por + 1))) & masc
            if cor == 0: vals = bytearray(v * (255 // masc) for v in vals)
            lin = vals
        if cor == 3: return b''.join(tab_rgb[v] for v in lin[:n]), (bytes(tab_alfa[v] for v in lin[:n]) if trns else None)
        out = bytearray(n * 3)
        if canais >= 3: out[0::3] = lin[0:n * canais:canais]; out[1::3] = lin[1:n * canais:canais]; out[2::3] = lin[2:n * canais:canais]
        else: c = lin[0:n * canais:canais]; out[0::3] = c; out[1::3] = c; out[2::3] = c
        if canais in (2, 4): return out, bytes(lin[canais - 1:n * canais:canais])
        if trns: return out, bytes(0 if out[k * 3:k * 3 + 3] == alvo else 255 for k in range(n))
        return out, None

    rgb = bytearray(w * h * 3); alfa = bytearray(b'\xff') * (w * h) if com_alfa else None
    passadas = ADAM7 if entrel else ((0, 0, 1, 1),)
    p = 0
    for x0, y0, dx, dy in passadas:
        pw, ph = (w - x0 + dx - 1) // dx, (h - y0 + dy - 1) // dy
        if pw <= 0 or ph <= 0: continue
        passo = (pw * canais * bits + 7) // 8
        linhas = _desfiltrar(bruto[p:p + ph * (passo + 1)], ph, passo, bpp); p += ph * (passo + 1)
        for j, lin in enumerate(linhas):
            cores, al = pixels(lin, pw); y = y0 + j * dy
            if dx == 1:
                rgb[y * w * 3:(y + 1) * w * 3] = cores
                if alfa is not None and al is not None: alfa[y * w:(y + 1) * w] = al
            else:
                for k in range(pw):
                    q = y * w + x0 + k * dx; rgb[q * 3:q * 3 + 3] = cores[k * 3:k * 3 + 3]
                    if alfa is not None and al is not None: alfa[q] = al[k]
    return (w, h, rgb, alfa) if com_alfa else (w, h, rgb)


def redimensionar(w, rgb, alfa, ret, nw, nh):
    """Recorta ret = [x0, y0, x1, y1] e leva a nw x nh, pela média de cada caixa (sem serrilhar ao reduzir).
    A cor é ponderada pela transparência, para a borda não escurecer. Devolve (rgb, alfa); alfa pode ser None."""
    x0, y0, x1, y1 = ret; sw, sh = x1 - x0, y1 - y0
    if np is not None: return _redimensionar_np(w, rgb, alfa, ret, nw, nh)
    return _redimensionar_puro(w, rgb, alfa, ret, nw, nh)


def _redimensionar_puro(w, rgb, alfa, ret, nw, nh):
    """Somas acumuladas por linha (accumulate e itemgetter fazem o trabalho em C) e soma das linhas de cada caixa."""
    from itertools import accumulate
    from operator import add, itemgetter, mul, sub
    x0, y0, x1, y1 = ret; sw, sh = x1 - x0, y1 - y0
    xa = [int(k * sw / nw) for k in range(nw)]; xb = [max(xa[k] + 1, int((k + 1) * sw / nw)) for k in range(nw)]
    ya = [int(k * sh / nh) for k in range(nh)]; yb = [max(ya[k] + 1, int((k + 1) * sh / nh)) for k in range(nh)]
    pega_a, pega_b = itemgetter(*xa), itemgetter(*xb)
    if nw == 1: pega_a, pega_b = (lambda l, k=xa[0]: (l[k],)), (lambda l, k=xb[0]: (l[k],))
    cheio = bytes([255]) * sw
    def linha(y):   # somas das caixas da linha y da imagem: (vermelho, verde, azul ponderados, transparência)
        b = ((y0 + y) * w + x0) * 3; a = alfa[(y0 + y) * w + x0:(y0 + y) * w + x1] if alfa is not None else cheio
        res = []
        for v in (list(map(mul, rgb[b:b + sw * 3:3], a)), list(map(mul, rgb[b + 1:b + sw * 3:3], a)), list(map(mul, rgb[b + 2:b + sw * 3:3], a)), a):
            acc = [0]; acc.extend(accumulate(v))
            res.append(list(map(sub, pega_b(acc), pega_a(acc))))
        return res
    out = bytearray(nw * nh * 3); oa = bytearray(nw * nh) if alfa is not None else None
    cache = {}
    for j in range(nh):
        soma = None
        for y in range(ya[j], yb[j]):
            if y not in cache: cache = {k: v for k, v in cache.items() if k >= ya[j]}; cache[y] = linha(y)
            l = cache[y]
            soma = [list(c) for c in l] if soma is None else [list(map(add, s_, c)) for s_, c in zip(soma, l)]
        r, g, b_, pa = soma; n_ = (yb[j] - ya[j])
        o = j * nw * 3
        for i in range(nw):
            p_ = pa[i]
            if p_: out[o + i * 3] = r[i] // p_; out[o + i * 3 + 1] = g[i] // p_; out[o + i * 3 + 2] = b_[i] // p_
        if oa is not None: oa[j * nw:(j + 1) * nw] = bytes(pa[i] // (n_ * (xb[i] - xa[i])) for i in range(nw))
    return out, oa


def _redimensionar_antigo(w, rgb, alfa, ret, nw, nh):
    """A conta original, pixel a pixel (fica para conferir as outras)."""
    x0, y0, x1, y1 = ret; sw, sh = x1 - x0, y1 - y0
    out = bytearray(nw * nh * 3); oa = bytearray(nw * nh) if alfa is not None else None
    cols = [(x0 + int(i * sw / nw), x0 + max(int(i * sw / nw) + 1, int((i + 1) * sw / nw))) for i in range(nw)]
    for j in range(nh):
        ya, yb = y0 + int(j * sh / nh), y0 + max(int(j * sh / nh) + 1, int((j + 1) * sh / nh))
        for i, (xa, xb) in enumerate(cols):
            r = g = b = pa = n = 0
            for y in range(ya, yb):
                for x in range(xa, xb):
                    q = y * w + x; a = alfa[q] if alfa is not None else 255; k = q * 3
                    r += rgb[k] * a; g += rgb[k + 1] * a; b += rgb[k + 2] * a; pa += a; n += 1
            o = (j * nw + i) * 3
            if pa: out[o] = r // pa; out[o + 1] = g // pa; out[o + 2] = b // pa
            if oa is not None: oa[j * nw + i] = pa // n
    return out, oa


def _redimensionar_np(w, rgb, alfa, ret, nw, nh):
    """O mesmo que redimensionar, com somas acumuladas (as mesmas caixas e a mesma conta inteira)."""
    x0, y0, x1, y1 = ret; sw, sh = x1 - x0, y1 - y0
    H = len(rgb) // (3 * w)
    img = np.frombuffer(bytes(rgb), np.uint8).reshape(H, w, 3)[y0:y1, x0:x1].astype(np.int64)
    a = (np.frombuffer(bytes(alfa), np.uint8).reshape(H, w)[y0:y1, x0:x1].astype(np.int64) if alfa is not None
         else np.full((sh, sw), 255, np.int64))
    def acumula(m):   # soma acumulada com uma linha e uma coluna de zeros na frente
        z = np.zeros((m.shape[0] + 1, m.shape[1] + 1) + m.shape[2:], np.int64); z[1:, 1:] = m.cumsum(0).cumsum(1); return z
    # mesmas contas do Python puro: int(i * sw / nw) com divisão de ponto flutuante
    xa = np.array([int(k * sw / nw) for k in range(nw)]); xb = np.array([max(int(k * sw / nw) + 1, int((k + 1) * sw / nw)) for k in range(nw)])
    ya = np.array([int(k * sh / nh) for k in range(nh)]); yb = np.array([max(int(k * sh / nh) + 1, int((k + 1) * sh / nh)) for k in range(nh)])
    def caixa(z):
        return z[yb][:, xb] - z[ya][:, xb] - z[yb][:, xa] + z[ya][:, xa]
    sa = caixa(acumula(a)); sc = caixa(acumula(img * a[..., None])); n = (yb - ya)[:, None] * (xb - xa)[None, :]
    seguro = np.where(sa > 0, sa, 1)[..., None]
    cor = np.where(sa[..., None] > 0, sc // seguro, 0).astype(np.uint8)
    out = bytearray(cor.tobytes())
    oa = bytearray((sa // n).astype(np.uint8).tobytes()) if alfa is not None else None
    return out, oa


def girar(w, h, rgb, alfa, quartos):
    """Gira de 90 em 90 graus no sentido horário (quartos = 1, 2 ou 3). Devolve (w, h, rgb, alfa)."""
    quartos %= 4
    if not quartos: return w, h, rgb, alfa
    nw, nh = (h, w) if quartos % 2 else (w, h)
    if np is not None:   # rot90 gira no sentido anti-horário; -quartos dá o horário
        g = np.rot90(np.frombuffer(bytes(rgb), np.uint8).reshape(h, w, 3), -quartos)
        ga = np.rot90(np.frombuffer(bytes(alfa), np.uint8).reshape(h, w), -quartos) if alfa is not None else None
        return nw, nh, bytearray(np.ascontiguousarray(g).tobytes()), (bytearray(np.ascontiguousarray(ga).tobytes()) if ga is not None else None)
    out = bytearray(nw * nh * 3); oa = bytearray(nw * nh) if alfa is not None else None
    for y in range(h):
        for x in range(w):
            if quartos == 1: nx, ny = h - 1 - y, x
            elif quartos == 2: nx, ny = w - 1 - x, h - 1 - y
            else: nx, ny = y, w - 1 - x
            s, d = (y * w + x), (ny * nw + nx)
            out[d * 3:d * 3 + 3] = rgb[s * 3:s * 3 + 3]
            if oa is not None: oa[d] = alfa[s]
    return nw, nh, out, oa


def espelhar_h(w, h, rgb, alfa):
    """Desvira na horizontal (a esquerda vai para a direita). Devolve (rgb, alfa)."""
    if np is not None:
        e = np.frombuffer(bytes(rgb), np.uint8).reshape(h, w, 3)[:, ::-1]
        ea = np.frombuffer(bytes(alfa), np.uint8).reshape(h, w)[:, ::-1] if alfa is not None else None
        return bytearray(np.ascontiguousarray(e).tobytes()), (bytearray(np.ascontiguousarray(ea).tobytes()) if ea is not None else None)
    out = bytearray(len(rgb)); oa = bytearray(len(alfa)) if alfa is not None else None
    for y in range(h):
        for x in range(w):
            s, d = y * w + x, y * w + (w - 1 - x)
            out[d * 3:d * 3 + 3] = rgb[s * 3:s * 3 + 3]
            if oa is not None: oa[d] = alfa[s]
    return out, oa


def colar(W, H, pix, alfa_dest, x, y, w, h, rgb, alfa):
    """Cola uma imagem w x h em (x, y) de uma tela W x H; com alfa, mistura pela transparência."""
    xa, xb = max(0, x), min(W, x + w)   # parte que cai dentro da tela
    if xa >= xb: return
    if np is not None:
        ya, yb = max(0, y), min(H, y + h)
        if ya >= yb: return
        src = np.frombuffer(bytes(rgb), np.uint8).reshape(h, w, 3)[ya - y:yb - y, xa - x:xb - x].astype(np.uint32)
        tela = np.frombuffer(pix, np.uint8).reshape(H, W, 3)
        dst = tela[ya:yb, xa:xb].astype(np.uint32)
        if alfa is None: tela[ya:yb, xa:xb] = src
        else:
            a = np.frombuffer(bytes(alfa), np.uint8).reshape(h, w)[ya - y:yb - y, xa - x:xb - x].astype(np.uint32)[..., None]
            tela[ya:yb, xa:xb] = ((src * a + dst * (255 - a)) // 255).astype(np.uint8)
            if alfa_dest is not None:
                ad = np.frombuffer(alfa_dest, np.uint8).reshape(H, W)
                ad[ya:yb, xa:xb] = np.maximum(ad[ya:yb, xa:xb], a[..., 0].astype(np.uint8))
        if alfa is None and alfa_dest is not None: np.frombuffer(alfa_dest, np.uint8).reshape(H, W)[ya:yb, xa:xb] = 255
        return
    for j in range(h):
        Y = y + j
        if not 0 <= Y < H: continue
        if alfa is None:
            pix[(Y * W + xa) * 3:(Y * W + xb) * 3] = rgb[(j * w + xa - x) * 3:(j * w + xb - x) * 3]
            if alfa_dest is not None: alfa_dest[Y * W + xa:Y * W + xb] = b'\xff' * (xb - xa)
            continue
        lin = bytes(alfa[j * w + xa - x:j * w + xb - x])
        for m in re.finditer(b'[^\x00]+', lin):          # só os trechos com algo visível
            i0, i1 = m.start(), m.end()
            for n in re.finditer(b'\xff+|[^\xff]+', lin[i0:i1]):
                k0, k1 = i0 + n.start(), i0 + n.end(); s0, d0 = j * w + xa - x + k0, Y * W + xa + k0
                if lin[k0] == 255:                         # trecho opaco: copia de uma vez
                    pix[d0 * 3:(d0 + k1 - k0) * 3] = rgb[s0 * 3:(s0 + k1 - k0) * 3]
                    if alfa_dest is not None: alfa_dest[d0:d0 + k1 - k0] = b'\xff' * (k1 - k0)
                    continue
                for k in range(k1 - k0):                   # meio transparente: mistura pixel a pixel
                    a = lin[k0 + k]; s_, d = s0 + k, d0 + k
                    if not a: continue
                    for c in range(3): pix[d * 3 + c] = (rgb[s_ * 3 + c] * a + pix[d * 3 + c] * (255 - a)) // 255
                    if alfa_dest is not None: alfa_dest[d] = max(alfa_dest[d], a)


def manchas(W, H, fundo, minimo=1, pixels=True, diagonais=True):
    """Grupos de pixels de desenho (fundo[i] == 0) ligados entre si, contando as diagonais. Devolve a lista de
    (área, [x0, y0, x1, y1], pixels), na ordem do primeiro pixel de cada grupo (de cima para baixo, da esquerda para a
    direita), só os com área >= minimo. Trabalha por trechos de linha, não pixel a pixel: rápido mesmo sem numpy.
    diagonais=False liga só pelos lados (quatro vizinhos)."""
    d = 0 if diagonais else 1   # sem diagonais, o trecho de cima tem de sobrepor de verdade
    pai = []
    def raiz(k):
        while pai[k] != k: pai[k] = pai[pai[k]]; k = pai[k]
        return k
    trechos = []; ant = []          # (x0, x1, índice) dos trechos da linha de cima
    vazio = re.compile(b'\x00+')
    for y in range(H):
        lin = bytes(fundo[y * W:(y + 1) * W]); atual = []; j = 0
        for m in vazio.finditer(lin):
            x0, x1 = m.start(), m.end(); k = len(trechos); trechos.append((y, x0, x1)); pai.append(k); atual.append((x0, x1, k))
            while j < len(ant) and ant[j][1] < x0 + d: j += 1      # trechos de cima que acabam antes deste
            q = j
            while q < len(ant) and ant[q][0] <= x1 - d:             # encostam (com diagonais, também na quina)
                a_, b_ = raiz(k), raiz(ant[q][2])
                if a_ != b_: pai[max(a_, b_)] = min(a_, b_)
                q += 1
        ant = atual
    grupos = {}
    for k, (y, x0, x1) in enumerate(trechos):
        r = raiz(k); g = grupos.get(r)
        if g is None: grupos[r] = g = [0, [x0, y, x1, y + 1], []]
        g[0] += x1 - x0; c = g[1]
        if x0 < c[0]: c[0] = x0
        if x1 > c[2]: c[2] = x1
        c[3] = y + 1
        g[2].append((y, x0, x1))
    ret = []
    for r in sorted(grupos):      # a raiz é o menor índice do grupo: o primeiro trecho em ordem de leitura
        area, caixa, tr = grupos[r]
        if area < minimo: continue
        px = []
        if pixels:
            for y, x0, x1 in tr: px.extend(range(y * W + x0, y * W + x1))
        ret.append((area, caixa, px))
    return ret


def escrever_png(caminho, w, h, pix, alfa=None):
    """Grava RGB; com alfa (bytearray de w*h, 0 = transparente), grava RGBA. Cria a pasta se ela não existir."""
    pasta = os.path.dirname(os.path.abspath(caminho))
    os.makedirs(pasta, exist_ok=True)
    dados = bytearray()
    for y in range(h):
        dados.append(0)
        if alfa is None: dados += pix[y * w * 3:(y + 1) * w * 3]; continue
        lin = bytearray(w * 4); b0 = y * w * 3
        lin[0::4] = pix[b0:b0 + w * 3:3]; lin[1::4] = pix[b0 + 1:b0 + w * 3:3]; lin[2::4] = pix[b0 + 2:b0 + w * 3:3]; lin[3::4] = alfa[y * w:(y + 1) * w]
        dados += lin
    bloco = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    tipo = 2 if alfa is None else 6
    open(caminho, 'wb').write(b'\x89PNG\r\n\x1a\n' + bloco(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, tipo, 0, 0, 0)) + bloco(b'IDAT', zlib.compress(bytes(dados), 6)) + bloco(b'IEND', b''))


# Letras e algarismos 3x5 (cada linha é um número de 3 bits).
FONTE = {
    '0': (7, 5, 5, 5, 7), '1': (2, 6, 2, 2, 7), '2': (7, 1, 7, 4, 7), '3': (7, 1, 7, 1, 7), '4': (5, 5, 7, 1, 1), '5': (7, 4, 7, 1, 7),
    '6': (7, 4, 7, 5, 7), '7': (7, 1, 2, 2, 2), '8': (7, 5, 7, 5, 7), '9': (7, 5, 7, 1, 7),
    'A': (2, 5, 7, 5, 5), 'B': (6, 5, 6, 5, 6), 'C': (3, 4, 4, 4, 3), 'D': (6, 5, 5, 5, 6), 'E': (7, 4, 6, 4, 7), 'F': (7, 4, 6, 4, 4),
    'G': (3, 4, 5, 5, 3), 'H': (5, 5, 7, 5, 5), 'I': (7, 2, 2, 2, 7), 'J': (1, 1, 1, 5, 2), 'K': (5, 5, 6, 5, 5), 'L': (4, 4, 4, 4, 7),
    'M': (5, 7, 7, 5, 5), 'N': (5, 7, 7, 7, 5), 'O': (2, 5, 5, 5, 2), 'P': (6, 5, 6, 4, 4), 'Q': (2, 5, 5, 7, 3), 'R': (6, 5, 6, 5, 5),
    'S': (3, 4, 2, 1, 6), 'T': (7, 2, 2, 2, 2), 'U': (5, 5, 5, 5, 7), 'V': (5, 5, 5, 5, 2), 'W': (5, 5, 7, 7, 5), 'X': (5, 5, 2, 5, 5),
    'Y': (5, 5, 2, 2, 2), 'Z': (7, 1, 2, 4, 7), '-': (0, 0, 7, 0, 0), '_': (0, 0, 0, 0, 7), '.': (0, 0, 0, 0, 2), ':': (0, 2, 0, 2, 0), ' ': (0, 0, 0, 0, 0),
}
SEM_ACENTO = str.maketrans('ÁÀÂÃÉÊÍÓÔÕÚÇ', 'AAAAEEIOOOUC')


class Tela:
    """Imagem RGB em memória com operações de desenho."""

    def __init__(self, w, h, pix):
        self.w, self.h, self.pix = w, h, pix

    def ponto(self, x, y, cor, forca=1.0):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            k = (y * self.w + x) * 3
            for c in range(3): self.pix[k + c] = int(self.pix[k + c] * (1 - forca) + cor[c] * forca)

    def bloco(self, x, y, t, cor, forca=1.0):
        for yy in range(int(y - t // 2), int(y - t // 2) + max(1, int(t))):
            for xx in range(int(x - t // 2), int(x - t // 2) + max(1, int(t))): self.ponto(xx, yy, cor, forca)

    def linha(self, x0, y0, x1, y1, cor, espessura=1, forca=1.0, tracejado=0):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            if tracejado and (i // tracejado) % 2: continue
            t = i / n
            self.bloco(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, espessura, cor, forca)

    def retangulo(self, x0, y0, x1, y1, cor, espessura=1, preencher=0.0):
        x0, x1 = sorted((int(x0), int(x1))); y0, y1 = sorted((int(y0), int(y1)))
        if preencher:
            for y in range(y0, y1):
                for x in range(x0, x1): self.ponto(x, y, cor, preencher)
        for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))): self.linha(*a, *b, cor, espessura)

    def poligono(self, pontos, cor, espessura=1):
        for i in range(len(pontos)): self.linha(*pontos[i], *pontos[(i + 1) % len(pontos)], cor, espessura)

    def circulo(self, cx, cy, r, cor, cheio=True):
        r = int(r)
        for y in range(-r, r + 1):
            for x in range(-r, r + 1):
                d = x * x + y * y
                if (cheio and d <= r * r) or (not cheio and abs(d - r * r) <= r): self.ponto(cx + x, cy + y, cor)

    def texto(self, s, x, y, cor, t=2, fundo=True):
        s = str(s).upper().translate(SEM_ACENTO)
        if fundo:
            for yy in range(int(y) - 1, int(y) + 5 * t + 1):
                for xx in range(int(x) - 1, int(x) + len(s) * 4 * t): self.ponto(xx, yy, (0, 0, 0), 0.6)
        for i, ch in enumerate(s):
            for ly, bits in enumerate(FONTE.get(ch, FONTE['-'])):
                for lx in range(3):
                    if bits >> (2 - lx) & 1: self.bloco(x + (i * 4 + lx) * t + t // 2, y + ly * t + t // 2, t, cor)
