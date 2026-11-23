#!/usr/bin/env python3
"""Confere um mapa em arquivo antes de abrir no navegador.

Uso:
  python3 ferramentas/validar.py mapas/meu_mapa.json
  python3 ferramentas/validar.py --tudo        # todos os mapas das duas listas, e as próprias listas

Aponta ERROS (o mapa quebra ou fica com defeito visível) e AVISOS (provável engano).
Termina com código 1 se houver erro. Só usa a biblioteca padrão do Python.
"""
import json, math, os, re, sys
from imagem import tamanho_png
from formato import normalizar, contorno_de, altura_do_piso

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def _locais():
    """Locais da cidade da campanha (src/dados/locais.js), se ela estiver presente; sem ela, nenhum."""
    try: return set(re.findall(r"\bid: '([a-z_0-9]+)'", open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'dados', 'locais.js'), encoding='utf-8').read()))
    except OSError: return set()
LOCAIS = _locais()


def _campanha():
    """Interiores escritos em código e ids das criaturas da campanha (src/campanha.js e o que ele reexporta).
    Sem campanha, (conjunto vazio, None)."""
    base = os.path.join(RAIZ, 'src')
    try: txt = open(os.path.join(base, 'campanha.js'), encoding='utf-8').read()
    except OSError: return set(), None
    for arq in re.findall(r"export \{[^}]*\} from '\./([^']+)'", txt):
        try: txt += '\n' + open(os.path.join(base, arq), encoding='utf-8').read()
        except OSError: pass
    def ids(nome):
        m = re.search(r'export const ' + nome + r' = \[(.*?)\n\];', txt, re.S)
        return set(re.findall(r"\bid: '([a-zA-Z0-9_-]+)'", m.group(1))) if m else None
    criaturas = [c for c in (ids('MONSTROS'), ids('PERSONAGENS')) if c is not None]
    return ids('INTERIORES') or set(), set().union(*criaturas) if criaturas else None
INTERIORES_CODIGO, CRIATURAS = _campanha()


def tipos_de_movel():
    """Lê a lista de móveis direto do programa, para nunca ficar desatualizada."""
    txt = open(os.path.join(RAIZ, 'src', 'mundo', 'interiores', 'dados.js'), encoding='utf-8').read()
    bloco = re.search(r'export const KIT = \{(.*?)\};', txt, re.S).group(1)
    return set(re.findall(r'(\w+)\s*:', bloco))


