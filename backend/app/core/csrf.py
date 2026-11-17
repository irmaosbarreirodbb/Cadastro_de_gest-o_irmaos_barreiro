"""Proteção contra CSRF (requisições forjadas por outro site).

O cookie de sessão usa SameSite=None em produção (frontend e backend ficam em
domínios diferentes no Railway). Por isso o navegador envia o cookie mesmo quando
a requisição parte de outro site, por exemplo um formulário escondido numa
página maliciosa que faz upload de arquivo ou importa uma planilha em nome de
quem está logado.

A defesa: toda requisição que altera dados precisa do cabeçalho
X-Requested-With: XMLHttpRequest. O frontend já envia esse cabeçalho em todas as
chamadas (services/api.js). Um site de terceiros não consegue enviá-lo: um
formulário HTML não define cabeçalhos, e um fetch com cabeçalho próprio exige a
liberação prévia do CORS, que só é dada às origens da lista ALLOWED_ORIGINS.
"""
import json

METODOS_QUE_ALTERAM = {"POST", "PUT", "PATCH", "DELETE"}
CABECALHO = b"x-requested-with"
VALOR_ESPERADO = "xmlhttprequest"


class CSRFHeaderMiddleware:
    def __init__(self, app, prefixo: str = "/api/"):
        self.app = app
        self.prefixo = prefixo

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] == "http"
            and scope["method"] in METODOS_QUE_ALTERAM
            and scope["path"].startswith(self.prefixo)
            and not self._tem_cabecalho(scope)
        ):
            await self._recusar(send)
            return
        await self.app(scope, receive, send)

    @staticmethod
    def _tem_cabecalho(scope) -> bool:
        for nome, valor in scope.get("headers", []):
            if nome == CABECALHO:
                return valor.decode("latin-1").strip().lower() == VALOR_ESPERADO
        return False

    @staticmethod
    async def _recusar(send) -> None:
        corpo = json.dumps(
            {"detail": "Requisição recusada: origem não confirmada. Atualize a página e tente novamente."},
            ensure_ascii=False,
        ).encode("utf-8")
        await send({
            "type": "http.response.start",
            "status": 403,
            "headers": [
                (b"content-type", b"application/json; charset=utf-8"),
                (b"content-length", str(len(corpo)).encode()),
            ],
        })
        await send({"type": "http.response.body", "body": corpo})
