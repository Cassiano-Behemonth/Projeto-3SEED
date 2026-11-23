#!/usr/bin/env python3
"""Tira uma foto do mapa em 3D, sem abrir janela, para conferir o resultado de verdade.

Uso:
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png                       # vista de planta (câmera 0)
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --camera 1 --camera 3  # câmeras do mapa: grava saida_cam1.png, saida_cam3.png
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --de 700 900 --para 700 400 --altura 1.75
      (de onde e para onde olhar, em pixels da planta; altura em metros acima do piso. Pode repetir --de/--para/--altura;
       com várias vistas, grava saida_vista1.png, saida_vista2.png... na ordem em que foram pedidas.)
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --noite     # de noite (padrão: como o mapa abre; --dia força o dia)
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --revelar   # abre todas as portas e mostra as salas ocultas
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --paredes-baixas   # paredes baixas só na vista de planta (câmera 0), para ela não ficar escondida atrás de paredes e pilares altos

  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --porta 5174   # se a 5173 estiver ocupada por outro programa
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --espera 600   # mapa enorme: espera até 600 s (padrão 180)

Câmera 0 é a vista de planta; 1 é a primeira de "cameras", e assim por diante. Sem --camera, vem a de planta.
Com uma vista só, a foto tem exatamente o nome pedido (sem o sufixo _cam0). Se o arquivo já existe, ele é substituído e a ferramenta avisa. Com várias, o nome diz qual é cada uma (saida_cam0.png,
saida_cam2.png, saida_vista1.png), e a saída lista o nome de cada câmera.
Precisa do Google Chrome, do Chromium ou do Microsoft Edge instalado. Se o servidor local não estiver no ar, a ferramenta o liga
durante a foto e desliga depois. Cada foto leva de 10 a 20 segundos.

Olhe a foto: é ela que mostra o que a prévia 2D não mostra (alturas, telhados, peças viradas, o que ficou feio).
"""
import json, os, shutil, subprocess, sys, tempfile
from grade import opcao, opcoes
from imagem import ler_png
from navegador import RAIZ, achar_chrome, ServidorLocal, rodar_chrome


