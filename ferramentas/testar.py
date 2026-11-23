#!/usr/bin/env python3
"""Testa as ferramentas e o programa de ponta a ponta. Rode antes de publicar uma mudança.

Uso:
  python3 ferramentas/testar.py            # tudo: ferramentas, imagens de teste e o programa no navegador (se houver Chrome)
  python3 ferramentas/testar.py --rapido   # só as ferramentas, sem navegador
  python3 ferramentas/testar.py --todos    # inclui os seus mapas (mapas/indice_local.json) no validador e no navegador
  python3 ferramentas/testar.py --manter   # não apaga a pasta com as imagens de teste (para olhar)

O que testa:
  - todas as ferramentas compilam e respondem a --help;
  - o que costuma quebrar em outro computador: a saída tem de sair em UTF-8 com o sistema em outra codificação (como no
    Windows), as ferramentas têm de rodar de outra pasta, e o servidor tem de mandar os .js como JavaScript mesmo quando
    o registro do Windows diz que são texto;
  - a leitura de PNG (cor, cinza, paleta, 1 a 16 bits, transparência, entrelaçado), com e sem Pillow;
  - cada ferramenta numa imagem de teste desenhada aqui mesmo (sem arte de ninguém), conferindo o resultado:
    folha.py acha as quatro vistas, figuras.py recorta as figuras com fundo transparente, objeto.py tira a linha de chão
    e monta o atlas, compor.py põe o pedaço no lugar, quadricula.py tira a grade, e assim por diante;
  - com numpy ou Pillow instalados, que o resultado é o mesmo do Python puro;
  - o validador nos mapas de exemplo, num mapa com erros de propósito e nas listas de mapas;
  - no navegador (Chrome, Chromium ou Edge): o programa abre cada mapa sem erro, o editor abre e salva cada mapa sem
    perder nada, a página inicial e o projetor abrem, a conferência da campanha pega os enganos, e a foto 3D sai.
Termina com código 1 se algum teste falhar.
"""
import hashlib, json, os, random, shutil, struct, subprocess, sys, tempfile, time, zlib

AQUI = os.path.dirname(os.path.abspath(__file__)); RAIZ = os.path.dirname(AQUI)
sys.path.insert(0, AQUI)
from imagem import ler_png, escrever_png, redimensionar, np as _np, _PIL   # noqa: E402

FERRAMENTAS = ['grade', 'previa', 'validar', 'foto', 'endireitar', 'comparar', 'apagar', 'quadricula', 'ampliar', 'espalhar',
               'relevo', 'folha', 'figuras', 'objeto', 'compor', 'validar_campanha', 'testar']
PURO = {'SEED_SEM_NUMPY': '1', 'SEED_SEM_PIL': '1'}
resultados = []


def ok(nome, detalhe=''):
    resultados.append(True); print(f'  ok     {nome}' + (f'  ({detalhe})' if detalhe else ''), flush=True)


def falha(nome, detalhe):
    resultados.append(False); print(f'  FALHA  {nome}: {detalhe}', flush=True)


def conferir(cond, nome, detalhe_ok='', detalhe_falha=''):
    (ok(nome, detalhe_ok) if cond else falha(nome, detalhe_falha or 'resultado inesperado'))


def rodar(ferr, *args, env=None, timeout=600):
    return subprocess.run([sys.executable, os.path.join(AQUI, ferr + '.py')] + [str(a) for a in args], cwd=RAIZ,
                          capture_output=True, text=True, encoding='utf-8', errors='replace', env={**os.environ, **(env or {})}, timeout=timeout)


def md5(arq): return hashlib.md5(open(arq, 'rb').read()).hexdigest()


# ───── Desenho das imagens de teste (só Python padrão) ─────
class Desenho:
    def __init__(self, w, h, cor):
        self.w, self.h = w, h; self.pix = bytearray(bytes(cor) * (w * h))
    def ret(self, x0, y0, x1, y1, cor):
        for y in range(max(0, y0), min(self.h, y1)): self.pix[(y * self.w + max(0, x0)) * 3:(y * self.w + min(self.w, x1)) * 3] = bytes(cor) * (min(self.w, x1) - max(0, x0))
    def elipse(self, cx, cy, rx, ry, cor):
        for y in range(max(0, cy - ry), min(self.h, cy + ry + 1)):
            t = 1 - ((y - cy) / ry) ** 2
            if t < 0: continue
            dx = int(rx * t ** 0.5); self.ret(cx - dx, y, cx + dx + 1, y + 1, cor)
    def degrade(self, c0, c1):
        for y in range(self.h):
            t = y / max(1, self.h - 1); c = tuple(int(a + (b - a) * t) for a, b in zip(c0, c1)); self.ret(0, y, self.w, y + 1, c)
    def ruido(self, forca, semente=1):
        r = random.Random(semente)
        for i in range(len(self.pix)): self.pix[i] = max(0, min(255, self.pix[i] + r.randint(-forca, forca)))
    def px(self, x, y): k = (y * self.w + x) * 3; return tuple(self.pix[k:k + 3])
    def gravar(self, arq): escrever_png(arq, self.w, self.h, self.pix)


