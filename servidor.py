#!/usr/bin/env python3
"""Servidor local do mapa 3D (sem cache, para as alterações aparecerem ao recarregar).

Uso: python3 servidor.py  ->  abra http://127.0.0.1:5173  (página inicial; o programa fica em /index.html e o editor em /editor.html)
     python3 servidor.py 5174  ->  numa porta escolhida. Sem número, se a 5173 estiver ocupada por outro programa, ele
                                   usa a próxima livre e diz qual. (No Windows, troque python3 por py.)

Além de servir os arquivos, aceita dois pedidos do editor de mapas:
  POST /api/mapa            grava mapas/<id>.json e acrescenta o nome em mapas/indice_local.json (a lista dos seus mapas)
  POST /api/imagem?nome=X   grava a imagem enviada em assets/interiores/X
Só escuta em 127.0.0.1, ou seja, só o próprio computador consegue gravar.
"""
import http.server
import json
import os
import re
import socket
import sys
from urllib.parse import parse_qs, urlparse

RAIZ = os.path.dirname(os.path.abspath(__file__))
ID_VALIDO = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
IMAGEM_VALIDA = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}\.(png|jpg|jpeg|webp)$")
LIMITE = 40 * 1024 * 1024

# Tipos fixos: o Python pergunta ao sistema o tipo de cada arquivo, e no Windows o registro às vezes diz que .js é
# "text/plain" (comum depois de instalar o Visual Studio). Aí o navegador se recusa a rodar o programa e a página fica
# em branco. Com esta lista, a resposta é sempre a mesma, em qualquer computador.
TIPOS = {
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/plain; charset=utf-8",
    ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon", ".webm": "video/webm",
    ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".glb": "model/gltf-binary", ".gltf": "model/gltf+json", ".wasm": "application/wasm",
}

# A saída sai em UTF-8 (com acentos) mesmo quando vai para outro programa, como um assistente de IA no terminal.
if not os.environ.get("PYTHONIOENCODING"):
    for _f in (sys.stdout, sys.stderr):
        try: _f.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError): pass


class Servidor(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        return TIPOS.get(os.path.splitext(str(path))[1].lower()) or super().guess_type(path)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass

    def do_GET(self):
        # O endereço sem nada depois da barra abre a página inicial (explicações); com parâmetros (?mapa=..., ?tela=1),
        # abre o programa direto, como sempre.
        url = urlparse(self.path)
        if url.path == "/" and not url.query:
            self.path = "/inicio.html"
        return super().do_GET()

    def _responder(self, codigo, corpo):
        dados = json.dumps(corpo, ensure_ascii=False).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(dados)))
        self.end_headers()
        self.wfile.write(dados)

    def do_POST(self):
        url = urlparse(self.path)
        tamanho = int(self.headers.get("Content-Length") or 0)
        if tamanho <= 0 or tamanho > LIMITE:
            return self._responder(400, {"erro": "pedido vazio ou grande demais"})
        corpo = self.rfile.read(tamanho)
        try:
            if url.path == "/api/mapa":
                mapa = json.loads(corpo.decode("utf-8"))
                ident = str(mapa.get("id", ""))
                if not ID_VALIDO.match(ident):
                    return self._responder(400, {"erro": "id inválido: use letras minúsculas, números, _ e -"})
                arquivo = ident + ".json"
                with open(os.path.join(RAIZ, "mapas", arquivo), "w", encoding="utf-8") as f:
                    json.dump(mapa, f, ensure_ascii=False, indent=2)
                    f.write("\n")
                # Mapa novo vai para a lista local (mapas/indice_local.json, fora do git); mapas/indice.json é só a dos
                # exemplos que vêm com o programa. Um exemplo editado continua onde está.
                def ler_indice(nome):
                    try:
                        with open(os.path.join(RAIZ, "mapas", nome), encoding="utf-8") as f:
                            return json.load(f)
                    except (OSError, ValueError):
                        return {"mapas": []}
                if arquivo in ler_indice("indice.json").get("mapas", []):
                    return self._responder(200, {"ok": True, "arquivo": "mapas/" + arquivo})
                caminho_indice = os.path.join(RAIZ, "mapas", "indice_local.json")
                indice = ler_indice("indice_local.json")
                if arquivo not in indice.setdefault("mapas", []):
                    indice["mapas"].append(arquivo)
                    with open(caminho_indice, "w", encoding="utf-8") as f:
                        json.dump(indice, f, ensure_ascii=False, indent=2)
                        f.write("\n")
                return self._responder(200, {"ok": True, "arquivo": "mapas/" + arquivo})
            if url.path == "/api/imagem":
                nome = (parse_qs(url.query).get("nome") or [""])[0]
                if not IMAGEM_VALIDA.match(nome):
                    return self._responder(400, {"erro": "nome de imagem inválido (use letras, números, _ . - e extensão png, jpg ou webp)"})
                os.makedirs(os.path.join(RAIZ, "assets", "interiores"), exist_ok=True)
                with open(os.path.join(RAIZ, "assets", "interiores", nome), "wb") as f:
                    f.write(corpo)
                return self._responder(200, {"ok": True, "caminho": "assets/interiores/" + nome})
        except (ValueError, OSError) as e:
            return self._responder(400, {"erro": str(e)})
        self._responder(404, {"erro": "pedido desconhecido"})


class Escuta(http.server.ThreadingHTTPServer):
    # No Windows, "reaproveitar o endereço" deixa dois programas ouvirem a mesma porta sem erro (e os pedidos vão parar
    # no outro); lá a porta tem de ser só nossa.
    allow_reuse_address = os.name != "nt"
    def server_bind(self):
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def abrir(porta):
    try: return Escuta(("127.0.0.1", porta), Servidor)
    except OSError: return None


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"): print(__doc__); sys.exit(0)
    if len(sys.argv) > 1 and not sys.argv[1].isdigit(): sys.exit(f"Porta inválida: {sys.argv[1]}. Use um número: python3 servidor.py 8080")
    PORTA_ESCOLHIDA = int(sys.argv[1]) if len(sys.argv) > 1 else None
    os.chdir(RAIZ)
    if PORTA_ESCOLHIDA is not None:
        srv = abrir(PORTA_ESCOLHIDA)
        if srv is None: sys.exit(f"A porta {PORTA_ESCOLHIDA} está ocupada por outro programa. Escolha outra: python3 servidor.py {PORTA_ESCOLHIDA + 1}")
    else:
        srv = None
        for porta in range(5173, 5190):
            srv = abrir(porta)
            if srv: break
            print(f"A porta {porta} está ocupada por outro programa; tentando a próxima.", flush=True)
        if srv is None: sys.exit("As portas de 5173 a 5189 estão ocupadas. Escolha outra: python3 servidor.py 8080")
    porta = srv.server_address[1]
    with srv:
        print(f"Projeto 3SEED em http://127.0.0.1:{porta}  (página inicial; programa em /index.html, editor em /editor.html; Ctrl+C para encerrar)", flush=True)
        try: srv.serve_forever()
        except KeyboardInterrupt: print("Servidor encerrado.")
