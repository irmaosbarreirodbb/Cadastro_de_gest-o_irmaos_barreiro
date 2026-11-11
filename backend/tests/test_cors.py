import pytest
from fastapi.middleware.cors import CORSMiddleware


@pytest.fixture(scope="module")
def cors():
    import main

    for middleware in main.app.user_middleware:
        if middleware.cls is CORSMiddleware:
            return CORSMiddleware(app=None, **middleware.kwargs), main.ALLOWED_ORIGINS
    pytest.fail("CORSMiddleware não está configurado")


@pytest.mark.parametrize(
    "origem",
    [
        "https://site-do-atacante.up.railway.app",
        "https://portal-rh-barreiro.up.railway.app",
        "https://evil.example.com",
    ],
)
def test_origem_desconhecida_e_recusada(cors, origem):
    middleware, _ = cors
    assert middleware.is_allowed_origin(origem) is False


def test_origens_configuradas_continuam_liberadas(cors):
    middleware, origens = cors
    assert origens, "a lista de origens permitidas não pode ficar vazia"
    for origem in origens:
        assert middleware.is_allowed_origin(origem) is True
