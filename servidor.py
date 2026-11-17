#!/usr/bin/env python3
"""Servidor local do mapa 3D (sem cache, para as alterações aparecerem ao recarregar).

Uso: python3 servidor.py  ->  abra http://127.0.0.1:5173  (página inicial; o programa fica em /index.html e o editor em /editor.html)

Além de servir os arquivos, aceita dois pedidos do editor de mapas:
  POST /api/mapa            grava mapas/<id>.json e acrescenta o nome em mapas/indice.json
  POST /api/imagem?nome=X   grava a imagem enviada em assets/interiores/X
Só escuta em 127.0.0.1, ou seja, só o próprio computador consegue gravar.
"""
import http.server
import json
import os
import re
import sys
from urllib.parse import parse_qs, urlparse

PORTA = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
RAIZ = os.path.dirname(os.path.abspath(__file__))
ID_VALIDO = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
IMAGEM_VALIDA = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{0,80}\.(png|jpg|jpeg|webp)$")
LIMITE = 40 * 1024 * 1024


class Servidor(http.server.SimpleHTTPRequestHandler):
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
                with open(os.path.join(RAIZ, "assets", "interiores", nome), "wb") as f:
                    f.write(corpo)
                return self._responder(200, {"ok": True, "caminho": "assets/interiores/" + nome})
        except (ValueError, OSError) as e:
            return self._responder(400, {"erro": str(e)})
        self._responder(404, {"erro": "pedido desconhecido"})


if __name__ == "__main__":
    os.chdir(RAIZ)
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORTA), Servidor) as srv:
        print(f"Projeto 3SEED em http://127.0.0.1:{PORTA}  (página inicial; programa em /index.html, editor em /editor.html; Ctrl+C para encerrar)")
        srv.serve_forever()
