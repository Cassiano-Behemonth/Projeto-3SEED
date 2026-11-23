#!/usr/bin/env python3
"""Acha na planta os móveis que se repetem (carteiras, bancos, camas, árvores iguais) a partir de UM exemplo e imprime o trecho
de "moveis" do mapa. Em vez de ler a posição de cada carteira na grade, você marca uma e a ferramenta procura as outras.

Uso:
  python3 ferramentas/repetidos.py planta.png --modelo 120 410 150 440 --conferir rascunho/r.png          # só mostra o que achou
  python3 ferramentas/repetidos.py planta.png --modelo 120 410 150 440 --area 100 380 520 560 \\
      --tipo mesa --mapa mapas/meu_mapa.json --saida rascunho/mesas.json                                    # grava a lista

--modelo X0 Y0 X1 Y1   O retângulo de UM exemplo, em pixels da planta (meça na grade). Quanto mais justo no móvel, melhor.
--area X0 Y0 X1 Y1     Onde procurar (pode repetir). Sem ela, a imagem inteira. Restrinja à sala ou ao pátio: é mais rápido
                       e evita falsos achados em outros lugares.
--limiar N             Semelhança mínima de 0 a 1 (padrão 0,6). Achou de menos: baixe (0,5). Achou lixo: suba (0,75).
--girar                Procura também o exemplo girado 90° (mesas vistas de lado, bancos em fileiras cruzadas); essas
                       saem com "giro": 90.
--distancia F          Distância mínima entre dois achados, em fração do tamanho do modelo (padrão 0,7).
--tipo T               O "tipo" de cada peça (padrão mesa).
--mapa ARQ             Lê "escala" do mapa e calcula "w" e "d" em metros pelo tamanho do modelo (sem isso, sai só x e y).
--w M --d M            Tamanho em metros de cada peça, se preferir dizê-lo (vale mais que o do modelo).
--opcoes '{"cor":"#5a4030"}'   Campos a mais para cada peça, em JSON.
--conferir ARQ         Grava a planta com um quadrado em cada achado e o modelo em amarelo. Olhe antes de usar.
--saida ARQ            Grava a lista de peças (JSON) para juntar ao campo "moveis" no seu script.

Sai a lista na tela também. Confira com previa.py e foto.py. Serve para peças sólidas e nítidas; brilhos, lanternas, caveiras e ossos dão muitos falsos achados (marque esses à mão). Não acha o que está de cabeça para baixo ou em outro tamanho: faça
uma rodada por tamanho. Sombra e luz diferentes entre as peças baixam a semelhança; ajuste --limiar.
"""
import json, math, os, sys
from imagem import ler_png, escrever_png, np, Tela
from grade import opcao, opcoes


