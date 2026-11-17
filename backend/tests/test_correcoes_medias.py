"""Testes das correções de severidade média (itens 5, 6, 7 e 9) da revisão de segurança."""
import asyncio
import io
import time
from types import SimpleNamespace

import jwt
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from starlette.datastructures import UploadFile
from starlette.requests import Request

from app.api import deps
from app.core import security, sessoes_revogadas
from app.core.config import settings
from app.core.uploads import LimiteCorpoMiddleware, ler_com_limite


# ---------------------------------------------------------------------------
# Item 7: PyJWT no lugar do python-jose
# ---------------------------------------------------------------------------
def test_token_criado_e_lido_com_pyjwt():
    token = security.create_access_token("user-123")
    dados = security.decode_access_token(token)
    assert dados["sub"] == "user-123"
    assert dados["jti"]  # todo login novo ganha um identificador


def test_token_com_assinatura_errada_e_recusado():
    falso = jwt.encode({"sub": "x", "exp": time.time() + 60}, "outra-chave", algorithm="HS256")
    with pytest.raises(jwt.PyJWTError):
        security.decode_access_token(falso)


def test_token_alg_none_e_recusado():
    sem_assinatura = jwt.encode({"sub": "x", "exp": time.time() + 60}, None, algorithm="none")
    with pytest.raises(jwt.PyJWTError):
        security.decode_access_token(sem_assinatura)


# ---------------------------------------------------------------------------
# Item 5: logout invalida o token no servidor
# ---------------------------------------------------------------------------
class _DbFalso:
    def __init__(self, usuario):
        self.usuario = usuario

    def query(self, *_):
        return self

    def filter(self, *_):
        return self

    def first(self):
        return self.usuario


def _request() -> Request:
    return Request({"type": "http", "method": "GET", "path": "/", "headers": []})


@pytest.fixture(autouse=True)
def limpar_revogados():
    sessoes_revogadas._revogados.clear()
    yield
    sessoes_revogadas._revogados.clear()


def test_token_valido_entra():
    usuario = SimpleNamespace(id="u1")
    token = security.create_access_token("u1")
    assert deps.get_current_user(_request(), token, _DbFalso(usuario)) is usuario


def test_token_revogado_no_logout_e_recusado():
    usuario = SimpleNamespace(id="u1")
    token = security.create_access_token("u1")
    dados = security.decode_access_token(token)
    sessoes_revogadas.revogar(dados["jti"], dados["exp"])
    with pytest.raises(HTTPException) as erro:
        deps.get_current_user(_request(), token, _DbFalso(usuario))
    assert erro.value.status_code == 401


def test_token_antigo_sem_jti_continua_valendo_ate_expirar():
    # Tokens emitidos antes deste deploy não têm jti: seguem válidos até vencer (máx. 8 h).
    usuario = SimpleNamespace(id="u1")
    antigo = jwt.encode({"sub": "u1", "exp": time.time() + 60}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    assert deps.get_current_user(_request(), antigo, _DbFalso(usuario)) is usuario


def test_revogacao_expirada_sai_da_lista():
    sessoes_revogadas.revogar("jti-velho", time.time() - 1)
    assert sessoes_revogadas.esta_revogado("jti-velho") is False
    assert "jti-velho" not in sessoes_revogadas._revogados


# ---------------------------------------------------------------------------
# Item 9: uploads com limite
# ---------------------------------------------------------------------------
def test_leitura_para_logo_depois_do_limite():
    arquivo = UploadFile(file=io.BytesIO(b"x" * (5 * 1024 * 1024)), filename="grande.pdf")
    conteudo = asyncio.run(ler_com_limite(arquivo, 1024 * 1024))
    assert 1024 * 1024 < len(conteudo) <= 2 * 1024 * 1024  # leu só até passar do limite


def test_arquivo_dentro_do_limite_vem_inteiro():
    arquivo = UploadFile(file=io.BytesIO(b"%PDF-conteudo"), filename="ok.pdf")
    assert asyncio.run(ler_com_limite(arquivo, 1024)) == b"%PDF-conteudo"


def test_requisicao_maior_que_o_limite_recebe_413():
    app = FastAPI()

    @app.post("/upload")
    def upload():
        return {"ok": True}

    app.add_middleware(LimiteCorpoMiddleware, limite=100)
    cliente = TestClient(app)
    assert cliente.post("/upload", content=b"x" * 101).status_code == 413
    assert cliente.post("/upload", content=b"x" * 50).status_code == 200
