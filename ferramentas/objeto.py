#!/usr/bin/env python3
"""Monta o atlas de um objeto 3D (carro, armadilha, carroça, barco) a partir de uma folha de quatro vistas e imprime o
trecho "volume" para a criatura. O programa esculpe o objeto pelas silhuetas (veja "Objetos em 3D" no README).

Uso:
  python3 ferramentas/objeto.py folha_carro.png --nome carro --comprimento 4.5 --saida assets/objetos --conferir rascunho/c.png
  python3 ferramentas/objeto.py --frente f.png --lado l.png --fundos t.png --cima c.png --nome carro --comprimento 4.5 --saida assets/objetos

A folha deve ter as quatro vistas sem perspectiva, nesta ordem de leitura (uma fileira, ou 2 x 2): FRENTE, LATERAL
DIREITA (com a frente do objeto à ESQUERDA), FUNDOS e VISTA DE CIMA (com a frente à ESQUERDA). Rótulos e linhas de chão
saem sozinhos. As vistas também podem vir em quatro arquivos, com fundo liso ou transparente.

--nome N          Nome do atlas: grava <saida>/<nome>_atlas.png.
--saida PASTA     Onde gravar. Sem ela, só mostra o que achou.
--comprimento M   Comprimento real do objeto em metros (da frente aos fundos). A largura e a altura saem da proporção
                  do desenho. Sem ele, usa 1 m e avisa.
--ordem a,b,c,d   Ordem de leitura das vistas na folha, se for outra (padrão: frente,lado,fundos,cima).
--espelhar-lado   A lateral veio com a frente à direita: desvira.
--cima-frente L   De que lado da vista de cima fica a frente: esquerda (padrão), direita, cima ou baixo. Gira para a esquerda.
--altura-px N     Altura das vistas no atlas (padrão: a da lateral, entre 200 e 600 px).
--conferir ARQ    Grava o atlas com os retângulos e linhas-guia: a lateral e a vista de cima ficam uma sobre a outra, na
                  mesma largura; rodas, portas e para-brisa têm que cair nas mesmas linhas. Se não caem, a lateral ou a
                  vista de cima está espelhada.
--vaos N          Fundo preso no desenho (dentro de um aro, entre barras) com cor a menos de N da cor do fundo também
                  sai (use 15 a 25). Sem a opção, fica. Cuidado: reflexos da cor do fundo viram buracos.
--limite, --piso  Como em figuras.py, para o fundo da folha.

Depois, na criatura (src/campanha.js): volume: { comp, larg, alt, atlas, F, S, B, T } (o trecho sai pronto) e, se
quiser, redondo (0 a 1; 0,6 num carro), plano: true (objeto baixo e chato: só a vista de cima, deitada) ou
cruzado: true (objeto vazado, como uma armadilha: três planos cruzados em vez de volume).
"""
import os, sys
from imagem import ler_png, escrever_png, redimensionar, girar, espelhar_h, colar, Tela
from grade import opcao
from figuras import tirar_fundo, tirar_vaos, manchas, agrupar


VAOS = 0


