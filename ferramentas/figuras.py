#!/usr/bin/env python3
"""Recorta as figuras de uma folha de personagem ou criatura: uma PNG por pose, com fundo transparente e justa no desenho.

Uso:
  python3 ferramentas/figuras.py folha.png --nome cervo --conferir rascunho/c.png          # só mostra o que achou
  python3 ferramentas/figuras.py folha.png --nome cervo --saida assets/personagens --poses parado,pastando,frente,costas
  python3 ferramentas/figuras.py prancha.png --nome explorador --grade 3x2 --poses parado,correndo,agachado,procurando,luta,costas --saida assets/personagens

O fundo pode ser liso, em degradê, com brilho em volta das figuras ou papel claro: a ferramenta o tira crescendo a
partir da borda da imagem por onde a cor muda devagar; o contorno do desenho, que muda de repente, segura o
crescimento. Cada figura sai com o nome <nome>_<pose>.png, na ordem de leitura (de cima para baixo, da esquerda para a
direita). No fim, imprime o trecho "quadros" e "poses" para colar na criatura, em src/campanha.js (veja o README).

--nome N         Começo do nome dos arquivos (padrão: o nome da folha).
--saida PASTA    Onde gravar as PNGs. Sem ela, nada é gravado (use com --conferir para ver antes).
--poses a,b,c    Nome de cada figura, na ordem de leitura. Sem ela: pose1, pose2...
--grade CxL      A folha é uma grade de C colunas e L linhas, uma figura por casa (pranchas de seis poses: 3x2). Cada
                 casa fica só com o maior desenho dela; o que invade da casa vizinha sai.
--conferir ARQ   Grava a folha com o fundo tirado pintado de rosa e cada figura numerada. Olhe antes de gravar.
--limite N       Quanto a cor pode mudar de um pixel para o vizinho e ainda ser fundo (padrão 7). Se sobrar fundo em
                 volta das figuras, aumente (9, 12); se o fundo comer pedaços do desenho, diminua (5).
--piso N         Pixels mais escuros que N (0 a 255) nunca são fundo: protege contornos pretos quando o fundo é escuro.
--vaos N         Também deixa transparentes os vãos de fundo presos no desenho (entre as pernas, dentro de um braço
                 dobrado) que tenham cor a menos de N da cor do fundo (use 20 a 30). Sem a opção, eles ficam.
--minimo N       Ignora manchas com menos de N pixels de área (padrão 400): poeira, rótulos pequenos.
--virar a,b      Desvira essas poses na horizontal. O programa espera que as vistas de lado olhem para a DIREITA.
--altura N       Redimensiona para a primeira figura ter N px de altura (as outras na mesma proporção). Serve para
                 igualar figuras que vêm de folhas diferentes (as diagonais numa folha, as outras poses em outra).

Confira sempre com --conferir: sombras no chão e brilhos fortes podem ficar presos na figura, e um fundo da mesma
cor do desenho pode comer um pedaço. Remende a PNG num editor de imagem se precisar.
"""
import json, os, sys
from operator import add, sub
from imagem import ler_png, escrever_png, redimensionar, espelhar_h, Tela, manchas, np
from grade import opcao


