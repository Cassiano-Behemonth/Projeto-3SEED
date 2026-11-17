"""Leitura e escrita de PNG e desenho simples, só com a biblioteca padrão do Python.
Usado por grade.py e previa.py."""
import struct, sys, zlib


def tamanho_png(caminho):
    """(largura, altura) lendo só o cabeçalho; None se não for PNG."""
    with open(caminho, 'rb') as f:
        b = f.read(24)
    return struct.unpack('>II', b[16:24]) if b[:8] == b'\x89PNG\r\n\x1a\n' else None


def ler_png(caminho):
    """Devolve (largura, altura, bytearray RGB)."""
    b = open(caminho, 'rb').read()
    if b[:8] != b'\x89PNG\r\n\x1a\n':
        sys.exit('O arquivo não é um PNG de verdade (pode ser WebP ou JPEG com extensão .png). Converta antes; no Mac: sips -s format png entrada --out saida.png')
    i, idat = 8, b''
    while i < len(b):
        n, tipo = struct.unpack('>I4s', b[i:i + 8]); dado = b[i + 8:i + 8 + n]; i += 12 + n
        if tipo == b'IHDR': w, h, bits, cor, _, _, entrel = struct.unpack('>IIBBBBB', dado)
        elif tipo == b'IDAT': idat += dado
    if bits != 8 or entrel or cor not in (0, 2, 4, 6):
        sys.exit(f'PNG não suportado (bits={bits}, tipo de cor={cor}, entrelaçado={entrel}).')
    canais = {0: 1, 2: 3, 4: 2, 6: 4}[cor]; passo = w * canais
    bruto = zlib.decompress(idat); ant = bytearray(passo); p = 0; rgb = bytearray(w * h * 3)
    for y in range(h):
        f = bruto[p]; lin = bytearray(bruto[p + 1:p + 1 + passo]); p += 1 + passo
        if f == 1:
            for k in range(canais, passo): lin[k] = (lin[k] + lin[k - canais]) & 255
        elif f == 2:
            for k in range(passo): lin[k] = (lin[k] + ant[k]) & 255
        elif f == 3:
            for k in range(passo): lin[k] = (lin[k] + (((lin[k - canais] if k >= canais else 0) + ant[k]) >> 1)) & 255
        elif f == 4:
            for k in range(passo):
                a = lin[k - canais] if k >= canais else 0; bb = ant[k]; c = ant[k - canais] if k >= canais else 0
                pa, pb, pc = abs(bb - c), abs(a - c), abs(a + bb - 2 * c)
                lin[k] = (lin[k] + (a if pa <= pb and pa <= pc else bb if pb <= pc else c)) & 255
        ant = lin; base = y * w * 3
        if canais >= 3:
            rgb[base:base + w * 3:3] = lin[0::canais]; rgb[base + 1:base + w * 3:3] = lin[1::canais]; rgb[base + 2:base + w * 3:3] = lin[2::canais]
        else:
            rgb[base:base + w * 3:3] = lin[0::canais]; rgb[base + 1:base + w * 3:3] = lin[0::canais]; rgb[base + 2:base + w * 3:3] = lin[0::canais]
    return w, h, rgb


def escrever_png(caminho, w, h, pix, alfa=None):
    """Grava RGB; com alfa (bytearray de w*h, 0 = transparente), grava RGBA."""
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
