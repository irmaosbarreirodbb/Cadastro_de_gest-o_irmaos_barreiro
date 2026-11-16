"""Testes das correções de severidade baixa da revisão de segurança."""
import pytest
from cryptography.fernet import Fernet
from starlette.requests import Request

from app.core import encryption, rate_limit, security


# ---------------------------------------------------------------------------
# Rate limit: IP inválido no cabeçalho e limpeza de contadores antigos
# ---------------------------------------------------------------------------
def _request(ip_proxy: str, real_ip: str | None = None) -> Request:
    headers = [(b"x-real-ip", real_ip.encode())] if real_ip else []
    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers, "client": (ip_proxy, 443)})


@pytest.fixture(autouse=True)
def limpar_contadores():
    rate_limit._requests.clear()
    yield
    rate_limit._requests.clear()


def test_cabecalho_com_texto_que_nao_e_ip_e_ignorado(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "ENVIRONMENT", "production")
    assert rate_limit.get_client_ip(_request("10.0.0.1", real_ip="qualquer-coisa")) == "10.0.0.1"


def test_limpeza_respeita_a_janela_de_cada_escopo(monkeypatch):
    monkeypatch.setattr(rate_limit, "_janelas", {"login": 900, "cadastro": 3600})
    agora = 10_000.0
    rate_limit._requests["login:1.1.1.1"].append(agora - 1000)     # passou dos 15 min: sai
    rate_limit._requests["cadastro:1.1.1.1"].append(agora - 1000)  # ainda dentro de 1 h: fica
    rate_limit._limpar_expirados(agora)
    assert "login:1.1.1.1" not in rate_limit._requests
    assert "cadastro:1.1.1.1" in rate_limit._requests


# ---------------------------------------------------------------------------
# Criptografia: aviso de dados que dependem da SECRET_KEY
# ---------------------------------------------------------------------------
def _token(chave_texto: str, valor: bytes = b"123.456.789-00") -> str:
    return Fernet(encryption._derive_fernet_key(chave_texto)).encrypt(valor).decode()


@pytest.fixture
def chaves(monkeypatch):
    monkeypatch.setattr(encryption.settings, "SECRET_KEY", "secret-atual")
    monkeypatch.setattr(encryption.settings, "ENCRYPTION_KEY", "encryption-atual")
    monkeypatch.setattr(encryption.settings, "LEGACY_ENCRYPTION_KEYS", "")


def test_conta_so_os_dados_que_dependem_da_secret_key(chaves):
    amostras = [_token("secret-atual"), _token("encryption-atual"), "texto-comum"]
    assert encryption.contar_dependentes_da_secret_key(amostras) == 1


def test_secret_key_guardada_como_legada_nao_gera_aviso(chaves, monkeypatch):
    monkeypatch.setattr(encryption.settings, "LEGACY_ENCRYPTION_KEYS", "secret-atual")
    assert encryption.contar_dependentes_da_secret_key([_token("secret-atual")]) == 0


def test_sem_encryption_key_nao_conta(chaves, monkeypatch):
    monkeypatch.setattr(encryption.settings, "ENCRYPTION_KEY", "")
    assert encryption.contar_dependentes_da_secret_key([_token("secret-atual")]) == 0


# ---------------------------------------------------------------------------
# Login: e-mail inexistente também passa pelo bcrypt
# ---------------------------------------------------------------------------
def test_email_inexistente_tambem_roda_o_bcrypt(monkeypatch):
    chamadas = []
    original = security.verify_password
    monkeypatch.setattr(security, "verify_password", lambda s, h: chamadas.append(h) or original(s, h))
    security.simular_verificacao_senha("senha-qualquer")
    assert chamadas == [security._HASH_FICTICIO]
