import pytest
from fastapi import HTTPException
from starlette.requests import Request

from app.core import rate_limit


def _request(ip_proxy: str, real_ip: str | None = None) -> Request:
    headers = [(b"x-real-ip", real_ip.encode())] if real_ip else []
    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers, "client": (ip_proxy, 443)})


@pytest.fixture(autouse=True)
def limpar_contadores():
    rate_limit._requests.clear()
    yield
    rate_limit._requests.clear()


@pytest.fixture
def producao(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "ENVIRONMENT", "production")


def test_em_producao_usa_o_ip_real_informado_pelo_railway(producao):
    assert rate_limit.get_client_ip(_request("10.0.0.1", real_ip="200.1.2.3")) == "200.1.2.3"


def test_sem_cabecalho_usa_o_ip_da_conexao(producao):
    assert rate_limit.get_client_ip(_request("10.0.0.1")) == "10.0.0.1"


def test_em_desenvolvimento_ignora_o_cabecalho(monkeypatch):
    monkeypatch.setattr(rate_limit.settings, "ENVIRONMENT", "development")
    assert rate_limit.get_client_ip(_request("127.0.0.1", real_ip="200.1.2.3")) == "127.0.0.1"


def test_atacante_nao_bloqueia_o_login_dos_outros(producao):
    # Todos chegam pelo mesmo IP do proxy (10.0.0.1), mas com IPs reais diferentes.
    for _ in range(5):
        rate_limit.enforce_rate_limit(_request("10.0.0.1", "6.6.6.6"), "login", limit=5, window_seconds=900)

    with pytest.raises(HTTPException) as erro:
        rate_limit.enforce_rate_limit(_request("10.0.0.1", "6.6.6.6"), "login", limit=5, window_seconds=900)
    assert erro.value.status_code == 429

    # Funcionário legítimo, outro IP real: continua conseguindo tentar.
    rate_limit.enforce_rate_limit(_request("10.0.0.1", "189.50.60.70"), "login", limit=5, window_seconds=900)