def cinza(rgb, w, h, ret, f):
    """Tons de cinza (lista de listas) de ret = [x0, y0, x1, y1], reduzido por média de caixas de f x f pixels."""
    x0, y0, x1, y1 = ret; nw, nh = max(1, (x1 - x0) // f), max(1, (y1 - y0) // f)
    if np is not None:
        a = np.frombuffer(bytes(rgb), dtype=np.uint8).reshape(h, w, 3)[y0:y0 + nh * f, x0:x0 + nw * f].astype(np.float32)
        g = a.mean(axis=2)
        return g.reshape(nh, f, nw, f).mean(axis=(1, 3))
    out = []
    for j in range(nh):
        linha = []
        for i in range(nw):
            s = 0
            for dy in range(f):
                base = ((y0 + j * f + dy) * w + x0 + i * f) * 3
                for dx in range(f): s += rgb[base + dx * 3] + rgb[base + dx * 3 + 1] + rgb[base + dx * 3 + 2]
            linha.append(s / (3 * f * f))
        out.append(linha)
    return out


def semelhanca(img, tpl):
    """Correlação normalizada do modelo com cada posição da imagem (dicionário (i, j) -> -1..1, canto superior esquerdo)."""
    th, tw = len(tpl), len(tpl[0]) if not hasattr(tpl, 'shape') else tpl.shape[1]
    if np is not None:
        img, tpl = np.asarray(img, dtype=np.float32), np.asarray(tpl, dtype=np.float32)
        th, tw = tpl.shape
        if img.shape[0] < th or img.shape[1] < tw: return {}
        t = tpl - tpl.mean(); tn = math.sqrt(float((t * t).sum()))
        if tn < 1e-6: return {}
        janelas = np.lib.stride_tricks.sliding_window_view(img, (th, tw))
        m = janelas.mean(axis=(2, 3)); c = janelas - m[:, :, None, None]
        num = (c * t).sum(axis=(2, 3)); den = np.sqrt((c * c).sum(axis=(2, 3))) * tn
        r = np.where(den > 1e-6, num / np.maximum(den, 1e-6), 0)
        return r
    ih, iw = len(img), len(img[0])
    if ih < th or iw < tw: return {}
    flat = [v for linha in tpl for v in linha]; tm = sum(flat) / len(flat); t = [[v - tm for v in linha] for linha in tpl]
    tn = math.sqrt(sum(v * v for linha in t for v in linha))
    if tn < 1e-6: return {}
    r = [[0.0] * (iw - tw + 1) for _ in range(ih - th + 1)]
    for j in range(ih - th + 1):
        for i in range(iw - tw + 1):
            soma = 0.0; qs = 0.0; num = 0.0
            for dy in range(th):
                linha = img[j + dy]; tl = t[dy]
                for dx in range(tw):
                    v = linha[i + dx]; soma += v; qs += v * v; num += v * tl[dx]
            n = th * tw; var = qs - soma * soma / n
            r[j][i] = num / (math.sqrt(var) * tn) if var > 1e-6 else 0.0
    return r


def achar(rgb, w, h, modelo, areas, limiar, girar, dist_rel):
    """Lista de (x, y, giro, nota): centros em pixels da planta."""
    mx0, my0, mx1, my1 = modelo; mw, mh = mx1 - mx0, my1 - my0
    f = max(1, round(max(mw, mh) / 14))
    base = cinza(rgb, w, h, modelo, f)
    modelos = [(0, base)]
    if girar:
        if np is not None: modelos.append((90, np.rot90(np.asarray(base))))
        else: modelos.append((90, [list(l) for l in zip(*base)][::-1]))
    brutos = []
    for ax0, ay0, ax1, ay1 in areas:
        ax0, ay0, ax1, ay1 = max(0, ax0), max(0, ay0), min(w, ax1), min(h, ay1)
        img = cinza(rgb, w, h, [ax0, ay0, ax1, ay1], f)
        for giro, tpl in modelos:
            r = semelhanca(img, tpl)
            if np is not None:
                if getattr(r, 'size', 0) == 0: continue
                th, tw = tpl.shape
                for j, i in zip(*np.where(r >= limiar)): brutos.append((float(r[j, i]), ax0 + (int(i) + tw / 2) * f, ay0 + (int(j) + th / 2) * f, giro))
            else:
                if not r: continue
                th, tw = len(tpl), len(tpl[0])
                for j, linha in enumerate(r):
                    for i, v in enumerate(linha):
                        if v >= limiar: brutos.append((v, ax0 + (i + tw / 2) * f, ay0 + (j + th / 2) * f, giro))
    brutos.sort(reverse=True)
    minimo = dist_rel * min(mw, mh); escolhidos = []
    for nota, x, y, giro in brutos:
        if all(math.hypot(x - ex, y - ey) >= minimo for _, ex, ey, _ in escolhidos): escolhidos.append((nota, x, y, giro))
    escolhidos.sort(key=lambda e: (round(e[2] / max(1, minimo)), e[1]))   # ordem de leitura aproximada
    return [(round(x), round(y), giro, nota) for nota, x, y, giro in escolhidos]


def main():
    a = sys.argv[1:]
    if not a or a[0] in ('-h', '--help'): print(__doc__); sys.exit(0 if a else 1)
    if '--modelo' not in a: sys.exit('Falta --modelo X0 Y0 X1 Y1 (o retângulo de um exemplo). Veja --help.')
    w, h, rgb = ler_png(a[0])
    mx0, my0, mx1, my1 = [int(v) for v in opcao(a, '--modelo', 4, [0, 0, 0, 0])]
    if not (0 <= mx0 < mx1 <= w and 0 <= my0 < my1 <= h): sys.exit(f'O modelo [{mx0}, {my0}, {mx1}, {my1}] não cabe na imagem de {w} x {h} px.')
    if mx1 - mx0 < 6 or my1 - my0 < 6: sys.exit('O modelo é pequeno demais (menos de 6 px); marque o móvel inteiro.')
    areas = [[int(v) for v in ar] for ar in opcoes(a, '--area', 4)] or [[0, 0, w, h]]
    limiar = opcao(a, '--limiar', 1, [0.6])[0]
    dist_rel = opcao(a, '--distancia', 1, [0.7])[0]
    tipo = a[a.index('--tipo') + 1] if '--tipo' in a else 'mesa'
    extra = json.loads(a[a.index('--opcoes') + 1]) if '--opcoes' in a else {}
    escala = None
    if '--mapa' in a:
        try: escala = float(json.load(open(a[a.index('--mapa') + 1], encoding='utf-8'))['escala'])
        except (OSError, ValueError, KeyError): sys.exit('Não consegui ler "escala" do mapa dado em --mapa.')
    mw, mh = mx1 - mx0, my1 - my0
    ww = opcao(a, '--w', 1, [None])[0]; dd = opcao(a, '--d', 1, [None])[0]
    if ww is None and escala: ww = round(mw * escala, 2)
    if dd is None and escala: dd = round(mh * escala, 2)
    achados = achar(rgb, w, h, [mx0, my0, mx1, my1], areas, limiar, '--girar' in a, dist_rel)
    pecas = []
    for x, y, giro, _ in achados:
        p = {'tipo': tipo, 'x': x, 'y': y}
        if ww: p['w'] = ww if giro == 0 else dd or ww
        if dd: p['d'] = dd if giro == 0 else ww
        if giro: p['giro'] = giro
        pecas.append({**p, **extra})
    print(f'{a[0]}: {len(pecas)} peças parecidas com o modelo [{mx0}, {my0}, {mx1}, {my1}] ({mw} x {mh} px), semelhança mínima {limiar:g}.')
    if not pecas: print('  Nenhuma. Baixe --limiar (0,6), confira o --modelo na grade ou use --area para olhar só a região certa.')
    elif len(pecas) < 4: print('  Poucas. Se esperava mais, baixe --limiar; a luz e a sombra mudam entre as peças.')
    if pecas and not (ww and dd): print('  Sem --mapa nem --w/--d, as peças saem só com x e y (o tamanho padrão do tipo).')
    for p in pecas: print('  ' + json.dumps(p, ensure_ascii=False))
    if '--saida' in a:
        s = a[a.index('--saida') + 1]
        os.makedirs(os.path.dirname(os.path.abspath(s)), exist_ok=True)
        json.dump(pecas, open(s, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(f'{s}: {len(pecas)} peças gravadas.')
    if '--conferir' in a:
        t = Tela(w, h, bytearray(rgb))
        for x, y, giro, _ in achados:
            tw, th = (mh, mw) if giro else (mw, mh)
            t.retangulo(int(x - tw / 2), int(y - th / 2), int(x + tw / 2), int(y + th / 2), (255, 60, 60), 1)
        t.retangulo(mx0, my0, mx1, my1, (255, 230, 0), 2)
        s = a[a.index('--conferir') + 1]; os.makedirs(os.path.dirname(os.path.abspath(s)), exist_ok=True)
        escrever_png(s, t.w, t.h, t.pix); print(f'{s}: achados em vermelho, modelo em amarelo.')


if __name__ == '__main__':
    main()