def parece_vazia(caminho):
    """Foto quase uniforme (tela preta ou "Carregando…"): o mapa não terminou de carregar antes de o navegador tirá-la."""
    try: _, _, rgb = ler_png(caminho)
    except SystemExit: return False
    amostra = rgb[::997]
    if not amostra: return False
    media = sum(amostra) / len(amostra)
    return sum((v - media) ** 2 for v in amostra) / len(amostra) < 60


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if len(a) < 2: sys.exit(__doc__)
    d = json.load(open(a[0], encoding='utf-8')); mapa = d['id']
    # O programa lê os exemplos (indice.json) e os mapas da pessoa (indice_local.json); o mapa precisa estar num dos dois.
    indice = []
    for nome in ('indice.json', 'indice_local.json'):
        caminho = os.path.join(RAIZ, 'mapas', nome)
        if os.path.exists(caminho): indice += json.load(open(caminho, encoding='utf-8')).get('mapas', [])
    if os.path.basename(a[0]) not in indice: sys.exit(f'O mapa precisa estar em mapas/indice_local.json para abrir no programa (acrescente "{os.path.basename(a[0])}").')
    porta = int(opcao(a, '--porta', 1, [5173])[0]); base = f'http://127.0.0.1:{porta}'
    larg, alt = [int(v) for v in opcao(a, '--tamanho', 2, [1280, 720])]
    espera = int(opcao(a, '--espera', 1, [180])[0])
    fixos = '&foto=1' + ('&noite=1' if '--noite' in a else '&dia=1' if '--dia' in a else '') + ('&revelar=1' if '--revelar' in a else '')
    cams = d.get('cameras') or []
    if '--paredes-baixas' not in a and (d.get('alturaParede') or 3) > 4.5 and not ('--camera' in a or '--de' in a): print(f'Dica: as paredes têm {d.get("alturaParede")} m e podem esconder a planta na foto de cima; tente --paredes-baixas.')
    def nome_cam(n): return 'vista de planta' if n == 0 else (cams[n - 1].get('nome') or f'câmera {n}') if 0 < n <= len(cams) else f'câmera {n} (o mapa não tem)'
    vistas = [(f'&ang={int(c[0])}', f'cam{int(c[0])}', nome_cam(int(c[0]))) for c in opcoes(a, '--camera', 1)]
    des, paras, alts = opcoes(a, '--de', 2), opcoes(a, '--para', 2), opcoes(a, '--altura', 1)
    if len(des) != len(paras): sys.exit('Cada --de precisa do seu --para.')
    for i, (de, para) in enumerate(zip(des, paras)):
        h = alts[i][0] if i < len(alts) else 1.75
        vistas.append((f'&ang=0&de={de[0]:g},{de[1]:g}&para={para[0]:g},{para[1]:g}&altura={h:g}', f'vista{i + 1}',
                       f'de {de[0]:g},{de[1]:g} para {para[0]:g},{para[1]:g}, a {h:g} m'))
    if not vistas: vistas = [('&ang=0', 'cam0', nome_cam(0))]
    chrome = achar_chrome()
    with ServidorLocal(porta, fixa='--porta' in a) as srv:
        base = srv.base
        perfil = tempfile.mkdtemp(prefix='mapa3d-foto-'); raiz, ext = os.path.splitext(a[1])
        try:
            for v, sufixo, descricao in vistas:
                saida = os.path.abspath(a[1] if len(vistas) == 1 else f'{raiz}_{sufixo}{ext}')
                os.makedirs(os.path.dirname(saida), exist_ok=True)   # quem grava é o Chrome, que não cria a pasta
                if os.path.exists(saida): print(f'Aviso: {saida} já existia e foi substituída.'); os.remove(saida)
                # --paredes-baixas vale só para a vista de planta (câmera 0); as vistas do chão precisam das paredes inteiras.
                url = f'{base}/?mapa={mapa}{v}{fixos}' + ('&baixas=1' if '--paredes-baixas' in a and sufixo == 'cam0' else '')
                try:
                    # Se a foto sair vazia (o mapa ainda carregava), tenta de novo dando mais tempo à página, até três vezes.
                    orc = 30000
                    for tentativa in range(3):
                        r = rodar_chrome(chrome, url, [f'--screenshot={saida}'], perfil, espera=espera, tamanho=(larg, alt), orcamento=orc)
                        if not os.path.exists(saida) or not parece_vazia(saida): break
                        if tentativa < 2:
                            orc *= 2; print(f'A foto saiu vazia (o mapa ainda carregava); tentando de novo com mais tempo ({orc // 1000} s)...'); os.remove(saida)
                        else: print('Aviso: a foto continua quase uniforme. Se for uma tela de "Carregando…", use --espera maior ou confira no navegador.')
                except subprocess.TimeoutExpired:
                    sys.exit(f'O mapa levou mais de {espera} s para a foto sem janela. Mapas muito grandes (milhares de árvores, como uma mata '
                             f'inteira) passam disso, porque sem janela o desenho é feito pelo processador. Tente --espera 600, ou confira no '
                             f'navegador: python3 servidor.py e abra {base}/?mapa={mapa}')
                if not os.path.exists(saida):
                    do_chrome = (r.stdout + r.stderr).decode('utf-8', 'replace')
                    dica = f'\nA conexão com o servidor local foi recusada: outro programa pode estar usando a porta {porta}. Tente --porta {porta + 18}.' if 'ERR_CONNECTION_REFUSED' in do_chrome else ''
                    sys.exit('O navegador não gravou a foto. Saída dele:\n' + do_chrome[-600:] + dica)
                print(f'{saida}: {larg} x {alt} px ({descricao})')
        finally:
            shutil.rmtree(perfil, ignore_errors=True)


if __name__ == '__main__':
    main()