def tirar_fundo(W, H, rgb, limite=7, piso=0):
    """Fundo ligado à borda, crescendo por onde a variação local da cor (já suavizada) é pequena. Devolve (fundo, lum):
    fundo[i] = 1 no fundo. Com numpy, as mesmas contas em bloco."""
    if np is not None: return _tirar_fundo_np(W, H, rgb, limite, piso)
    n = W * H
    lum = bytearray(map(lambda r, g, b: (r * 3 + g * 6 + b) // 10, rgb[0::3], rgb[1::3], rgb[2::3]))
    # suaviza em 3 x 3 (soma das linhas vizinhas e depois das colunas vizinhas) para o ruído do papel não parecer contorno
    linhas = []
    for y in range(H):
        l = list(lum[y * W:(y + 1) * W]); esq = l[:1] + l[:-1]; dir_ = l[1:] + l[-1:]
        linhas.append(list(map(add, map(add, esq, l), dir_)))
    sua = []
    for y in range(H):
        sua.append(list(map(add, map(add, linhas[max(0, y - 1)], linhas[y]), linhas[min(H - 1, y + 1)])))
    # variação: |vizinho da direita - da esquerda| + |de baixo - de cima| (zero na borda da imagem)
    grad = []
    for y in range(H):
        s_ = sua[y]
        gx = [0] + list(map(abs, map(sub, s_[2:], s_[:-2]))) + [0] if W > 2 else [0] * W
        gy = list(map(abs, map(sub, sua[y + 1], sua[y - 1]))) if 0 < y < H - 1 else [0] * W
        grad.extend(map(add, gx, gy))
    lim9 = limite * 9 * 2
    fundo = bytearray(n); pilha = []; rejeitados = set()
    for x in range(W): pilha += [x, (H - 1) * W + x]
    for y in range(H): pilha += [y * W, y * W + W - 1]
    while pilha:
        i = pilha.pop()
        if fundo[i]: continue
        if (piso and lum[i] < piso) or grad[i] > lim9: rejeitados.add(i); continue
        fundo[i] = 1; x = i % W
        if x > 0 and not fundo[i - 1]: pilha.append(i - 1)
        if x < W - 1 and not fundo[i + 1]: pilha.append(i + 1)
        if i >= W and not fundo[i - W]: pilha.append(i - W)
        if i < n - W and not fundo[i + W]: pilha.append(i + W)
    # A borda de 1 a 2 px em volta da figura (onde a variação já subiu) ainda é fundo misturado: sai também, se tiver a
    # cor do fundo vizinho. Só os pixels que o crescimento recusou podem estar encostados no fundo.
    candidatos = {i for i in rejeitados if not fundo[i]}
    for _ in range(2):
        borda = []
        for i in candidatos:
            x = i % W
            if not (W <= i < n - W and 0 < x < W - 1): continue
            k = i * 3
            for j in (i - 1, i + 1, i - W, i + W):
                if fundo[j] and max(abs(rgb[k] - rgb[j * 3]), abs(rgb[k + 1] - rgb[j * 3 + 1]), abs(rgb[k + 2] - rgb[j * 3 + 2])) <= limite * 2:
                    borda.append(i); break
        for i in borda: fundo[i] = 1
        candidatos = {j for i in borda for j in (i - 1, i + 1, i - W, i + W) if 0 <= j < n and not fundo[j]} | (candidatos - set(borda))
    return fundo, lum


def _tirar_fundo_np(W, H, rgb, limite, piso):
    """O mesmo que tirar_fundo, em blocos: suavização e variação por deslocamento, crescimento por trechos de linha e de
    coluna (cada passada liga trechos inteiros; repete até nada mudar)."""
    im = np.frombuffer(bytes(rgb), np.uint8).reshape(H, W, 3).astype(np.int32)
    lum = (im[..., 0] * 3 + im[..., 1] * 6 + im[..., 2]) // 10
    p = np.pad(lum, 1, mode='edge')
    lin = p[:, :-2] + p[:, 1:-1] + p[:, 2:]
    sua = lin[:-2] + lin[1:-1] + lin[2:]
    g = np.zeros((H, W), np.int64)
    if W > 2: g[:, 1:-1] += np.abs(sua[:, 2:] - sua[:, :-2])
    if H > 2: g[1:-1, :] += np.abs(sua[2:, :] - sua[:-2, :])
    passa = g <= limite * 9 * 2
    if piso: passa &= lum >= piso
    alcance = np.zeros((H, W), bool)
    alcance[0, :] = passa[0, :]; alcance[-1, :] = passa[-1, :]; alcance[:, 0] |= passa[:, 0]; alcance[:, -1] |= passa[:, -1]
    def varrer(p_, a_):   # numa passada, um trecho de "passa" numa linha fica todo alcançado se algum pixel dele já está
        h_, w_ = p_.shape; f = p_.ravel(); ini = f.copy(); ini[1:] &= ~f[:-1]; ini[::w_] = f[::w_]
        rot = np.cumsum(ini) * f; tem = np.zeros(rot.max() + 1, bool); tem[rot[a_.ravel()]] = True; tem[0] = False
        return tem[rot].reshape(h_, w_)
    while True:
        antes = int(alcance.sum())
        alcance = varrer(passa, alcance)
        alcance = varrer(passa.T.copy(), alcance.T.copy()).T
        if int(alcance.sum()) == antes: break
    fundo = alcance.copy()
    for _ in range(2):   # a mesma borda de 1 a 2 px do caminho puro
        perto = np.zeros((H, W), bool)
        for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):
            viz_f = np.zeros((H, W), bool); viz_c = np.zeros((H, W, 3), np.int32)
            ys, ye = max(0, -dy), H - max(0, dy); xs, xe = max(0, -dx), W - max(0, dx)
            viz_f[ys:ye, xs:xe] = fundo[ys + dy:ye + dy, xs + dx:xe + dx]; viz_c[ys:ye, xs:xe] = im[ys + dy:ye + dy, xs + dx:xe + dx]
            perto |= viz_f & (np.abs(im - viz_c).max(axis=2) <= limite * 2)
        perto[0, :] = perto[-1, :] = False; perto[:, 0] = perto[:, -1] = False
        fundo = fundo | (perto & ~fundo)
    return bytearray(fundo.astype(np.uint8).tobytes()), bytearray(lum.astype(np.uint8).tobytes())


def tirar_vaos(W, H, rgb, fundo, tol):
    """Vãos de fundo presos no desenho: manchas não ligadas à borda com a cor do fundo (a mediana do fundo achado)."""
    amostra = [i for i in range(0, W * H, 53) if fundo[i]]
    if not amostra: return 0
    ref = [sorted(rgb[i * 3 + c] for i in amostra)[len(amostra) // 2] for c in range(3)]
    # máscara do que NÃO é vão: o fundo já achado e o que tem cor longe da do fundo
    if np is not None:
        im = np.frombuffer(bytes(rgb), np.uint8).reshape(-1, 3).astype(np.int16)
        perto = (np.abs(im - np.array(ref, np.int16)).max(axis=1) <= tol)
        nao = bytearray((~perto | (np.frombuffer(bytes(fundo), np.uint8) > 0)).astype(np.uint8).tobytes())
    else:
        r0, g0, b0 = ref
        nao = bytearray(map(lambda r, g, b, f: 1 if f or max(abs(r - r0), abs(g - g0), abs(b - b0)) > tol else 0, rgb[0::3], rgb[1::3], rgb[2::3], fundo))
    total = 0
    for area, _, px in manchas(W, H, nao, 30, diagonais=False):   # vãos: grupos ligados pelos lados, de 30 px ou mais
        for i in px: fundo[i] = 1
        total += area
    return total


def agrupar(W, H, ms, grade):
    """Junta as manchas em figuras. Com grade: uma por casa (a maior, mais as que ficam dentro da casa e têm pelo menos
    15% da área dela). Sem grade: cada mancha grande é uma figura; as pequenas vão para a figura que as contém."""
    if not ms: return []
    figuras = []
    if grade:
        C, L = grade; cw, ch = W / C, H / L
        casas = {}
        for m in ms:
            cx, cy = (m[1][0] + m[1][2]) / 2, (m[1][1] + m[1][3]) / 2
            casas.setdefault((int(cy // ch), int(cx // cw)), []).append(m)
        for chave in sorted(casas):
            grupo = sorted(casas[chave], key=lambda m: -m[0]); maior = grupo[0][0]
            figuras.append([m for m in grupo if m[0] >= 0.15 * maior])
        return figuras
    maior = max(m[0] for m in ms)
    grandes = [[m] for m in ms if m[0] >= 0.06 * maior]
    for m in ms:
        if m[0] >= 0.06 * maior: continue
        # só junta o que fica inteiro dentro da caixa da figura (a lupa na mão, uma folha solta); rótulos escritos
        # acima ou abaixo dela ficam de fora
        q = m[1]
        for f in grandes:
            r = f[0][1]
            if r[0] <= q[0] and q[2] <= r[2] and r[1] <= q[1] and q[3] <= r[3]: f.append(m); break
    # ordem de leitura: fileiras pelo meio da altura; dentro delas, da esquerda para a direita
    caixa = lambda f: [min(m[1][0] for m in f), min(m[1][1] for m in f), max(m[1][2] for m in f), max(m[1][3] for m in f)]
    grandes.sort(key=lambda f: (caixa(f)[1] + caixa(f)[3]) / 2)
    filas = []
    for f in grandes:
        c = caixa(f); meio = (c[1] + c[3]) / 2
        if filas and filas[-1][1] <= meio <= filas[-1][2]: filas[-1][0].append(f); filas[-1][2] = max(filas[-1][2], c[3])
        else: filas.append([[f], c[1], c[3]])
    return [f for fila in filas for f in sorted(fila[0], key=lambda f: caixa(f)[0])]


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if not a: sys.exit(__doc__)
    txt = lambda nome, padrao=None: a[a.index(nome) + 1] if nome in a else padrao
    W, H, rgb, alfa0 = ler_png(a[0], com_alfa=True)
    nome = txt('--nome', os.path.splitext(os.path.basename(a[0]))[0].replace(' ', '_').lower())
    grade = tuple(int(v) for v in txt('--grade').lower().split('x')) if '--grade' in a else None
    limite = float(opcao(a, '--limite', 1, [7])[0]); piso = int(opcao(a, '--piso', 1, [0])[0])
    if alfa0.count(0) > W * H // 20:   # a folha já vem com fundo transparente: ele manda
        fundo = bytearray(1 if v < 128 else 0 for v in alfa0); print('A folha já tem fundo transparente; usei a transparência dela.')
    else:
        fundo, _ = tirar_fundo(W, H, rgb, limite, piso)
    if '--vaos' in a: print(f'vãos presos: {tirar_vaos(W, H, rgb, fundo, float(opcao(a, "--vaos", 1, [25])[0]))} pixels ficaram transparentes')
    if grade:   # as linhas entre as casas também são fundo: nada passa de uma casa para a outra
        for c in range(1, grade[0]):
            x = round(c * W / grade[0])
            for y in range(H): fundo[y * W + x] = 1
        for l in range(1, grade[1]):
            y = round(l * H / grade[1]); fundo[y * W:(y + 1) * W] = b'\x01' * W
    ms = manchas(W, H, fundo, int(opcao(a, '--minimo', 1, [400])[0]))
    figs = agrupar(W, H, ms, grade)
    poses = txt('--poses', '').split(',') if '--poses' in a else []
    poses += [f'pose{i + 1}' for i in range(len(poses), len(figs))]
    virar = set(txt('--virar', '').split(',')) if '--virar' in a else set()
    print(f'{a[0]}: {W} x {H} px, {len(figs)} figuras')
    caixas = []
    for k, f in enumerate(figs):
        c = [max(0, min(m[1][0] for m in f) - 2), max(0, min(m[1][1] for m in f) - 2), min(W, max(m[1][2] for m in f) + 2), min(H, max(m[1][3] for m in f) + 2)]
        caixas.append(c); print(f'  {k + 1}. {poses[k]}: {c}  ({c[2] - c[0]} x {c[3] - c[1]} px)')
    if len(poses) > len(figs) and '--poses' in a: print(f'Atenção: --poses tem {len(poses)} nomes e achei {len(figs)} figuras. Confira com --conferir; ajuste --limite ou --minimo.')
    if '--conferir' in a:
        pix = bytearray(rgb); t = Tela(W, H, pix)
        for i in range(W * H):
            if fundo[i]: k = i * 3; pix[k] = (pix[k] + 255) // 2; pix[k + 1] = pix[k + 1] // 2; pix[k + 2] = (pix[k + 2] + 200) // 2
        for k, c in enumerate(caixas):
            t.retangulo(c[0], c[1], c[2], c[3], (0, 255, 120), 2); t.texto(f'{k + 1} {poses[k]}', c[0] + 3, c[1] + 3, (255, 255, 0), 3)
        escrever_png(txt('--conferir'), W, H, pix); print(f'{txt("--conferir")}: fundo tirado em rosa, figuras numeradas')
    if '--saida' not in a:
        print('Nada gravado: use --saida PASTA para gravar as PNGs.'); return
    pasta = txt('--saida'); os.makedirs(pasta, exist_ok=True)
    fator = None; quadros = {}
    for k, (f, c) in enumerate(zip(figs, caixas)):
        w, h = c[2] - c[0], c[3] - c[1]
        marca = bytearray(W * H)
        for m in f:
            for i in m[2]: marca[i] = 1
        px = bytearray(w * h * 3); al = bytearray(w * h)
        for y in range(h):
            b0 = (c[1] + y) * W + c[0]
            px[y * w * 3:(y + 1) * w * 3] = rgb[b0 * 3:(b0 + w) * 3]
            al[y * w:(y + 1) * w] = bytes(a if m_ else 0 for a, m_ in zip(alfa0[b0:b0 + w], marca[b0:b0 + w]))
        if '--altura' in a:
            if fator is None: fator = float(opcao(a, '--altura', 1, [h])[0]) / h
            nw, nh = max(1, round(w * fator)), max(1, round(h * fator))
            px, al = redimensionar(w, px, al, [0, 0, w, h], nw, nh); w, h = nw, nh
        if poses[k] in virar: px, al = espelhar_h(w, h, px, al)
        arq = os.path.join(pasta, f'{nome}_{poses[k]}.png'); escrever_png(arq, w, h, px, al)
        quadros[poses[k]] = {'arquivo': arq.replace(os.sep, '/'), 'w': w, 'h': h}
    h0 = next(iter(quadros.values()))['h']
    for q in quadros.values(): q['alt'] = round(q['h'] / h0, 3)
    print(f'Gravei {len(quadros)} PNGs em {pasta}. Trecho para a criatura (alt = altura em relação à primeira pose):')
    print('  quadros: {')
    for p, q in quadros.items(): print(f"    {p}: {{ arquivo: '{q['arquivo']}', w: {q['w']}, h: {q['h']}, alt: {q['alt']} }},")
    print('  },')
    print('  poses: ' + json.dumps([[p, p.capitalize()] for p in quadros], ensure_ascii=False) + ',')
    print('A altura de cada pose em relação à primeira só vale se a folha desenha todas na mesma escala; ajuste "alt" se não.')


if __name__ == '__main__':
    main()