def folha_predio(arq):
    """Quatro vistas numa fileira sobre cinza liso: frente (com chaminé), lateral, fundos e telhado; linha de chão sob as
    elevações. Devolve os retângulos esperados de cada vista (sem a linha de chão)."""
    d = Desenho(1500, 520, (128, 128, 128))
    def predio(x0, chamine_x):
        d.ret(x0, 160, x0 + 300, 450, (150, 90, 60)); d.ret(x0 + 20, 220, x0 + 60, 280, (40, 50, 70))   # parede e janela
        for k in range(0, 80): d.ret(x0 - 10 + k, 160 - k, x0 + 310 - k, 161 - k, (110, 40, 35))       # telhado (triângulo)
        d.ret(chamine_x, 70, chamine_x + 24, 160, (90, 90, 95)); d.ret(x0 - 30, 450, x0 + 330, 453, (20, 20, 20))
    predio(60, 300); predio(780, 820)                                   # frente e fundos
    d.ret(450, 160, 650, 450, (140, 85, 55)); d.ret(450, 110, 650, 160, (110, 40, 35)); d.ret(420, 450, 680, 453, (20, 20, 20))   # lateral
    d.ret(1160, 200, 1460, 400, (110, 40, 35)); d.ret(1420, 210, 1444, 234, (90, 90, 95))   # telhado visto de cima
    d.gravar(arq)
    # a lateral é mais baixa que a frente (sem chaminé): folha.py iguala as alturas de propósito, então ela começa em 70
    return {'frente': [50, 70, 370, 450], 'lado': [450, 70, 650, 450], 'fundos': [770, 70, 1090, 450], 'telhado': [1160, 200, 1460, 400]}


