"""Leitura de uploads com limite de tamanho.

Antes, cada rota fazia `await arquivo.read()`, que carrega o arquivo INTEIRO na
memória, e só depois comparava com o limite (10 ou 15 MB). Um arquivo de vários
GB derrubaria o servidor antes da checagem.

Duas camadas:
1. LimiteCorpoMiddleware recusa logo de cara (413) requisições cujo
   Content-Length passa do maior limite aceito, antes de o arquivo ser recebido.
2. ler_com_limite() lê em blocos e para assim que passa do limite da rota,
   devolvendo no máximo `maximo + 1` bytes. A rota continua usando a própria
   checagem `len(conteudo) > MAXIMO`, com as mesmas mensagens de antes.
"""
import json

from fastapi import UploadFile

_BLOCO = 1024 * 1024  # 1 MB por leitura

# Maior arquivo aceito hoje é 15 MB (PDF de CNH/exame). A folga cobre os campos
# do formulário multipart que vão junto com o arquivo.
LIMITE_CORPO_REQUISICAO = 20 * 1024 * 1024


async def ler_com_limite(arquivo: UploadFile, maximo: int) -> bytes:
    partes = []
    total = 0
    while True:
        bloco = await arquivo.read(_BLOCO)
        if not bloco:
            break
        partes.append(bloco)
        total += len(bloco)
        if total > maximo:
            break  # já passou do limite: a rota vai recusar, não precisa ler o resto
    return b"".join(partes)


class LimiteCorpoMiddleware:
    """Recusa (413) requisições declaradas maiores que o limite, antes de recebê-las."""

    def __init__(self, app, limite: int = LIMITE_CORPO_REQUISICAO):
        self.app = app
        self.limite = limite

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            for nome, valor in scope.get("headers", []):
                if nome == b"content-length":
                    try:
                        tamanho = int(valor)
                    except ValueError:
                        tamanho = 0
                    if tamanho > self.limite:
                        await self._recusar(send)
                        return
                    break
        await self.app(scope, receive, send)

    async def _recusar(self, send) -> None:
        corpo = json.dumps(
            {"detail": f"Arquivo muito grande. O limite é de {self.limite // (1024 * 1024)} MB por envio."},
            ensure_ascii=False,
        ).encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json; charset=utf-8"),
                (b"content-length", str(len(corpo)).encode()),
            ],
        })
        await send({"type": "http.response.body", "body": corpo})
