"""Apoio das ferramentas que usam o navegador sem janela (foto.py, validar_campanha.py, testar.py): achar o Chrome (ou
Chromium, ou Edge), ligar o servidor local numa porta livre e abrir uma página sem janela."""
import html, os, re, shutil, socket, subprocess, sys, tempfile, time, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Chrome, Chromium ou Edge (o Edge é Chromium e vem em todo Windows); o primeiro que existir.
CHROMES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
           '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
           'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable',
           r'C:\Program Files\Google\Chrome\Application\chrome.exe', r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
           os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
           r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', r'C:\Program Files\Microsoft\Edge\Application\msedge.exe']


def achar_chrome(obrigatorio=True):
    for c in CHROMES:
        if os.path.isfile(c): return c
        w = shutil.which(c)
        if w: return w
    if obrigatorio: sys.exit('Não achei o Google Chrome, o Chromium nem o Edge. Instale um deles; a prévia 2D (previa.py) continua funcionando sem eles.')
    return None


def no_ar(base):
    """O nosso servidor (ou outro que sirva a pasta do projeto) responde nesse endereço?"""
    try: urllib.request.urlopen(base + '/mapas/indice.json', timeout=2).read(); return True
    except Exception: return False


def ocupada(porta):
    """Algum programa já atende nessa porta?"""
    with socket.socket() as s:
        s.settimeout(0.5)
        return s.connect_ex(('127.0.0.1', porta)) == 0


class ServidorLocal:
    """Usa o servidor que já está no ar ou liga um (e desliga ao sair). Se a porta pedida estiver ocupada por outro
    programa e não foi escolhida à mão, usa a próxima livre."""
    def __init__(self, porta=5173, fixa=False, avisar=True):
        self.porta, self.fixa, self.avisar, self.proc = porta, fixa, avisar, None

    def __enter__(self):
        base = f'http://127.0.0.1:{self.porta}'
        if not no_ar(base) and ocupada(self.porta) and not self.fixa:
            livre = next(p for p in range(self.porta + 1, self.porta + 40) if not ocupada(p))
            if self.avisar: print(f'A porta {self.porta} está ocupada por outro programa; usando a {livre}.')
            self.porta = livre; base = f'http://127.0.0.1:{livre}'
        if not no_ar(base):
            self.proc = subprocess.Popen([sys.executable, os.path.join(RAIZ, 'servidor.py'), str(self.porta)], cwd=RAIZ,
                                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            for _ in range(40):
                if no_ar(base): break
                time.sleep(0.25)
            else:
                self.proc.terminate(); sys.exit(f'Não consegui ligar o servidor local na porta {self.porta} (python3 servidor.py {self.porta}).')
        self.base = base
        return self

    def __exit__(self, *_):
        if self.proc: self.proc.terminate()


def rodar_chrome(chrome, url, extra, perfil, espera=180, tamanho=(1280, 720), orcamento=30000):
    """Abre a página sem janela. extra: ['--screenshot=arq'] ou ['--dump-dom']. orcamento: tempo virtual da página, em ms."""
    return subprocess.run([chrome, '--headless=new', f'--user-data-dir={perfil}', '--no-first-run', '--hide-scrollbars', '--mute-audio',
                           f'--window-size={tamanho[0]},{tamanho[1]}', f'--virtual-time-budget={orcamento}'] + extra + [url],
                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=espera)


def ler_pagina(url, chrome=None, espera=300, orcamento=120000, tamanho=(1280, 900)):
    """O texto de <pre id="resultado"> da página, depois de ela rodar (as páginas de teste e de conferência escrevem ali)."""
    chrome = chrome or achar_chrome()
    perfil = tempfile.mkdtemp(prefix='mapa3d-teste-')
    try: r = rodar_chrome(chrome, url, ['--dump-dom'], perfil, espera=espera, tamanho=tamanho, orcamento=orcamento)
    finally: shutil.rmtree(perfil, ignore_errors=True)
    m = re.search(r'<pre id="resultado"[^>]*>(.*?)</pre>', r.stdout.decode('utf-8', 'replace'), re.S)
    return html.unescape(m.group(1)) if m else None