def folha_figuras(arq, n=3):
    """Figuras de contorno escuro sobre fundo claro em degradê (como uma prancha de personagem)."""
    d = Desenho(300 * n, 420, (235, 228, 220)); d.degrade((235, 228, 220), (205, 198, 192)); d.ruido(3)
    for i in range(n):
        cx = 150 + 300 * i; alt = 300 - 40 * (i % 2)
        d.elipse(cx, 380 - alt // 2, 62, alt // 2 - 30, (25, 20, 18)); d.elipse(cx, 380 - alt // 2, 56, alt // 2 - 36, (60 + 40 * i, 90, 140))   # corpo
        d.elipse(cx, 380 - alt + 34, 34, 34, (25, 20, 18)); d.elipse(cx, 380 - alt + 34, 29, 29, (220, 180, 150))                              # cabeça
        d.ret(cx - 40, 375, cx - 10, 392, (25, 20, 18)); d.ret(cx + 10, 375, cx + 40, 392, (25, 20, 18))                                       # pés
    d.gravar(arq)


def folha_objeto(arq):
    """Objeto 2 x 2 (frente, lateral com a frente à esquerda, fundos, de cima) sobre cinza, com linha de chão larga sob as
    elevações encostada nas rodas, e rótulos embaixo."""
    d = Desenho(1200, 760, (128, 128, 128))
    def rodas(xs, y): [d.elipse(x, y, 26, 26, (20, 20, 22)) for x in xs]
    d.ret(80, 150, 330, 290, (60, 70, 90)); rodas([110, 300], 300); d.ret(40, 326, 370, 330, (25, 25, 25))           # frente
    d.ret(500, 120, 1000, 290, (60, 70, 90)); d.ret(560, 130, 760, 190, (150, 190, 220)); rodas([580, 920], 300); d.ret(460, 326, 1040, 330, (25, 25, 25))   # lateral
    d.ret(80, 500, 330, 640, (60, 70, 90)); rodas([110, 300], 650); d.ret(40, 676, 370, 680, (25, 25, 25))            # fundos
    d.ret(500, 470, 1000, 720, (60, 70, 90)); d.ret(620, 500, 760, 690, (150, 190, 220))                              # de cima
    d.ret(160, 350, 250, 362, (30, 30, 30)); d.ret(690, 350, 820, 362, (30, 30, 30)); d.ret(160, 700, 250, 712, (30, 30, 30))   # rótulos
    d.gravar(arq)
    return {'lado_larg': 500}


# ───── PNG de todos os tipos (gravador próprio, com filtros sorteados) ─────
def png_de_teste(arq, w, h, cor, bits, linhas_vals, plte=b'', trns=b'', entrel=False, semente=7):
    r = random.Random(semente); canais = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[cor]
    def empacota(vals):
        if bits == 16: return b''.join(struct.pack('>H', v) for v in vals)
        if bits == 8: return bytes(vals)
        por = 8 // bits; out = bytearray((len(vals) + por - 1) // por)
        for k, v in enumerate(vals): out[k // por] |= v << (8 - bits * (k % por + 1))
        return bytes(out)
    def filtra(linhas):
        bpp = max(1, canais * bits // 8); ant = bytes(len(linhas[0])); dados = bytearray()
        for lin in linhas:
            f = r.randrange(5); o = bytearray(len(lin))
            for k in range(len(lin)):
                a = lin[k - bpp] if k >= bpp else 0; b = ant[k]; c = ant[k - bpp] if k >= bpp else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                p = [0, a, b, (a + b) >> 1, a if pa <= pb and pa <= pc else b if pb <= pc else c][f]
                o[k] = (lin[k] - p) & 255
            dados += bytes([f]) + o; ant = lin
        return dados
    if entrel:
        dados = bytearray()
        for x0, y0, dx, dy in ((0, 0, 8, 8), (4, 0, 8, 8), (0, 4, 4, 8), (2, 0, 4, 4), (0, 2, 2, 4), (1, 0, 2, 2), (0, 1, 1, 2)):
            pw, ph = (w - x0 + dx - 1) // dx, (h - y0 + dy - 1) // dy
            if pw <= 0 or ph <= 0: continue
            dados += filtra([empacota([v for x in range(x0, w, dx) for v in linhas_vals[y][x * canais:(x + 1) * canais]]) for y in range(y0, h, dy)])
    else: dados = filtra([empacota(l) for l in linhas_vals])
    ch = lambda t, d_: struct.pack('>I', len(d_)) + t + d_ + struct.pack('>I', zlib.crc32(t + d_) & 0xffffffff)
    open(arq, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, bits, cor, 0, 0, int(entrel))) + (ch(b'PLTE', plte) if plte else b'')
                          + (ch(b'tRNS', trns) if trns else b'') + ch(b'IDAT', zlib.compress(bytes(dados))) + ch(b'IEND', b''))


def esperado_png(cor, bits, vals, plte, trns):
    """O que ler_png deve devolver (RGB, transparência) para um pixel com esses valores."""
    if cor == 3:
        return tuple(plte[vals[0] * 3:vals[0] * 3 + 3]), (trns[vals[0]] if vals[0] < len(trns) else 255)
    m = (lambda v: v >> 8) if bits == 16 else (lambda v: v * (255 // ((1 << bits) - 1))) if bits < 8 else (lambda v: v)
    if cor in (0, 4):
        g = m(vals[0]); a = m(vals[1]) if cor == 4 else (0 if trns and vals[0] == struct.unpack('>H', trns)[0] else 255)
        return (g, g, g), a
    rgb = tuple(m(v) for v in vals[:3]); a = m(vals[3]) if cor == 6 else (0 if trns and tuple(vals[:3]) == struct.unpack('>HHH', trns) else 255)
    return rgb, a


def teste_png(pasta):
    """Roda dentro de um processo (para testar com e sem Pillow): grava PNGs de todos os tipos e confere a leitura."""
    r = random.Random(3); casos = 0; erros = []
    for cor, bits in ((0, 1), (0, 2), (0, 4), (0, 8), (0, 16), (2, 8), (2, 16), (3, 1), (3, 2), (3, 4), (3, 8), (4, 8), (4, 16), (6, 8), (6, 16)):
        for entrel in (False, True):
            for w, h in ((13, 7), (1, 1), (9, 3)):
                canais = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[cor]; maxv = (1 << bits) - 1
                plte = bytes(r.randrange(256) for _ in range(3 * (maxv + 1))) if cor == 3 else b''
                vals = [[r.randrange(maxv + 1) for _ in range(w * canais)] for _ in range(h)]
                trns = b''
                if cor == 3: trns = bytes(r.randrange(256) for _ in range(min(maxv + 1, 5)))
                elif cor == 0 and bits == 8: trns = struct.pack('>H', vals[0][0])
                elif cor == 2 and bits == 8: trns = struct.pack('>HHH', *vals[0][0:3])
                arq = os.path.join(pasta, f'png_{cor}_{bits}_{int(entrel)}_{w}.png')
                png_de_teste(arq, w, h, cor, bits, vals, plte, trns, entrel)
                W, H, rgb, al = ler_png(arq, com_alfa=True); casos += 1
                for y in range(h):
                    for x in range(w):
                        e_rgb, e_a = esperado_png(cor, bits, vals[y][x * canais:(x + 1) * canais], plte, trns)
                        q = y * w + x
                        if tuple(rgb[q * 3:q * 3 + 3]) != e_rgb or al[q] != e_a:
                            erros.append(f'cor {cor}, {bits} bits{", entrelaçado" if entrel else ""}, {w}x{h}: pixel ({x},{y}) lido {tuple(rgb[q*3:q*3+3])}/{al[q]}, esperado {e_rgb}/{e_a}'); break
                    else: continue
                    break
    print(json.dumps({'casos': casos, 'erros': erros[:5]}))


# ───── Testes ─────
def t_compilar():
    import py_compile
    falhas = []
    for f in sorted(os.listdir(AQUI)):
        if f.endswith('.py'):
            try: py_compile.compile(os.path.join(AQUI, f), doraise=True)
            except py_compile.PyCompileError as e: falhas.append(f'{f}: {e.msg}')
    shutil.rmtree(os.path.join(AQUI, '__pycache__'), ignore_errors=True)
    conferir(not falhas, 'as ferramentas compilam', '', '; '.join(falhas))
    sem = [t for t in FERRAMENTAS if (lambda r: r.returncode != 0 or len(r.stdout.splitlines()) < 3)(rodar(t, '--help', timeout=60))]
    conferir(not sem, 'todas respondem a --help', f'{len(FERRAMENTAS)} ferramentas', 'sem ajuda: ' + ', '.join(sem))


def t_ambiente(pasta):
    """O que costuma quebrar fora deste computador: outra codificação do sistema, outra pasta, o registro do Windows."""
    mapa = os.path.join(RAIZ, 'mapas', json.load(open(os.path.join(RAIZ, 'mapas', 'indice.json'), encoding='utf-8'))['mapas'][0])
    # No Windows, a saída redirecionada (para um arquivo ou para um assistente de IA) usa a codificação antiga do sistema;
    # aqui ela é simulada com LC_ALL. Roda também de outra pasta, com o caminho completo do mapa.
    env = {k: v for k, v in os.environ.items() if k not in ('PYTHONIOENCODING', 'PYTHONUTF8', 'LANG', 'LC_CTYPE')}
    env['LC_ALL'] = 'en_US.ISO8859-1'
    r = subprocess.run([sys.executable, os.path.join(AQUI, 'validar.py'), mapa], cwd=pasta, capture_output=True, env=env, timeout=120)
    conferir(r.returncode == 0 and 'móveis'.encode('utf-8') in r.stdout, 'validar.py roda de outra pasta e a saída sai em UTF-8 com o sistema em outra codificação',
             '', (r.stdout + r.stderr)[-200:].decode('utf-8', 'replace'))
    r = subprocess.run([sys.executable, os.path.join(RAIZ, 'servidor.py'), '--help'], capture_output=True, timeout=30)
    conferir(r.returncode == 0 and b'127.0.0.1' in r.stdout, 'servidor.py responde a --help', '', r.stderr[-200:].decode('utf-8', 'replace'))
    codigo = (f'import sys, mimetypes; sys.path.insert(0, {RAIZ!r}); mimetypes.init(); mimetypes.add_type("text/plain", ".js"); '
              'mimetypes.add_type("text/plain", ".json"); import servidor; h = object.__new__(servidor.Servidor); '
              'print(h.guess_type("src/main.js"), h.guess_type("mapas/indice.json"), sep="|")')
    r = subprocess.run([sys.executable, '-c', codigo], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
    tipos = r.stdout.strip().split('|')
    conferir(len(tipos) == 2 and tipos[0].startswith('text/javascript') and tipos[1].startswith('application/json'),
             'o servidor manda .js como JavaScript mesmo com o registro do Windows errado', '', (r.stdout + r.stderr)[-200:])


def t_png(pasta):
    for modo, env in (('com Pillow', {}), ('Python puro', PURO)) if _PIL else (('Python puro', PURO),):
        r = subprocess.run([sys.executable, __file__, '--interno-png', pasta], capture_output=True, text=True, encoding='utf-8', errors='replace', env={**os.environ, **env}, timeout=300)
        try: res = json.loads(r.stdout.strip().splitlines()[-1])
        except Exception: falha(f'leitura de PNG ({modo})', r.stderr[-300:] or 'sem resultado'); continue
        conferir(not res['erros'], f'leitura de PNG, todos os tipos ({modo})', f'{res["casos"]} arquivos', '; '.join(res['erros']))
    arq = os.path.join(pasta, 'falso.png'); open(arq, 'wb').write(b'\xff\xd8\xff\xe0' + b'0' * 100)
    r = subprocess.run([sys.executable, '-c', f'import sys; sys.path.insert(0, {AQUI!r}); from imagem import ler_png; ler_png({arq!r})'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    conferir(r.returncode != 0 and 'JPEG' in (r.stderr + r.stdout), 'JPEG com extensão .png é recusado com explicação', '', r.stderr[-200:])


def t_folha(pasta):
    arq = os.path.join(pasta, 'predio.png'); esp = folha_predio(arq)
    r = rodar('folha', arq, '--alinhar', os.path.join(pasta, 'alinhar.png'))
    achou = {}
    for l in r.stdout.splitlines():
        l = l.strip()
        for k in esp:
            if l.startswith(k + ':'): achou[k] = json.loads(l.split(':', 1)[1].split(']')[0] + ']')
    difs = {k: max(abs(a - b) for a, b in zip(achou[k], esp[k])) for k in esp if k in achou}
    conferir(len(achou) == 4 and max(difs.values()) <= 6, 'folha.py acha as quatro vistas e tira a linha de chão', 'diferença máxima ' + str(max(difs.values(), default='-')) + ' px',
             f'achou {achou} (esperado {esp}); saída: {r.stdout[-300:]} {r.stderr[-300:]}')
    conferir(os.path.exists(os.path.join(pasta, 'alinhar.png')) and r.returncode == 0, 'folha.py --alinhar grava a conferência', '', r.stderr[-300:])
    r = rodar('folha', arq, '--pecas')
    conferir('4 peças' in r.stdout, 'folha.py --pecas lista as peças soltas', '', r.stdout[-200:])
    return arq


def t_figuras(pasta):
    arq = os.path.join(pasta, 'figuras.png'); folha_figuras(arq, 3); saida = os.path.join(pasta, 'figuras_saida')
    r = rodar('figuras', arq, '--nome', 'boneco', '--poses', 'a,b,c', '--saida', saida, '--conferir', os.path.join(pasta, 'fig_conf.png'))
    conferir('3 figuras' in r.stdout, 'figuras.py acha as três figuras', '', r.stdout[-300:] + r.stderr[-300:])
    pngs = sorted(os.listdir(saida)) if os.path.isdir(saida) else []
    bom = len(pngs) == 3
    for p in pngs:
        w, h, rgb, al = ler_png(os.path.join(saida, p), com_alfa=True)
        bom &= al[0] == 0 and al[w * h - 1] == 0 and al[(h // 2) * w + w // 2] == 255 and 100 < h < 320
    conferir(bom, 'figuras.py grava cada pose com fundo transparente', ', '.join(pngs), f'arquivos: {pngs}')
    conferir('quadros: {' in r.stdout and "boneco_a.png" in r.stdout, 'figuras.py imprime o trecho para a campanha')
    r = rodar('figuras', arq, '--grade', '3x1')
    conferir('3 figuras' in r.stdout, 'figuras.py --grade separa por casa', '', r.stdout[-200:])
    return arq


def t_objeto(pasta):
    arq = os.path.join(pasta, 'objeto.png'); esp = folha_objeto(arq); saida = os.path.join(pasta, 'objeto_saida')
    r = rodar('objeto', arq, '--nome', 'carrinho', '--comprimento', '4', '--saida', saida, '--conferir', os.path.join(pasta, 'obj_conf.png'))
    linha = next((l for l in r.stdout.splitlines() if 'volume:' in l), '')
    try:
        rets = {k: json.loads(linha.split(k + ': ')[1].split(']')[0] + ']') for k in ('F', 'S', 'B', 'T')}
        lado = next(l for l in r.stdout.splitlines() if l.strip().startswith('lado:'))
        larg_lado = int(lado.split(':')[1].split('x')[0])
    except Exception:
        falha('objeto.py monta o atlas', r.stdout[-400:] + r.stderr[-300:]); return arq
    conferir(abs(larg_lado - esp['lado_larg']) <= 4, 'objeto.py tira a linha de chão (a lateral fica com a largura do objeto)', f'{larg_lado} px', f'lateral com {larg_lado} px; esperado {esp["lado_larg"]}')
    F, S, T = rets['F'], rets['S'], rets['T']
    conferir(F[3] - F[1] == S[3] - S[1] and S[2] - S[0] == T[2] - T[0] and os.path.exists(os.path.join(saida, 'carrinho_atlas.png')),
             'objeto.py monta o atlas (mesma altura nas vistas, vista de cima com o comprimento da lateral)', '', f'retângulos {rets}')
    return arq


def t_outras(pasta):
    # compor: o pedaço vai para onde --em manda
    d = Desenho(300, 200, (70, 120, 50)); d.ret(100, 60, 200, 140, (200, 30, 30)); d.ret(140, 90, 160, 110, (10, 10, 200)); pint = os.path.join(pasta, 'pintura.png'); d.gravar(pint)
    out = os.path.join(pasta, 'composto.png')
    r = rodar('compor', out, '--tamanho', 800, 600, '--fundo', pint, 0, 0, 80, 50, '--peca', pint, 90, 50, 210, 150, '--em', 500, 300, '--k', 1, '--borda', 10, '--trilha', 50, 550, 300, 400, 440, 300)
    if r.returncode: falha('compor.py', r.stderr[-300:])
    else:
        w, h, rgb = ler_png(out); centro = tuple(rgb[(300 * w + 500) * 3:(300 * w + 500) * 3 + 3]); canto = tuple(rgb[(590 * w + 790) * 3:(590 * w + 790) * 3 + 3])
        conferir((w, h) == (800, 600) and centro == (10, 10, 200) and canto == (70, 120, 50), 'compor.py põe o pedaço no lugar e cobre o resto com o fundo', '', f'tamanho {w}x{h}, centro {centro}, canto {canto}')
    # quadricula: a grade sai (a suave, como a das IAs, com o padrão; a escura, com --maximo)
    for nome, cor_linha, extra in (('suave', (58, 106, 40), []), ('escura', (40, 75, 30), ['--maximo', 150])):
        d = Desenho(400, 400, (70, 120, 50)); d.ruido(6, 2)
        for k in range(0, 400, 40): d.ret(k, 0, k + 2, 400, cor_linha); d.ret(0, k, 400, k + 2, cor_linha)
        q = os.path.join(pasta, f'quadricula_{nome}.png'); d.gravar(q); q2 = os.path.join(pasta, f'quadricula_{nome}_limpa.png')
        r = rodar('quadricula', q, q2, *extra)
        if r.returncode: falha(f'quadricula.py (grade {nome})', r.stderr[-300:]); continue
        w, h, rgb = ler_png(q2); linhas = [rgb[(y * w + 220) * 3 + 1] for y in range(20, 380) if y % 40 in (0, 1)]
        m = sum(linhas) / len(linhas)
        conferir(m > 112, f'quadricula.py tira a grade {nome}' + (' (--maximo 150)' if extra else ''), f'verde nas linhas: {m:.0f} (era {cor_linha[1]}; o chão é 120)', f'as linhas continuam escuras ({m:.0f})')
    # ampliar: o tamanho novo e a pintura no lugar
    a2 = os.path.join(pasta, 'ampliado.png'); r = rodar('ampliar', pint, a2, '--tamanho', 500, 400, '--amostra', 0, 0, 80, 50)
    if r.returncode: falha('ampliar.py', r.stderr[-300:])
    else:
        w, h, rgb = ler_png(a2); c = tuple(rgb[(200 * w + 250) * 3:(200 * w + 250) * 3 + 3])
        conferir((w, h) == (500, 400) and c == (10, 10, 200), 'ampliar.py aumenta o chão e mantém a pintura no meio', '', f'{w}x{h}, centro {c}')
    # apagar: copia o vizinho por cima
    ap = os.path.join(pasta, 'apagado.png'); r = rodar('apagar', pint, ap, '--area', 100, 60, 200, 140, '--de', 0, -60)
    if r.returncode: falha('apagar.py', r.stderr[-300:])
    else:
        w, h, rgb = ler_png(ap); c = tuple(rgb[(100 * w + 150) * 3:(100 * w + 150) * 3 + 3])
        conferir(c == (70, 120, 50), 'apagar.py cobre a área com o vizinho', '', f'centro ficou {c}')
    # endireitar: cantos da própria imagem devolvem a mesma imagem
    en = os.path.join(pasta, 'endireitado.png'); r = rodar('endireitar', pint, en, '--cantos', 0, 0, 300, 0, 300, 200, 0, 200)
    if r.returncode: falha('endireitar.py', r.stderr[-300:])
    else:
        w, h, rgb = ler_png(en); w0, h0, rgb0 = ler_png(pint)
        dif = sum(abs(a - b) for a, b in zip(rgb, rgb0)) / len(rgb0) if (w, h) == (w0, h0) else 999
        conferir(dif < 3, 'endireitar.py não muda uma planta que já está reta', f'diferença média {dif:.2f}', f'tamanho {w}x{h}, diferença {dif}')
    # grade, comparar, relevo
    g = os.path.join(pasta, 'grade.png'); r = rodar('grade', pint, g, '--recorte', 50, 50, 100, 80, '--zoom', 2)
    conferir(r.returncode == 0 and os.path.exists(g), 'grade.py grava o recorte ampliado', '', r.stderr[-200:])
    r = rodar('grade', pint, '--cor', 150, 100, '--cor', 120, 70)
    conferir(r.returncode == 0 and '#0a0ac8' in r.stdout and '#c81e1e' in r.stdout, 'grade.py --cor lê a cor dos pontos', '', r.stdout[-200:] + r.stderr[-200:])
    c = os.path.join(pasta, 'comparado.png'); r = rodar('comparar', pint, ap, c)
    conferir(r.returncode == 0 and os.path.exists(c), 'comparar.py grava as faixas', '', r.stderr[-200:])
    # comparar mede o alinhamento: a "noite" escura e menor bate; a que tem metade do desenho deslocada, não
    sorteio = random.Random(5); pecas = [(sorteio.randrange(0, 580), sorteio.randrange(0, 380), sorteio.randrange(10, 50), sorteio.randrange(8, 36),
                                          tuple(sorteio.randrange(40, 230) for _ in range(3))) for _ in range(110)]
    def cena(desloc, escuro):
        d = Desenho(600, 400, (120, 110, 90))
        for x, y, w, h, cor in pecas: d.ret(x + (desloc if x < 300 else 0), y, x + w + (desloc if x < 300 else 0), y + h, cor)
        if escuro: d.pix = bytearray(int(v * f) for i, v in enumerate(d.pix) for f in ((0.35, 0.4, 0.6)[i % 3],))
        return d
    dia = os.path.join(pasta, 'cena_dia.png'); cena(0, False).gravar(dia)
    for nome, desloc, esperado in (('a de noite, mais escura e menor, bate', 0, 'batem'), ('a de noite com metade do desenho 14 px para o lado não bate', 14, 'NÃO batem')):
        d = cena(desloc, True); noite = os.path.join(pasta, f'cena_noite_{desloc}.png')
        if not desloc:
            rgb, _ = redimensionar(600, d.pix, None, (0, 0, 600, 400), 480, 320); escrever_png(noite, 480, 320, rgb)
        else: d.gravar(noite)
        r = rodar('comparar', dia, noite, os.path.join(pasta, 'cena_c.png'))
        ultima = (r.stdout.strip().splitlines() or [''])[-1]
        conferir(r.returncode == 0 and esperado in ultima and not (esperado == 'batem' and 'NÃO' in ultima), f'comparar.py: {nome}', ultima[:90], ultima[:200] or r.stderr[-200:])
    rv = os.path.join(pasta, 'relevo.json'); r = rodar('relevo', pint, rv, '--area', 0, 0, 300, 200, '--escuro', 60, '--altura', 2)
    try: blocos = json.load(open(rv, encoding='utf-8'))
    except Exception: blocos = None
    conferir(r.returncode == 0 and isinstance(blocos, list) and len(blocos) > 0, 'relevo.py ergue o que tem a cor pedida', f'{len(blocos or [])} blocos', r.stderr[-200:] or str(blocos)[:100])


def t_mapas(pasta, todos):
    ex = json.load(open(os.path.join(RAIZ, 'mapas', 'indice.json'), encoding='utf-8'))['mapas']
    for arq in ex:
        r = rodar('validar', os.path.join('mapas', arq))
        conferir(r.returncode == 0, f'validar.py: exemplo {arq} sem erro', '', r.stdout[-300:])
    navio = os.path.join(RAIZ, 'mapas', ex[0])
    r = rodar('previa', navio, os.path.join(pasta, 'previa.png'), '--contorno')
    conferir(r.returncode == 0 and os.path.exists(os.path.join(pasta, 'previa.png')), 'previa.py desenha um exemplo', '', r.stderr[-200:])
    r = rodar('espalhar', navio, os.path.join(pasta, 'mata.json'), '--mata', '--passo', 40)
    conferir(r.returncode == 0 and isinstance(json.load(open(os.path.join(pasta, 'mata.json'), encoding='utf-8')), (list, dict)), 'espalhar.py roda num exemplo', '', r.stderr[-200:])
    # um mapa com erros de propósito: o validador tem de pegar cada um
    d = json.load(open(navio, encoding='utf-8'))
    d.update({'id': 'teste_quebrado', 'imagem': 'assets/nao_existe.png', 'hora': 'meio-dia', 'luar': 3, 'chegada': {'de': [-9000, 0], 'para': [0, 0]}, 'criaturas': 'lobo',
              'desafios': [{'nome': 'Ponte'}], 'portas': [{'p': [10, 10, 60, 10], 'textura': {'imagem': 'assets/nao.png'}, 'alturaFolha': 30}]})
    q = os.path.join(pasta, 'teste_quebrado.json'); json.dump(d, open(q, 'w', encoding='utf-8'))
    r = rodar('validar', q); s = r.stdout
    esperados = ['"imagem": arquivo não encontrado', '"hora" deve ser', '"luar" deve ser', 'a mais de 2 m fora da imagem', '"criaturas" deve ser uma lista',
                 'nenhuma peça tem "desafio"', '"textura.imagem" não encontrada', '"alturaFolha" é a altura']
    faltam = [e for e in esperados if e not in s]
    conferir(r.returncode == 1 and not faltam, 'validar.py pega os erros de um mapa quebrado', f'{len(esperados)} erros plantados', 'não pegou: ' + ' | '.join(faltam))
    # cercado de grade: fechado (ou com fresta de 0,3 m) avisa; com vão de 1 m, não
    d = json.load(open(navio, encoding='utf-8')); E = d['escala']; x0, y0, x1, y1 = 40, 40, 40 + round(6 / E), 40 + round(6 / E)
    for nome, vao, avisa in (('fechado', 0, True), ('com fresta de 0,3 m', 0.3, True), ('com vão de 1 m', 1.0, False)):
        meio = (y0 + y1) / 2; v = vao / E / 2
        d['grades'] = [[x0, y0, x1, y0], [x1, y0, x1, y1], [x1, y1, x0, y1], [x0, y1, x0, meio + v]] + ([[x0, meio - v, x0, y0]] if vao else [[x0, meio, x0, y0]])
        d['id'] = 'teste_cercado'; q = os.path.join(pasta, 'teste_cercado.json'); json.dump(d, open(q, 'w', encoding='utf-8'))
        r = rodar('validar', q); tem = 'área cercada perto de' in r.stdout
        conferir(tem == avisa, f'validar.py: cercado de grade {nome} ' + ('avisa' if avisa else 'não avisa'), '', r.stdout[-300:])
    r = rodar('validar', '--tudo')
    listas = r.stdout.split('\n')[0]
    conferir('sem problemas' in listas or ('erros' in listas and ' 0 erros' in listas), 'validar.py --tudo: as listas de mapas estão certas', '', r.stdout[:400])
    if todos:
        import re
        com_erro = [m.group(1) for m in re.finditer(r'^(\S+\.json): ([1-9]\d*) erros', r.stdout, re.M)]
        conferir(not com_erro, 'validar.py --tudo: seus mapas sem erro', '', 'com erro: ' + ', '.join(com_erro))


def t_equivalencia(pasta, folha, figs, obj):
    """Com numpy ou Pillow, o resultado tem de ser o mesmo do Python puro."""
    if not _np and not _PIL: return
    casos = [('folha', [folha, '--alinhar', '{o}/al.png'], ['al.png']), ('figuras', [figs, '--nome', 'f', '--vaos', '25', '--saida', '{o}'], None),
             ('objeto', [obj, '--nome', 'o', '--comprimento', '4', '--saida', '{o}'], None)]
    for ferr, args, nomes in casos:
        hashes = []
        for env in ({}, PURO):
            o = tempfile.mkdtemp(dir=pasta); r = rodar(ferr, *[a.replace('{o}', o) for a in args], env=env)
            hashes.append((r.returncode, sorted((f, md5(os.path.join(o, f))) for f in os.listdir(o)), [l for l in r.stdout.splitlines() if pasta not in l]))
        conferir(hashes[0] == hashes[1], f'{ferr}.py: com numpy/Pillow dá o mesmo que Python puro', '', 'resultados diferentes')


def t_navegador(todos, rapido):
    if rapido: print('  (sem navegador: --rapido)'); return
    from navegador import achar_chrome, ServidorLocal, ler_pagina
    chrome = achar_chrome(obrigatorio=False)
    if not chrome: print('  (sem Chrome, Chromium nem Edge: os testes no navegador ficaram de fora)'); return
    with ServidorLocal(5173, avisar=False) as srv:
        t0 = time.time(); texto = ler_pagina(srv.base + '/ferramentas/teste_navegador.html' + ('?todos=1' if todos else ''), chrome, espera=1200, orcamento=900000)
        if texto is None: falha('página de testes no navegador', 'não respondeu'); return
        for l in texto.splitlines():
            if l.startswith('OK'): ok(l[4:].strip())
            elif l.startswith('FALHA'): falha(l[5:].split(' — ')[0].strip(), l.split(' — ', 1)[1] if ' — ' in l else '')
        if 'FIM' not in texto: falha('página de testes no navegador', 'parou antes do fim')
    out = os.path.join(tempfile.gettempdir(), '3seed_teste_foto.png')
    r = rodar('foto', 'mapas/' + json.load(open(os.path.join(RAIZ, 'mapas', 'indice.json'), encoding='utf-8'))['mapas'][0], out, '--camera', 1, timeout=400)
    if r.returncode or not os.path.exists(out): falha('foto.py tira a foto 3D', r.stdout[-200:] + r.stderr[-200:]); return
    w, h, rgb = ler_png(out); amostra = rgb[::997]; media = sum(amostra) / len(amostra); var = sum((v - media) ** 2 for v in amostra) / len(amostra)
    conferir(var > 200, 'foto.py tira a foto 3D (e ela não sai vazia)', f'{w}x{h}', f'a foto parece vazia (variação {var:.0f})')
    os.remove(out)


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if a and a[0] == '--interno-png': teste_png(a[1]); return
    rapido, todos = '--rapido' in a, '--todos' in a
    pasta = tempfile.mkdtemp(prefix='3seed-teste-'); t0 = time.time()
    print(f'Testando (imagens de teste em {pasta}); numpy: {"sim" if _np else "não"}, Pillow: {"sim" if _PIL else "não"}')
    try:
        print('Ferramentas:'); t_compilar(); t_ambiente(pasta); t_png(pasta)
        print('Imagens de teste:'); folha = t_folha(pasta); figs = t_figuras(pasta); obj = t_objeto(pasta); t_outras(pasta); t_equivalencia(pasta, folha, figs, obj)
        print('Mapas:'); t_mapas(pasta, todos)
        print('Navegador:'); t_navegador(todos, rapido)
    finally:
        if '--manter' not in a: shutil.rmtree(pasta, ignore_errors=True)
        shutil.rmtree(os.path.join(AQUI, '__pycache__'), ignore_errors=True)
    n, f = len(resultados), resultados.count(False)
    print(f'\n{n} testes em {time.time() - t0:.0f} s: ' + ('todos passaram.' if not f else f'{f} FALHARAM.'))
    sys.exit(1 if f else 0)


if __name__ == '__main__':
    main()
