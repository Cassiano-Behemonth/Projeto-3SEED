"""Conversões do formato de mapa usadas pelas ferramentas."""


def parede_de_faixa(f, escala):
    """Uma parede descrita pelo retângulo [x0, y0, x1, y1] que ela ocupa vira linha do meio + espessura.

    A parede 3D passa meia espessura além de cada ponta da linha; por isso a linha é recuada nessa medida,
    e a peça ocupa exatamente o retângulo. A linha corre ao longo do lado maior.
    """
    x0, x1 = sorted((f[0], f[2])); y0, y1 = sorted((f[1], f[3]))
    w, h = x1 - x0, y1 - y0
    if w >= h:
        m = min(h / 2, w / 2 - 1); yc = (y0 + y1) / 2
        return [round(x0 + m, 1), round(yc, 1), round(x1 - m, 1), round(yc, 1)], round(h * escala, 3)
    m = min(w / 2, h / 2 - 1); xc = (x0 + x1) / 2
    return [round(xc, 1), round(y0 + m, 1), round(xc, 1), round(y1 - m, 1)], round(w * escala, 3)


def normalizar(d, erros=None):
    """Troca, no próprio dicionário do mapa, cada parede com "faixa" pela forma com "p" e "esp"."""
    escala = d.get('escala') or 0
    for i, w in enumerate(d.get('paredes') or []):
        if not (isinstance(w, dict) and 'faixa' in w and 'p' not in w): continue
        f = w['faixa']
        if not (isinstance(f, list) and len(f) == 4 and all(isinstance(v, (int, float)) for v in f)) or abs(f[2] - f[0]) < 2 or abs(f[3] - f[1]) < 2:
            if erros is not None: erros.append(f'parede {i + 1}: "faixa" deve ser [x0, y0, x1, y1], o retângulo que a parede ocupa, com pelo menos 2 px de lado')
            continue
        w['p'], w['esp'] = parede_de_faixa(f, escala)
    # Linha quebrada: { "pontos": [[x, y], ...] } vira um segmento por trecho.
    lista = []
    for i, w in enumerate(d.get('paredes') or []):
        if isinstance(w, dict) and 'pontos' in w and 'p' not in w:
            pts = w['pontos']
            if not (isinstance(pts, list) and len(pts) >= 2 and all(isinstance(q, list) and len(q) == 2 for q in pts)):
                if erros is not None: erros.append(f'parede {i + 1}: "pontos" deve ser uma lista de pontos [x, y], com pelo menos dois')
                continue
            resto = {k: v for k, v in w.items() if k not in ('pontos', 'fechada')}
            n = len(pts)
            for j in range(n if w.get('fechada') else n - 1): lista.append({**resto, 'p': [pts[j][0], pts[j][1], pts[(j + 1) % n][0], pts[(j + 1) % n][1]]})
        else: lista.append(w)
    if d.get('paredes') is not None: d['paredes'] = lista
    return d


def contorno_de(pl):
    """Contorno de uma plataforma: "pontos" [[x, y], ...] ou "area" [x0, y0, x1, y1]."""
    if isinstance(pl.get('pontos'), list) and len(pl['pontos']) >= 3: return pl['pontos']
    a = pl.get('area')
    if isinstance(a, list) and len(a) == 4: return [[a[0], a[1]], [a[2], a[1]], [a[2], a[3]], [a[0], a[3]]]
    return None


def dentro_de(pts, x, y):
    dentro = False; j = len(pts) - 1
    for i in range(len(pts)):
        xi, yi = pts[i]; xj, yj = pts[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: dentro = not dentro
        j = i
    return dentro


def altura_do_piso(d, x, y):
    """Altura do piso (m) nesse ponto: a da plataforma mais alta que o contém, ou 0."""
    h = 0
    for pl in d.get('plataformas') or []:
        c = contorno_de(pl)
        if c and (pl.get('altura') or 0) > h and dentro_de(c, x, y): h = pl['altura']
    return h
