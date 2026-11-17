#!/usr/bin/env python3
"""Ergue em blocos o que tem certa cor na pintura: as sebes de um labirinto, muretas, canteiros, ruínas.

Uso:
  python3 ferramentas/relevo.py planta.png blocos.json --area X0 Y0 X1 Y1 --claro 38 --altura 2.2
  python3 ferramentas/relevo.py planta.png blocos.json --poligono 1300 470 1300 415 1452 258 1596 258 1596 604 1300 604 \
          --claro 38 --verde --altura 2.2 --cor "#263a1e" --mascara /tmp/m.png

--area ou --poligono  Onde procurar (pixels). O polígono é uma lista de pontos x y.
--claro N             Sobe o que é mais claro que N (0 a 255). Use quando a peça é mais clara que o chão em volta.
--escuro N            Ou o contrário: sobe o que é mais escuro que N.
--verde [N]           Além disso, exige que o pixel seja esverdeado (sebes, arbustos). Com um número (1.08, 1.15),
                      o verde precisa passar o vermelho nessa proporção: separa sebe de grama seca e de terra.
--celula N            Tamanho da célula, em pixels (padrão 4). Menor segue melhor o desenho e gera mais blocos.
--altura M            Altura dos blocos, em metros (padrão 2).
--cor "#rrggbb"       Cor das laterais.
--fora X0 Y0 X1 Y1    Retângulo a ignorar (um rótulo, um chafariz). Pode repetir.
--mascara arquivo.png Grava uma imagem em preto e branco do que seria erguido. Olhe-a antes de usar o resultado.

Grava em blocos.json uma lista de prédios baixos, sem janela nem porta, cada um com a pintura por cima. Copie a lista
para o campo "predios" do mapa (ou junte no seu script). As criaturas e a câmera não atravessam os blocos.
"""
import json, sys
from imagem import ler_png, escrever_png
from grade import opcao, opcoes
from formato import dentro_de


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if len(a) < 2: sys.exit(__doc__)
    W, H, rgb = ler_png(a[0])
    pol = None
    if '--poligono' in a:
        i = a.index('--poligono') + 1; nums = []
        while i < len(a) and not a[i].startswith('--'): nums.append(float(a[i])); i += 1
        pol = [[nums[k], nums[k + 1]] for k in range(0, len(nums) - 1, 2)]
        x0, y0, x1, y1 = int(min(p[0] for p in pol)), int(min(p[1] for p in pol)), int(max(p[0] for p in pol)), int(max(p[1] for p in pol))
    else:
        r = opcao(a, '--area', 4, None)
        if not r: sys.exit('Informe --area ou --poligono.')
        x0, y0, x1, y1 = int(min(r[0], r[2])), int(min(r[1], r[3])), int(max(r[0], r[2])), int(max(r[1], r[3]))
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    claro = opcao(a, '--claro', 1, [None])[0]; escuro = opcao(a, '--escuro', 1, [None])[0]
    if claro is None and escuro is None: sys.exit('Informe --claro N ou --escuro N.')
    verde_min = opcao(a, '--verde', 1, [1.0])[0] if '--verde' in a and a.index('--verde') + 1 < len(a) and not a[a.index('--verde') + 1].startswith('--') else 1.0
    verde = '--verde' in a; cel = max(2, int(opcao(a, '--celula', 1, [4])[0])); altura = opcao(a, '--altura', 1, [2.0])[0]
    cor = a[a.index('--cor') + 1] if '--cor' in a else '#3a4a2a'; fora = opcoes(a, '--fora', 4)
    def sobe(cx, cy):
        if pol and not dentro_de(pol, cx + cel / 2, cy + cel / 2): return False
        if any(min(f[0], f[2]) <= cx + cel / 2 <= max(f[0], f[2]) and min(f[1], f[3]) <= cy + cel / 2 <= max(f[1], f[3]) for f in fora): return False
        r = g = b = n = 0
        for y in range(cy, min(H, cy + cel)):
            for x in range(cx, min(W, cx + cel)):
                k = (y * W + x) * 3; r += rgb[k]; g += rgb[k + 1]; b += rgb[k + 2]; n += 1
        if not n: return False
        r, g, b = r / n, g / n, b / n; lum = (r * 3 + g * 6 + b) / 10
        if claro is not None and lum <= claro: return False
        if escuro is not None and lum >= escuro: return False
        return not verde or (g > b * 1.15 and g > r * verde_min)
    colunas, linhas = (x1 - x0) // cel, (y1 - y0) // cel
    grade = [[sobe(x0 + c * cel, y0 + l * cel) for c in range(colunas)] for l in range(linhas)]
    # Tira células soltas (ruído): as que não têm vizinha nenhuma.
    for l in range(linhas):
        for c in range(colunas):
            if grade[l][c] and not any(0 <= l + dl < linhas and 0 <= c + dc < colunas and grade[l + dl][c + dc] for dl, dc in ((0, 1), (0, -1), (1, 0), (-1, 0))): grade[l][c] = False
    # Junta as células em retângulos: trechos de cada linha, fundidos com o trecho igual da linha de baixo.
    abertos, blocos = {}, []
    for l in range(linhas + 1):
        trechos = set(); c = 0
        while l < linhas and c < colunas:
            if grade[l][c]:
                ini = c
                while c < colunas and grade[l][c]: c += 1
                trechos.add((ini, c))
            else: c += 1
        for t in list(abertos):
            if t not in trechos: blocos.append((t[0], abertos.pop(t), t[1], l))
        for t in trechos: abertos.setdefault(t, l)
    predios = [{'area': [x0 + c0 * cel, y0 + l0 * cel, x0 + c1 * cel, y0 + l1 * cel], 'altura': altura, 'telhado': 'plano', 'cor': cor, 'janelas': False, 'porta': False, 'beiral': 0} for c0, l0, c1, l1 in blocos]
    json.dump(predios, open(a[1], 'w', encoding='utf-8'))
    if '--mascara' in a:
        z = 2; ow, oh = colunas * cel * z, linhas * cel * z; pix = bytearray(ow * oh * 3)
        for y in range(oh):
            lin = bytearray(ow * 3); l = y // (cel * z)
            for c in range(colunas):
                if grade[l][c]: lin[c * cel * z * 3:(c + 1) * cel * z * 3] = b'\xff' * (cel * z * 3)
            pix[y * ow * 3:(y + 1) * ow * 3] = lin
        saida = a[a.index('--mascara') + 1]; escrever_png(saida, ow, oh, pix); print(f'{saida}: em branco, o que sobe')
    cheias = sum(sum(1 for v in lin if v) for lin in grade)
    print(f'{a[1]}: {len(predios)} blocos de {altura:g} m ({cheias} células de {cel} px; {100 * cheias // max(1, colunas * linhas)}% da área). Copie a lista para "predios" do mapa.')


if __name__ == '__main__':
    main()