def conferir(caminho):
    erros, avisos = [], []
    repetidas = []
    def sem_repeticao(pares):
        vistos = {}
        for k, v in pares:
            if k in vistos: repetidas.append(k)
            vistos[k] = v
        return vistos
    try:
        d = json.load(open(caminho, encoding='utf-8'), object_pairs_hook=sem_repeticao)
    except (OSError, ValueError) as e:
        return [f'não consegui ler o arquivo: {e}'], []
    for k in repetidas: erros.append(f'a chave "{k}" aparece duas vezes no mesmo item; só a última vale (em móveis, "x" e "y" são a posição na planta; para erguer do chão use "alt")')
    for campo in ('id', 'imagem', 'larguraPx', 'alturaPx', 'escala'):
        if d.get(campo) in (None, ''): erros.append(f'falta o campo obrigatório "{campo}"')
    if erros: return erros, avisos
    W, H, E = d['larguraPx'], d['alturaPx'], d['escala']
    normalizar(d, erros)
    if not re.match(r'^[a-z0-9][a-z0-9_-]{0,63}$', str(d['id'])): erros.append('"id" deve ter só letras minúsculas, números, _ e -')
    if os.path.basename(caminho) != d['id'] + '.json': avisos.append(f'o arquivo deveria se chamar {d["id"]}.json')
    if d.get('imagemPredios'):
        arq = os.path.join(RAIZ, d['imagemPredios'])
        if not os.path.exists(arq): erros.append(f'"imagemPredios": arquivo não encontrado ({d["imagemPredios"]})')
        elif tamanho_png(arq) and tamanho_png(arq) != (W, H): erros.append('"imagemPredios" precisa ter o mesmo tamanho de "imagem" (as duas são a mesma planta; uma com os prédios, a outra sem)')
    for campo in ('imagem', 'imagemNoite'):
        if d.get(campo):
            arq = os.path.join(RAIZ, d[campo])
            if not os.path.exists(arq): erros.append(f'"{campo}": arquivo não encontrado ({d[campo]})')
            else:
                t = tamanho_png(arq)
                if t and t != (W, H) and campo == 'imagem': erros.append(f'"imagem" tem {t[0]} x {t[1]} px, mas o mapa diz {W} x {H}')
                elif t and abs((t[0] / t[1]) / (W / H) - 1) > 0.01: erros.append(f'"imagemNoite" tem {t[0]} x {t[1]} px e a de dia {W} x {H}: a proporção é diferente, então não é o mesmo enquadramento. Entregue o mapa sem "imagemNoite" e avise a pessoa')
                elif t and t != (W, H): avisos.append(f'"imagemNoite" tem {t[0]} x {t[1]} px e a de dia {W} x {H}. A proporção bate, então o programa estica a de noite sobre o mesmo piso; confira o enquadramento com ferramentas/comparar.py')
    if not (0.002 <= E <= 0.3): erros.append(f'"escala" fora do razoável ({E} m por pixel)')
    larg, prof = W * E, H * E
    if larg < 4 or larg > 400: avisos.append(f'com essa escala a planta teria {larg:.1f} m de largura; confira a escala')

    def dentro(x, y): return -5 <= x <= W + 5 and -5 <= y <= H + 5
    # Só se anda (e a câmera só vai) até 2 m além da borda da imagem.
    M2 = 2 / E
    def andavel(x, y): return -M2 <= x <= W + M2 and -M2 <= y <= H + M2
    def ponto(v): return isinstance(v, list) and len(v) == 2 and all(isinstance(n, (int, float)) for n in v)
    def seg(nome, s, i):
        if not (isinstance(s, list) and len(s) == 4 and all(isinstance(v, (int, float)) for v in s)):
            erros.append(f'{nome} {i + 1}: deve ser [x1, y1, x2, y2]'); return None
        if not (dentro(s[0], s[1]) and dentro(s[2], s[3])): avisos.append(f'{nome} {i + 1}: fica fora da imagem {s}')
        if math.hypot(s[2] - s[0], s[3] - s[1]) < 2: erros.append(f'{nome} {i + 1}: comprimento zero {s}')
        return s

    paredes = [p for p in (seg('parede', w if isinstance(w, list) else w.get('p'), i) for i, w in enumerate(d.get('paredes', []))) if p]
    # Paredes na mesma linha que se sobrepõem duplicam a textura.
    for i in range(len(paredes)):
        for j in range(i + 1, len(paredes)):
            a, b = paredes[i], paredes[j]
            for e in (0, 1):
                if abs(a[e] - a[e + 2]) < 1 and abs(b[e] - b[e + 2]) < 1 and abs(a[e] - b[e]) < 6:
                    o = 1 - e
                    lo, hi = max(min(a[o], a[o + 2]), min(b[o], b[o + 2])), min(max(a[o], a[o + 2]), max(b[o], b[o + 2]))
                    if hi - lo > 3: erros.append(f'paredes {i + 1} e {j + 1} se sobrepõem na mesma linha ({a} e {b}); encurte uma delas')
    inclinadas = [i + 1 for i, p in enumerate(paredes) if min(abs(p[0] - p[2]), abs(p[1] - p[3])) > 12]
    if len(inclinadas) >= 2 and not d.get('plataformas') and not d.get('ceuAberto'): avisos.append(f'paredes {inclinadas} são inclinadas. Se as paredes externas da planta parecem um trapézio, a imagem provavelmente é desenhada em ângulo e não serve como piso')
    pontas = [(p[0], p[1]) for p in paredes] + [(p[2], p[3]) for p in paredes]
    esps = [(w.get('esp', d.get('espParede', 0.22)) if isinstance(w, dict) else d.get('espParede', 0.22)) for w in d.get('paredes', []) if (w if isinstance(w, list) else w.get('p'))]
    def dist_seg(x, y, s):
        dx, dy = s[2] - s[0], s[3] - s[1]; c = dx * dx + dy * dy
        t = max(0, min(1, ((x - s[0]) * dx + (y - s[1]) * dy) / c)) if c else 0
        return math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t))
    def dist_area(x, y, s, e):
        # Distância do ponto à área que a parede ocupa de verdade (meia espessura para cada lado e além de cada ponta).
        dx, dy = s[2] - s[0], s[3] - s[1]; n = math.hypot(dx, dy) or 1; m = (e / 2) / E
        u = ((x - (s[0] + s[2]) / 2) * dx + (y - (s[1] + s[3]) / 2) * dy) / n; v = (-(x - (s[0] + s[2]) / 2) * dy + (y - (s[1] + s[3]) / 2) * dx) / n
        return math.hypot(max(0, abs(u) - n / 2 - m), max(0, abs(v) - m))
    def na_parede(x, y, folga=0): return any(dist_seg(x, y, p) < (e / 2) / E + folga for p, e in zip(paredes, esps))
    def sala_de(x, y):
        for nome, rets in d.get('salas', {}).items():
            for r in rets:
                if isinstance(r, list) and len(r) == 4 and min(r[0], r[2]) < x < max(r[0], r[2]) and min(r[1], r[3]) < y < max(r[1], r[3]): return nome
        return None
    for i, s in enumerate(d.get('grades', [])): seg('grade', s, i)
    for i, s in enumerate(d.get('barreiras', [])): seg('barreira', s, i)

    salas = d.get('salas', {})
    for nome, rets in salas.items():
        for r in rets:
            if not (isinstance(r, list) and len(r) == 4): erros.append(f'sala "{nome}": cada retângulo deve ser [x0, y0, x1, y1]')
            elif abs(r[2] - r[0]) * E < 0.5 or abs(r[3] - r[1]) * E < 0.5: avisos.append(f'sala "{nome}": retângulo muito pequeno {r}')
    reveladas = set()
    for i, p in enumerate(d.get('portas', [])):
        s = seg('porta', p.get('p'), i)
        if not s: continue
        vao = math.hypot(s[2] - s[0], s[3] - s[1]) * E
        if vao < 0.7: avisos.append(f'porta {i + 1}: vão de {vao:.2f} m é estreito; criaturas e câmera podem não passar (use 0,8 m ou mais)')
        if vao > 3.5: avisos.append(f'porta {i + 1}: vão de {vao:.2f} m é largo demais para uma folha só')
        tx = p.get('textura')
        if tx is not None:
            if not isinstance(tx, dict) or not tx.get('imagem') or not os.path.exists(os.path.join(RAIZ, str(tx.get('imagem')))): erros.append(f'porta {i + 1}: "textura.imagem" não encontrada ({tx.get("imagem") if isinstance(tx, dict) else tx})')
            elif tx.get('rect') is not None and not (isinstance(tx['rect'], list) and len(tx['rect']) == 4 and tx['rect'][2] > tx['rect'][0] and tx['rect'][3] > tx['rect'][1]): erros.append(f'porta {i + 1}: "textura.rect" deve ser [x0, y0, x1, y1] dentro da imagem da porta')
        if p.get('alturaFolha') is not None and not (isinstance(p['alturaFolha'], (int, float)) and 0.5 <= p['alturaFolha'] <= 6): erros.append(f'porta {i + 1}: "alturaFolha" é a altura da folha em metros (de 0,5 a 6)')
        for nome in p.get('revela', []):
            reveladas.add(nome)
            if nome not in salas: erros.append(f'porta {i + 1}: revela a sala "{nome}", que não existe em "salas"')
        for q in ((s[0], s[1]), (s[2], s[3])):
            # A parede 3D passa meia espessura além da ponta; em parede grossa a ponta escrita fica recuada de propósito.
            # Porteira de duas folhas: a ponta de uma encosta na ponta da outra, no meio do vão.
            outra = any(j != i and isinstance(o.get('p'), list) and len(o['p']) == 4 and min(math.hypot(q[0] - o['p'][k], q[1] - o['p'][k + 1]) for k in (0, 2)) < 2 for j, o in enumerate(d.get('portas', [])))
            if paredes and not outra and min(dist_area(q[0], q[1], w, e) for w, e in zip(paredes, esps)) > 14:
                avisos.append(f'porta {i + 1}: a ponta {list(q)} não encosta no fim de nenhuma parede (a porta deve ocupar um vão entre duas paredes)')
        # Uma parede passando por dentro do vão deixa a porta inútil.
        for j, w in enumerate(paredes):
            for e in (0, 1):
                o = 1 - e
                if abs(s[e] - s[e + 2]) < 1 and abs(w[e] - w[e + 2]) < 1 and abs(s[e] - w[e]) < 6:
                    lo, hi = max(min(s[o], s[o + 2]), min(w[o], w[o + 2])), min(max(s[o], s[o + 2]), max(w[o], w[o + 2]))
                    if hi - lo > 6: erros.append(f'porta {i + 1}: a parede {j + 1} atravessa o vão da porta; deixe a parede interrompida ali')
    for nome in salas:
        if nome not in reveladas: erros.append(f'sala oculta "{nome}" não é revelada por nenhuma porta (ficaria preta para sempre)')

    kit = tipos_de_movel()
    for i, m in enumerate(d.get('moveis', [])):
        if m.get('tipo') not in kit: erros.append(f'móvel {i + 1}: tipo desconhecido "{m.get("tipo")}". Tipos válidos: {", ".join(sorted(kit))}')
        if not isinstance(m.get('x'), (int, float)) or not isinstance(m.get('y'), (int, float)): erros.append(f'móvel {i + 1}: faltam "x" e "y"')
        elif not dentro(m['x'], m['y']): avisos.append(f'móvel {i + 1} ({m.get("tipo")}): fica fora da imagem')
        elif any(dist_seg(m['x'], m['y'], p['p']) < 0.4 / E for p in d.get('portas', []) if isinstance(p.get('p'), list) and len(p['p']) == 4): avisos.append(f'móvel {i + 1} ({m.get("tipo")}): está no vão de uma porta e vai travar a passagem')
        for k in ('w', 'd', 'h', 'l', 'r'):
            if k in m and not (0.02 <= m[k] <= 60): avisos.append(f'móvel {i + 1} ({m.get("tipo")}): "{k}" = {m[k]} m parece errado (tamanhos são em metros)')
    luzes = d.get('luzes', [])
    if len(paredes) <= 4 and not d.get('portas') and not d.get('moveis') and not d.get('folhas') and not d.get('predios') and not d.get('plataformas'): avisos.append('o mapa só tem o contorno (sem paredes internas, portas ou móveis). Se a imagem não é uma planta vista de cima, pare: veja o Passo 0 em AGENTS.md')
    for i, pl in enumerate(d.get('plataformas') or []):
        c = contorno_de(pl) if isinstance(pl, dict) else None
        if not c or not all(isinstance(q, list) and len(q) == 2 and all(isinstance(v, (int, float)) for v in q) for q in c): erros.append(f'plataforma {i + 1}: precisa de "pontos" [[x, y], ...] (três ou mais) ou "area" [x0, y0, x1, y1]'); continue
        if not isinstance(pl.get('altura'), (int, float)) or not (0 < pl['altura'] <= 20): erros.append(f'plataforma {i + 1}: "altura" deve ser um número de metros entre 0 e 20')
        if any(not dentro(q[0], q[1]) for q in c): avisos.append(f'plataforma {i + 1}: tem pontos fora da imagem')
    # Plataforma mais alta que o piso em volta precisa de degraus para as criaturas subirem.
    pls = [(contorno_de(pl), pl.get('altura', 0), pl) for pl in d.get('plataformas') or [] if isinstance(pl, dict) and contorno_de(pl)]
    for i, (c, alt, pl) in enumerate(pls):
        if pl.get('encosta') and (pl.get('afunila') or 1) > 1.001: continue   # encosta de morro: sobe-se andando
        fora = []
        for j in range(len(c)):
            a, b = c[j], c[(j + 1) % len(c)]; mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            n = math.hypot(b[0] - a[0], b[1] - a[1]) or 1
            for s_ in (-1, 1):
                qx, qy = mx - s_ * (b[1] - a[1]) / n * 8, my + s_ * (b[0] - a[0]) / n * 8
                h = altura_do_piso(d, qx, qy)
                if h < alt - 0.01: fora.append(h)
        if not fora: continue
        desnivel = alt - max(fora)
        perto = lambda m: min(dist_seg(m['x'], m['y'], [c[j][0], c[j][1], c[(j + 1) % len(c)][0], c[(j + 1) % len(c)][1]]) for j in range(len(c))) < 1.6 / E
        if 0.3 < desnivel <= 2.2 and not any(m.get('tipo') in ('caixa', 'ponte') and isinstance(m.get('x'), (int, float)) and perto(m) for m in d.get('moveis', [])):
            avisos.append(f'plataforma {i + 1}: fica {desnivel:.1f} m acima do piso ao lado e não há degraus de "caixa" encostados nela; criaturas não sobem mais que 0,3 m de uma vez')
    morro = any(isinstance(pl, dict) and pl.get('encosta') for pl in d.get('plataformas') or [])  # morro: anda-se do chão para cima
    if d.get('plataformas') and not morro and d.get('chegada') and altura_do_piso(d, *d['chegada']['de']) == 0 and all(altura_do_piso(d, m.get('x', 0), m.get('y', 0)) > 0 for m in d.get('moveis', [])[:1]):
        avisos.append('a "chegada" está fora das plataformas (no chão) e os móveis estão em cima de uma; confira se é isso mesmo (num navio, a chegada fica no convés)')
    for i, pr in enumerate(d.get('predios') or []):
        r = pr.get('area') if isinstance(pr, dict) else None
        if not (isinstance(r, list) and len(r) == 4 and all(isinstance(v, (int, float)) for v in r)): erros.append(f'prédio {i + 1}: precisa de "area" [x0, y0, x1, y1]'); continue
        if not isinstance(pr.get('altura', 3), (int, float)) or not (0 < pr.get('altura', 3) <= 40): erros.append(f'prédio {i + 1}: "altura" deve ser um número de metros')
        sil = pr.get('silhueta')
        if sil is not None and not (isinstance(sil, list) and len(sil) >= 3 and all(isinstance(q, list) and len(q) == 2 for q in sil)): erros.append(f'prédio {i + 1}: "silhueta" deve ser uma lista de pontos [x, y], com pelo menos três')
        if pr.get('frente', 'pintada') not in ('pintada', 'gerada'): erros.append(f'prédio {i + 1}: "frente" deve ser "pintada" ou "gerada"')
        if pr.get('telhado', 'duas-aguas') not in ('duas-aguas', 'quatro-aguas', 'plano'): erros.append(f'prédio {i + 1}: "telhado" deve ser "duas-aguas", "quatro-aguas" ou "plano"')
    for i, f in enumerate(d.get('folhas') or []):
        if not isinstance(f, dict) or not f.get('imagem') or not os.path.exists(os.path.join(RAIZ, f.get('imagem', ''))): erros.append(f'folha {i + 1}: "imagem" não encontrada ({f.get("imagem") if isinstance(f, dict) else f})'); continue
        for k in ('frente', 'lado', 'fundos', 'telhado'):
            r = f.get(k)
            if r is not None and not (isinstance(r, list) and len(r) == 4 and r[2] > r[0] and r[3] > r[1]): erros.append(f'folha {i + 1}: "{k}" deve ser [x0, y0, x1, y1] dentro da folha')
        if not isinstance(f.get('frente'), list): erros.append(f'folha {i + 1}: falta a vista "frente" (rode ferramentas/folha.py na imagem)')
        if not all(isinstance(f.get(k), (int, float)) for k in ('x', 'y', 'largura')): erros.append(f'folha {i + 1}: precisa de "x", "y" (pixels da planta) e "largura" (metros)')
        elif not dentro(f['x'], f['y']): avisos.append(f'folha {i + 1}: fica fora da imagem (só se anda até 2 m além da borda; ninguém chega perto dela)')
        vao = f.get('vao')
        if vao is not None:
            if not (isinstance(vao, dict) and isinstance(vao.get('de'), (int, float)) and isinstance(vao.get('ate'), (int, float))): erros.append(f'folha {i + 1}: "vao" deve ser {{ "de": 0.7, "ate": 0.95, "margem": 0.3 }} (alturas de 0 a 1 na vista, margem em metros)')
            elif not (0 <= vao['de'] < vao['ate'] <= 1): erros.append(f'folha {i + 1}: em "vao", "de" e "ate" são alturas na vista, de 0 (pé) a 1 (topo), com "de" menor que "ate"')
            elif not (0 < vao.get('margem', 0.3) <= 3): avisos.append(f'folha {i + 1}: "vao.margem" = {vao.get("margem")} m é a espessura da parede que sobra; o usual é 0,2 a 0,5')
        if 'colide' in f and not isinstance(f['colide'], bool): erros.append(f'folha {i + 1}: "colide" deve ser true ou false')
    for i, q in enumerate(d.get('decalques') or []):
        if not isinstance(q, dict) or not q.get('imagem') or not os.path.exists(os.path.join(RAIZ, q.get('imagem', ''))): erros.append(f'decalque {i + 1}: "imagem" não encontrada'); continue
        if not all(isinstance(q.get(k), (int, float)) for k in ('x', 'y', 'largura')): erros.append(f'decalque {i + 1}: precisa de "x", "y" (pixels da planta) e "largura" (metros)')
    for nome, t in (d.get('texturas') or {}).items():
        if not isinstance(t, dict) or not t.get('imagem') or not os.path.exists(os.path.join(RAIZ, t.get('imagem', ''))): erros.append(f'textura "{nome}": "imagem" não encontrada')
    for i, pz in enumerate(d.get('pisos') or []):
        if not contorno_de(pz) if isinstance(pz, dict) else True: erros.append(f'piso {i + 1}: precisa de "pontos" [[x, y], ...] ou "area" [x0, y0, x1, y1]')
        elif not pz.get('acabamento'): erros.append(f'piso {i + 1}: falta o "acabamento" (o nome da textura)')
    # Árvore, poste ou peça alta logo na frente de uma câmera tampa a vista.
    ALTAS = ('arvore', 'pinheiro', 'palmeira', 'poste', 'torreTrelica', 'casa', 'torreAndares', 'veiculo', 'container', 'chafariz')
    for i, c in enumerate(d.get('cameras', [])):
        if not (isinstance(c.get('de'), list) and isinstance(c.get('para'), list)): continue
        de, para = c['de'], c['para']; dx, dy = para[0] - de[0], para[1] - de[1]; n = math.hypot(dx, dy) or 1
        for m in d.get('moveis', []):
            if m.get('tipo') not in ALTAS or not isinstance(m.get('x'), (int, float)): continue
            t = ((m['x'] - de[0]) * dx + (m['y'] - de[1]) * dy) / n
            lado_ = abs((m['x'] - de[0]) * dy - (m['y'] - de[1]) * dx) / n
            raio = max(m.get('r', 0.5), m.get('w', 1) / 2) / E + 0.6 / E
            if 0 < t < min(n, 12 / E) and lado_ < raio:
                avisos.append(f'câmera {i + 1} ({c.get("nome")}): {m["tipo"]} logo na frente, a {t * E:.0f} m; mova a câmera ou a peça'); break
        for f in d.get('folhas') or []:
            fr = f.get('frente')
            if not fr or not isinstance(f.get('x'), (int, float)): continue
            la = f.get('lado') or fr; w = f.get('largura', 20); hh = w * (fr[3] - fr[1]) / (fr[2] - fr[0])
            dp = f.get('profundidade') or hh * (la[2] - la[0]) / (la[3] - la[1]); g = math.radians(f.get('giro', 0))
            ux, uy = de[0] - f['x'], de[1] - f['y']; lx = ux * math.cos(g) - uy * math.sin(g); ly = ux * math.sin(g) + uy * math.cos(g)
            if abs(lx) < w / 2 / E and abs(ly) < dp / 2 / E: avisos.append(f'câmera {i + 1} ({c.get("nome")}): está dentro de um prédio de folha'); break
    if d.get('hora') not in (None, 'dia', 'noite', 'entardecer'): erros.append('"hora" deve ser "dia", "entardecer" ou "noite"')
    if d.get('hora') and not d.get('ceuAberto'): avisos.append('"hora" só vale com "ceuAberto": true (um interior não tem sol)')
    if 'luar' in d:
        if not isinstance(d['luar'], (int, float)) or not (0 <= d['luar'] <= 1): erros.append('"luar" deve ser um número de 0 a 1 (0,2 = noite bem escura; 1 = o padrão)')
        elif not d.get('ceuAberto'): avisos.append('"luar" só vale com "ceuAberto": true')
    if d.get('lua') is not None:
        lua = d['lua']
        if not (isinstance(lua, dict) and isinstance(lua.get('azimute', 0), (int, float)) and isinstance(lua.get('altura', 30), (int, float))): erros.append('"lua" deve ser { "azimute": graus a partir do norte, "altura": graus acima do horizonte }')
        elif not (0 <= lua.get('altura', 30) <= 90): erros.append('"lua.altura" vai de 0 (no horizonte) a 90 (bem em cima)')
    if d.get('imagemPlanta') and not os.path.exists(os.path.join(RAIZ, d['imagemPlanta'])): erros.append(f'"imagemPlanta": arquivo não encontrado ({d["imagemPlanta"]})')
    if 'criaturas' in d:
        cr = d['criaturas']
        if not (isinstance(cr, list) and all(isinstance(c, str) for c in cr)): erros.append('"criaturas" deve ser uma lista de ids: ["explorador", "lobo"]')
        elif CRIATURAS is None: avisos.append('"criaturas" só faz efeito com uma campanha (src/campanha.js) que tenha MONSTROS ou PERSONAGENS; sem ela, o painel fica vazio de qualquer jeito')
        else:
            faltam = [c for c in cr if c not in CRIATURAS]
            if faltam: avisos.append(f'"criaturas": {", ".join(faltam)} não existe em MONSTROS nem em PERSONAGENS da campanha; não aparece no painel')
    if d.get('clima') not in (None, 'neve', 'petalas'): erros.append('"clima" deve ser "neve" ou "petalas"')
    # Luz, câmera ou chegada dentro de um volume fechado não serve para nada.
    def no_predio(x, y):
        for pr in d.get('predios') or []:
            r = pr.get('area') if isinstance(pr, dict) else None
            f = pr.get('fachada', 0) if isinstance(pr.get('fachada', 0), (int, float)) else 0  # com fachada, o volume desce para o pé dela
            if isinstance(r, list) and len(r) == 4 and min(r[0], r[2]) < x < max(r[0], r[2]) and min(r[1], r[3]) + f < y < max(r[1], r[3]) + f: return True
        return False
    for i, l in enumerate(d.get('luzes', [])):
        if isinstance(l.get('x'), (int, float)) and no_predio(l['x'], l['y']): avisos.append(f'luz {i + 1}: está dentro de um prédio; ponha-a na rua')
    if d.get('chegada') and no_predio(*d['chegada']['de']): erros.append('a "chegada" está dentro de um prédio')
    for i, c in enumerate(d.get('cameras', [])):
        if isinstance(c.get('de'), list) and no_predio(*c['de']): avisos.append(f'câmera {i + 1} ({c.get("nome")}): está dentro de um prédio')
    ar = (d.get('teto') or {}).get('area')
    if ar is not None and not (isinstance(ar, list) and len(ar) == 4 and all(isinstance(v, (int, float)) for v in ar)): erros.append('"teto.area" deve ser [x0, y0, x1, y1], em pixels')
    if not luzes: avisos.append('o mapa não tem nenhuma luz; ficará escuro')
    for i, l in enumerate(luzes):
        if not dentro(l.get('x', -99), l.get('y', -99)): avisos.append(f'luz {i + 1}: fica fora da imagem')
        if l.get('forca', 0.15) > 0.6: avisos.append(f'luz {i + 1}: força {l["forca"]} é alta (o usual é 0,1 a 0,2)')
        if isinstance(l.get('x'), (int, float)) and na_parede(l['x'], l['y']): avisos.append(f'luz {i + 1}: está dentro de uma parede; ponha-a no cômodo, afastada da parede')
    for i, c in enumerate(d.get('cameras', [])):
        if not (isinstance(c.get('de'), list) and isinstance(c.get('para'), list)): erros.append(f'câmera {i + 1}: precisa de "de" e "para"')
    if not d.get('chegada'): avisos.append('sem "chegada": quem entra cai na primeira câmera em vez de chegar a pé')
    elif not ponto(d['chegada'].get('de')): erros.append('"chegada" precisa de "de": [x, y] (e "para": [x, y], para onde olha)')
    else:
        cx, cy = d['chegada'].get('de', [-1, -1])
        if not andavel(cx, cy): avisos.append(f'a chegada {[cx, cy]} fica a mais de 2 m fora da imagem: quem entra começa fora da área em que se anda (a imagem mais 2 m) e é puxado para dentro ao andar. Aumente o chão com ampliar.py se precisar de mais espaço')
        if ponto(d['chegada'].get('para')) and not andavel(*d['chegada']['para']): avisos.append('a chegada olha para um ponto a mais de 2 m fora da imagem; o programa traz o olhar para dentro e a vista sai torta')
        if sala_de(cx, cy): erros.append(f'a chegada fica dentro da sala oculta "{sala_de(cx, cy)}"; quem entra apareceria numa sala que ainda está escondida')
        if na_parede(cx, cy): erros.append('a chegada fica dentro de uma parede')
    for i, c in enumerate(d.get('cameras', [])):
        if isinstance(c.get('de'), list) and na_parede(*c['de']): avisos.append(f'câmera {i + 1} ({c.get("nome", "")}): o ponto "de" fica dentro de uma parede')
        # Câmera de fora (do mar, do alto) é normal; o que o programa corta é o ponto olhado, e aí puxa a câmera junto.
        if ponto(c.get('para')) and not andavel(*c['para']): avisos.append(f'câmera {i + 1} ({c.get("nome", "")}): olha para um ponto a mais de 2 m fora da imagem; o programa traz esse ponto (e a câmera) para dentro e a vista muda')
    for i, p in enumerate(d.get('passagens', [])):
        if isinstance(p.get('x'), (int, float)) and isinstance(p.get('y'), (int, float)) and not andavel(p['x'], p['y']): avisos.append(f'passagem {i + 1} ({p.get("nome", "")}): fica a mais de 2 m fora da imagem, onde ninguém chega')
    if d.get('grades') and len(d['grades']) >= 4: avisos.append('há várias grades: confira se a área que elas cercam tem uma abertura (grade não abre)')
    # O programa lê os exemplos (indice.json) e os mapas da pessoa (indice_local.json).
    listados = []
    for nome_indice in ('indice.json', 'indice_local.json'):
        try: listados += json.load(open(os.path.join(RAIZ, 'mapas', nome_indice), encoding='utf-8')).get('mapas', [])
        except (OSError, ValueError): pass
    ids = set()
    for n in listados:
        try: ids.add(json.load(open(os.path.join(RAIZ, 'mapas', n), encoding='utf-8')).get('id'))
        except (OSError, ValueError): pass
    ids |= INTERIORES_CODIGO   # interiores escritos em código pela campanha, se houver
    if not d.get('passagens') and d.get('local'): avisos.append('sem "passagens": não há como sair do mapa por dentro dele (só pelo botão Sair)')
    for i, p in enumerate(d.get('passagens', [])):
        dst = p.get('destino', {})
        if dst.get('mapa') and dst['mapa'] not in ids and dst['mapa'] != d['id']: avisos.append(f'passagem {i + 1}: leva ao mapa "{dst["mapa"]}", que não está em mapas/indice_local.json')
        if dst.get('local') and dst['local'] not in LOCAIS: avisos.append(f'passagem {i + 1}: local desconhecido "{dst["local"]}"')
    if d.get('local') and d['local'] not in LOCAIS: avisos.append(f'"local" desconhecido: {d["local"]}')
    if os.path.basename(caminho) not in listados: avisos.append('o arquivo ainda não está listado em mapas/indice_local.json (sem isso ele não aparece)')
    # Desafios: peças com "desafio" (e "fase": "antes"; sem ela, "depois") e a lista "desafios" (ordem e verbo).
    usados = {}
    for campo in ('folhas', 'moveis', 'luzes'):
        for i, o in enumerate(d.get(campo) or []):
            if isinstance(o, dict) and o.get('desafio'):
                if o.get('fase') not in (None, 'antes', 'depois'): erros.append(f'{campo} {i + 1}: "fase" deve ser "antes" ou "depois"')
                usados.setdefault(str(o['desafio']), set()).add(o.get('fase') or 'depois')
    for x in d.get('desafios') or []:
        if not isinstance(x, dict) or not x.get('nome'): erros.append('cada item de "desafios" precisa de "nome": { "nome": "Cabana 1" }'); continue
        if str(x.get('nome')) not in usados: avisos.append(f'o desafio "{x.get("nome")}" está em "desafios", mas nenhuma peça tem "desafio": "{x.get("nome")}"')
    for nome, fases in usados.items():
        if 'depois' not in fases: avisos.append(f'o desafio "{nome}" só tem peças de "antes": ao fazer, nada aparece no lugar')
    print('Lembrete: nenhuma ferramenta confere se a imagem é uma vista reta de cima; isso é com você (veja o Passo 0 em AGENTS.md).')
    extra = ''.join(f', {len(d[k])} {n}' for k, n in (('folhas', 'folhas'), ('predios', 'prédios'), ('plataformas', 'plataformas'), ('passagens', 'passagens')) if d.get(k))
    print(f'{d["id"]}: planta de {larg:.1f} x {prof:.1f} m; {len(paredes)} paredes, {len(d.get("portas", []))} portas, {len(salas)} salas ocultas, {len(d.get("moveis", []))} móveis, {len(luzes)} luzes{extra}')
    return erros, avisos


