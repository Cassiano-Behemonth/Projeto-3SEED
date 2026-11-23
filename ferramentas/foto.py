#!/usr/bin/env python3
"""Tira uma foto do mapa em 3D, sem abrir janela, para conferir o resultado de verdade.

Uso:
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png                       # vista de planta (câmera 0)
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --camera 1 --camera 3  # câmeras do mapa: grava saida_1.png, saida_2.png
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --de 700 900 --para 700 400 --altura 1.75
      (de onde e para onde olhar, em pixels da planta; altura em metros acima do piso. Pode repetir --de/--para/--altura.)
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --noite     # de noite (padrão: como o mapa abre; --dia força o dia)
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --revelar   # abre todas as portas e mostra as salas ocultas

  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --porta 5174   # se a 5173 estiver ocupada por outro programa
  python3 ferramentas/foto.py mapas/meu_mapa.json saida.png --espera 600   # mapa enorme: espera até 600 s (padrão 180)

Câmera 0 é a vista de planta; 1 é a primeira de "cameras", e assim por diante. Sem --camera, vem a de planta.
Precisa do Google Chrome, do Chromium ou do Microsoft Edge instalado. Se o servidor local não estiver no ar, a ferramenta o liga
durante a foto e desliga depois. Cada foto leva de 10 a 20 segundos.

Olhe a foto: é ela que mostra o que a prévia 2D não mostra (alturas, telhados, peças viradas, o que ficou feio).
"""
import json, os, shutil, subprocess, sys, tempfile
from grade import opcao, opcoes
from navegador import RAIZ, achar_chrome, ServidorLocal, rodar_chrome


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
    vistas = [f'&ang={int(c[0])}' for c in opcoes(a, '--camera', 1)]
    des, paras, alts = opcoes(a, '--de', 2), opcoes(a, '--para', 2), opcoes(a, '--altura', 1)
    if len(des) != len(paras): sys.exit('Cada --de precisa do seu --para.')
    for i, (de, para) in enumerate(zip(des, paras)):
        h = alts[i][0] if i < len(alts) else 1.75
        vistas.append(f'&ang=0&de={de[0]:g},{de[1]:g}&para={para[0]:g},{para[1]:g}&altura={h:g}')
    if not vistas: vistas = ['&ang=0']
    chrome = achar_chrome()
    with ServidorLocal(porta, fixa='--porta' in a) as srv:
        base = srv.base
        perfil = tempfile.mkdtemp(prefix='mapa3d-foto-'); raiz, ext = os.path.splitext(a[1])
        try:
            for n, v in enumerate(vistas, 1):
                saida = os.path.abspath(a[1] if len(vistas) == 1 else f'{raiz}_{n}{ext}')
                os.makedirs(os.path.dirname(saida), exist_ok=True)   # quem grava é o Chrome, que não cria a pasta
                if os.path.exists(saida): os.remove(saida)
                url = f'{base}/?mapa={mapa}{v}{fixos}'
                try: r = rodar_chrome(chrome, url, [f'--screenshot={saida}'], perfil, espera=espera, tamanho=(larg, alt))
                except subprocess.TimeoutExpired:
                    sys.exit(f'O mapa levou mais de {espera} s para a foto sem janela. Mapas muito grandes (milhares de árvores, como uma mata '
                             f'inteira) passam disso, porque sem janela o desenho é feito pelo processador. Tente --espera 600, ou confira no '
                             f'navegador: python3 servidor.py e abra {base}/?mapa={mapa}')
                if not os.path.exists(saida): sys.exit('O navegador não gravou a foto. Saída dele:\n' + (r.stdout + r.stderr).decode('utf-8', 'replace')[-600:])
                print(f'{saida}: {larg} x {alt} px ({v.strip("&").replace("&", ", ")})')
        finally:
            shutil.rmtree(perfil, ignore_errors=True)


if __name__ == '__main__':
    main()
