import pytest
from starlette.routing import Match

from app.api.v1.endpoints import cnhs, exames


def _rota_que_atende(router, metodo: str, caminho: str):
    scope = {"type": "http", "path": caminho, "method": metodo, "root_path": ""}
    for rota in router.routes:
        resultado, _ = rota.matches(scope)
        if resultado == Match.FULL:
            return rota
    return None


@pytest.mark.parametrize(
    "router, endpoint_esperado",
    [
        (cnhs.router, "limpar_todas_cnhs"),
        (exames.router, "limpar_todos_exames"),
    ],
)
def test_delete_limpar_todos_nao_e_capturado_pela_rota_de_id(router, endpoint_esperado):
    rota = _rota_que_atende(router, "DELETE", "/limpar-todos")
    assert rota is not None
    assert rota.endpoint.__name__ == endpoint_esperado


@pytest.mark.parametrize(
    "router, endpoint_esperado",
    [
        (cnhs.router, "deletar_cnh"),
        (exames.router, "deletar_exame"),
    ],
)
def test_delete_por_id_continua_funcionando(router, endpoint_esperado):
    rota = _rota_que_atende(router, "DELETE", "/42")
    assert rota is not None
    assert rota.endpoint.__name__ == endpoint_esperado