def conferir_indices():
    """As listas de mapas: arquivos que faltam, repetidos, ids iguais e mapas na pasta que nenhuma lista tem."""
    erros, avisos, listados = [], [], {}
    for nome in ('indice.json', 'indice_local.json'):
        caminho = os.path.join(RAIZ, 'mapas', nome)
        if not os.path.exists(caminho):
            if nome == 'indice.json': erros.append('falta mapas/indice.json (a lista dos exemplos)')
            continue
        try: lista = json.load(open(caminho, encoding='utf-8')).get('mapas', [])
        except ValueError as e: erros.append(f'mapas/{nome} não é um JSON válido: {e}'); continue
        if not isinstance(lista, list): erros.append(f'mapas/{nome}: "mapas" deve ser uma lista de nomes de arquivo'); continue
        for arq in lista:
            if arq in listados: avisos.append(f'{arq} está em mapas/{listados[arq]} e em mapas/{nome}; basta uma lista')
            elif not os.path.exists(os.path.join(RAIZ, 'mapas', str(arq))): erros.append(f'mapas/{nome} lista "{arq}", que não existe na pasta mapas/')
            listados.setdefault(arq, nome)
    ids = {}
    for arq in listados:
        try: i = json.load(open(os.path.join(RAIZ, 'mapas', arq), encoding='utf-8')).get('id')
        except (OSError, ValueError): continue
        if i in ids: erros.append(f'{arq} e {ids[i]} têm o mesmo id "{i}"; só um deles abre')
        ids.setdefault(i, arq)
    for arq in sorted(os.listdir(os.path.join(RAIZ, 'mapas'))):
        if arq.endswith('.json') and arq not in listados and not arq.startswith('indice'):
            avisos.append(f'mapas/{arq} não está em nenhuma lista: não aparece no programa (acrescente em mapas/indice_local.json)')
    return erros, avisos, [a for a in listados if os.path.exists(os.path.join(RAIZ, 'mapas', a))]


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if len(sys.argv) < 2: sys.exit(__doc__)
    if sys.argv[1] == '--tudo':
        erros, avisos, mapas = conferir_indices(); com_erro = 0
        print('Listas de mapas: ' + ('sem problemas' if not erros and not avisos else f'{len(erros)} erros, {len(avisos)} avisos'))
        for e in erros: print('ERRO  ', e)
        for a in avisos: print('AVISO ', a)
        import io, contextlib
        for arq in mapas:
            with contextlib.redirect_stdout(io.StringIO()): e_, a_ = conferir(os.path.join(RAIZ, 'mapas', arq))
            com_erro += bool(e_)
            print(f'{arq}: ' + ('ok' if not e_ and not a_ else f'{len(e_)} erros, {len(a_)} avisos'))
            for e in e_: print('  ERRO  ', e)
            for a in a_: print('  AVISO ', a)
        print(f'{len(mapas)} mapas conferidos; {com_erro} com erro.')
        sys.exit(1 if erros or com_erro else 0)
    erros, avisos = conferir(sys.argv[1])
    for e in erros: print('ERRO  ', e)
    for a in avisos: print('AVISO ', a)
    if not erros and not avisos: print('Nenhum problema encontrado.')
    sys.exit(1 if erros else 0)