def linhas_de_chao(W, H, fundo, ms):
    """Linha de chão sob cada vista: na metade de baixo de cada desenho, a faixa mais baixa de até 10 fileiras que
    enche 80% da largura ou mais e salta (8% ou mais) sobre as fileiras logo acima: a linha passa das rodas para os
    dois lados, e uma corrente pode descer abaixo dela. O pé de uma caixa, tão largo quanto o resto, não salta.
    Devolve os pixels da linha."""
    linha = []
    for _, (x0, y0, x1, y1), _ in ms:
        w = x1 - x0
        if w < 60 or y1 - y0 < 30: continue
        oc = {}
        def ocup(y):
            if y not in oc: oc[y] = fundo[y * W + x0:y * W + x1].count(0) / w if y0 <= y < y1 else 0
            return oc[y]
        def salta(y):
            acima = sorted(ocup(k) for k in range(max(y0, y - 12), max(y0, y - 3)))
            return ocup(y) >= 0.8 and acima and ocup(y) >= 1.08 * acima[len(acima) // 2]
        y = y1 - 1; ymin = y0 + (y1 - y0) // 2
        while y >= ymin:
            if not salta(y): y -= 1; continue
            fim = y
            while y >= ymin and (salta(y) or salta(y - 1)): y -= 1
            topo = y + 1; cheia = max(ocup(k) for k in range(topo, fim + 1))
            while ocup(fim + 1) >= 0.9 * cheia: fim += 1          # a borda suavizada da linha
            if fim - topo + 1 <= 10:
                for k in range(topo, fim + 1): linha += [k * W + x for x in range(x0, x1) if not fundo[k * W + x]]
                break
    return linha


def sem_linhas(W, H, rgb, fundo, limite, piso):
    """Tira a linha de chão: pinta-a com a cor do fundo e tira o fundo de novo, para o vão embaixo do objeto (entre as
    rodas), que a linha fechava, ligar-se ao resto do fundo. Reflexos cercados pelo contorno não são tocados."""
    linha = linhas_de_chao(W, H, fundo, manchas(W, H, fundo, 400))
    if not linha: return fundo, 0
    # cada coluna da linha recebe a cor de logo acima e de logo abaixo dela, em degradê (o fundo pode ser um degradê)
    marca = bytearray(W * H)
    for i in linha: marca[i] = 1
    rgb2 = bytearray(rgb)
    for i in linha:
        if not marca[i] or (i >= W and marca[i - W]): continue   # começo de cada trecho vertical da linha
        x, ya = i % W, i // W; yb = ya
        while yb < H and marca[yb * W + x]: yb += 1
        cima = max(0, ya - 2) * W + x; baixo = min(H - 1, yb + 1) * W + x
        for y in range(ya, yb):
            t = (y - ya + 1) / (yb - ya + 1); k = (y * W + x) * 3
            for c in range(3): rgb2[k + c] = round(rgb[cima * 3 + c] * (1 - t) + rgb[baixo * 3 + c] * t)
    fundo2, _ = tirar_fundo(W, H, rgb2, limite, piso)
    if VAOS: tirar_vaos(W, H, rgb, fundo2, VAOS)
    return fundo2, len(linha)


def vista_de_arquivo(caminho, limite, piso):
    w, h, rgb, al = ler_png(caminho, com_alfa=True)
    if al.count(0) < w * h // 50:
        fundo, _ = tirar_fundo(w, h, rgb, limite, piso)
        if VAOS: tirar_vaos(w, h, rgb, fundo, VAOS)   # antes da linha: o fundo preso enche a fileira acima dela
        fundo, _ = sem_linhas(w, h, rgb, fundo, limite, piso)
        ms = manchas(w, h, fundo, 200)
        if not ms: sys.exit(f'{caminho}: não achei desenho.')
        dentro = set(max(ms, key=lambda m: m[0])[2])
        al = bytearray(255 if i in dentro else 0 for i in range(w * h))
    return recortar(w, h, rgb, al, None)


def recortar(W, H, rgb, alfa, pixels):
    """Recorta justo no desenho. pixels: conjunto dos que são desenho (None = usar alfa > 127)."""
    if pixels is None: marca = bytearray(1 if a > 127 else 0 for a in alfa)
    else:
        marca = bytearray(W * H)
        for i in pixels: marca[i] = 1
    ys, xs0, xs1 = [], [], []
    for y in range(H):   # caixa justa: primeira e última marca de cada linha
        a_ = marca.find(1, y * W, (y + 1) * W)
        if a_ >= 0: ys.append(y); xs0.append(a_ - y * W); xs1.append(marca.rfind(1, y * W, (y + 1) * W) - y * W)
    x0, y0, x1, y1 = min(xs0), ys[0], max(xs1) + 1, ys[-1] + 1; w, h = x1 - x0, y1 - y0
    px = bytearray(w * h * 3); al = bytearray(w * h); cheio = bytes([255]) * w
    for y in range(h):
        b = (y0 + y) * W + x0
        px[y * w * 3:(y + 1) * w * 3] = rgb[b * 3:(b + w) * 3]
        fonte = alfa[b:b + w] if alfa is not None else cheio
        al[y * w:(y + 1) * w] = bytes(a if m_ else 0 for a, m_ in zip(fonte, marca[b:b + w]))
    return w, h, px, al


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    txt = lambda nome, padrao=None: a[a.index(nome) + 1] if nome in a else padrao
    limite = float(opcao(a, '--limite', 1, [7])[0]); piso = int(opcao(a, '--piso', 1, [0])[0])
    global VAOS; VAOS = float(opcao(a, '--vaos', 1, [0])[0])
    nomes = ['frente', 'lado', 'fundos', 'cima']
    if '--frente' in a:
        falta = [k for k in nomes if '--' + k not in a]
        if falta: sys.exit(f'Com arquivos separados, passe as quatro vistas; faltam: {", ".join(falta)}.')
        v = {k: vista_de_arquivo(txt('--' + k), limite, piso) for k in nomes}
    else:
        W, H, rgb, alfa = ler_png(a[0], com_alfa=True)
        linhas = 0
        if alfa.count(0) > W * H // 20: fundo = bytearray(1 if x < 128 else 0 for x in alfa)
        else:
            fundo, _ = tirar_fundo(W, H, rgb, limite, piso)
            if VAOS: tirar_vaos(W, H, rgb, fundo, VAOS)   # antes da linha: o fundo preso enche a fileira acima dela
            fundo, linhas = sem_linhas(W, H, rgb, fundo, limite, piso)
        ms = manchas(W, H, fundo, 400)
        figs = agrupar(W, H, ms, None)
        area = lambda f: sum(m[0] for m in f)
        if len(figs) < 4: sys.exit(f'Achei {len(figs)} vistas e preciso de quatro. Confira o fundo (--limite) ou passe as vistas em arquivos separados.')
        if len(figs) > 4:   # sobras (rótulos grandes, manchas): ficam as quatro maiores, na ordem de leitura
            maiores = sorted(figs, key=area, reverse=True)[:4]; figs = [f for f in figs if any(f is g for g in maiores)]
        ordem = txt('--ordem', ','.join(nomes)).split(',')
        if sorted(ordem) != sorted(nomes): sys.exit('--ordem precisa ter frente, lado, fundos e cima, separados por vírgula.')
        v = {k: recortar(W, H, rgb, alfa, set(i for m in f for i in m[2])) for k, f in zip(ordem, figs)}
        print(f'{a[0]}: {W} x {H} px; achei as quatro vistas' + (f' (tirei {linhas} px de linhas de chão)' if linhas else ''))
    if '--espelhar-lado' in a:
        w, h, px, al = v['lado']; px, al = espelhar_h(w, h, px, al); v['lado'] = (w, h, px, al)
    q = {'esquerda': 0, 'baixo': 1, 'direita': 2, 'cima': 3}.get(txt('--cima-frente', 'esquerda'))
    if q is None: sys.exit('--cima-frente: esquerda, direita, cima ou baixo.')
    if q: v['cima'] = girar(*v['cima'], q)
    for k in nomes: print(f'  {k}: {v[k][0]} x {v[k][1]} px')
    # mesmas alturas nas três elevações; a vista de cima com o comprimento da lateral
    Hc = int(opcao(a, '--altura-px', 1, [max(200, min(600, v['lado'][1]))])[0])
    def escala(k, nw, nh):
        w, h, px, al = v[k]; px2, al2 = redimensionar(w, px, al, [0, 0, w, h], nw, nh); return nw, nh, px2, al2
    E = {k: escala(k, max(1, round(v[k][0] * Hc / v[k][1])), Hc) for k in ('frente', 'lado', 'fundos')}
    Sw = E['lado'][0]; E['cima'] = escala('cima', Sw, max(1, round(v['cima'][1] * Sw / v['cima'][0])))
    M = 24; col2 = M + max(E['frente'][0], E['fundos'][0]) + M; lin2 = M + Hc + M
    pos = {'frente': (M, M), 'lado': (col2, M), 'fundos': (M, lin2), 'cima': (col2, lin2)}
    AW = col2 + Sw + M; AH = max(lin2 + E['fundos'][1], lin2 + E['cima'][1]) + M
    pix = bytearray(AW * AH * 3); al = bytearray(AW * AH)
    rets = {}
    for k, (x, y) in pos.items():
        w, h, px, a2 = E[k]; colar(AW, AH, pix, al, x, y, w, h, px, a2); rets[k] = [x, y, x + w, y + h]
    comp = float(opcao(a, '--comprimento', 1, [0])[0])
    if not comp: print('Atenção: sem --comprimento, usei 1 m. Troque "comp" (e as outras medidas, na mesma proporção).'); comp = 1.0
    larg, alt = comp * E['frente'][0] / Sw, comp * Hc / Sw
    larg_cima = comp * E['cima'][1] / Sw
    if abs(larg_cima - larg) > 0.15 * larg:
        print(f'Atenção: pela frente, a largura dá {larg:.2f} m; pela vista de cima, {larg_cima:.2f} m. As vistas não estão na mesma escala (ou a vista de cima está deitada: --cima-frente).')
    nome = txt('--nome', os.path.splitext(os.path.basename(a[0]))[0])
    if '--conferir' in a:
        t = Tela(AW, AH, bytearray(pix))
        for i in range(AW * AH):
            if not al[i]: t.pix[i * 3:i * 3 + 3] = b'\x2a\x2c\x30'
        for k, r in rets.items(): t.retangulo(*r, (255, 80, 200), 2); t.texto(k.upper(), r[0] + 4, r[1] + 4, (255, 230, 0), 3)
        S, T = rets['lado'], rets['cima']
        for i in range(11):
            gx = S[0] + round(i * (Sw - 1) / 10); t.linha(gx, S[1], gx, T[3], (0, 255, 255), 1, 0.6, 0 if i % 5 else 6)
        escrever_png(txt('--conferir'), AW, AH, t.pix); print(f'{txt("--conferir")}: atlas com as vistas marcadas; lateral e vista de cima alinhadas pelas linhas-guia')
    if '--saida' not in a: print('Nada gravado: use --saida PASTA.'); return
    pasta = txt('--saida'); os.makedirs(pasta, exist_ok=True)
    arq = os.path.join(pasta, f'{nome}_atlas.png').replace(os.sep, '/'); escrever_png(arq, AW, AH, pix, al)
    print(f'{arq}: {AW} x {AH} px. Trecho para a criatura (src/campanha.js):')
    print(f"  volume: {{ comp: {comp:.2f}, larg: {larg:.2f}, alt: {alt:.2f}, atlas: '{arq}', F: {rets['frente']}, S: {rets['lado']}, B: {rets['fundos']}, T: {rets['cima']}, redondo: 0.5 }},")
    print(f'  e, na mesma criatura: altura: {alt:.2f}, real: {alt:.2f} (a altura em metros; o mestre ajusta no painel).')


if __name__ == '__main__':
    main()
