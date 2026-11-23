#!/usr/bin/env python3
"""Confere a campanha (src/campanha.js): criaturas, personagens e objetos 3D.

Uso:
  python3 ferramentas/validar_campanha.py

Aponta ERROS (a figura não aparece, sai sem pose, o painel quebra) e AVISOS (provável engano): id repetido, imagem ou
vídeo que não existe, medidas w e h que não batem com a imagem, quadro sem "alt", pose citada que não existe, campo com
nome errado, retângulos fora do atlas de um objeto, veículo que leva quem não existe, mapa que cita criatura que não há.
Termina com código 1 se houver erro.

A conferência roda no navegador, com o arquivo de verdade (é o mesmo que abrir http://127.0.0.1:5173/conferir.html).
Precisa do Google Chrome, do Chromium ou do Edge. Sem src/campanha.js, não há o que conferir.
"""
import os, sys
from grade import opcao
from navegador import RAIZ, ServidorLocal, ler_pagina


def main():
    a = sys.argv[1:]
    if a and a[0] in ('-h', '--help'): print(__doc__); sys.exit(0)
    if not os.path.exists(os.path.join(RAIZ, 'src', 'campanha.js')):
        print('Não há src/campanha.js: nada a conferir (veja "Como acrescentar cada coisa" no README).'); return
    porta = int(opcao(a, '--porta', 1, [5173])[0])
    with ServidorLocal(porta, fixa='--porta' in a) as srv:
        texto = ler_pagina(srv.base + '/conferir.html')
    if texto is None: sys.exit('A página de conferência não respondeu. Abra http://127.0.0.1:5173/conferir.html no navegador para ver o que houve.')
    erros = avisos = 0; total = 0
    for l in texto.splitlines():
        if l.startswith('TOTAL '): total = int(l.split()[1])
        elif l.startswith('ERRO '): erros += 1; print('ERRO  ', l[5:])
        elif l.startswith('AVISO '): avisos += 1; print('AVISO ', l[6:])
    print(f'{total} criaturas, personagens e objetos conferidos: ' + ('nenhum problema.' if not erros and not avisos else f'{erros} erros, {avisos} avisos.'))
    sys.exit(1 if erros else 0)


if __name__ == '__main__':
    main()
