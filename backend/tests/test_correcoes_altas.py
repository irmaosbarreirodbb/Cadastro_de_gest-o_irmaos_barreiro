"""Testes das correções de severidade alta da revisão de segurança."""
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient

from app.core.csrf import CSRFHeaderMiddleware
from app.services.pdf_texto import texto_pdf

ORIGEM_PERMITIDA = "http://localhost:5173"
NOME_MALICIOSO = 'JOAO <img src="http://127.0.0.1:9/x.png" width="5" height="5"/> & <SILVA'


# ---------------------------------------------------------------------------
# CSRF: requisições que alteram dados exigem X-Requested-With
# ---------------------------------------------------------------------------
@pytest.fixture
def cliente():
    app = FastAPI()

    @app.get("/api/v1/itens")
    def listar():
        return {"ok": True}

    @app.post("/api/v1/itens")
    def criar():
        return {"ok": True}

    @app.delete("/api/v1/itens")
    def apagar():
        return {"ok": True}

    # Mesma ordem do main.py: CSRF por dentro, CORS por fora.
    app.add_middleware(CSRFHeaderMiddleware, prefixo="/api/v1/")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[ORIGEM_PERMITIDA],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return TestClient(app)


def test_post_sem_cabecalho_e_recusado(cliente):
    resposta = cliente.post("/api/v1/itens")
    assert resposta.status_code == 403


def test_delete_sem_cabecalho_e_recusado(cliente):
    assert cliente.delete("/api/v1/itens").status_code == 403


def test_post_com_cabecalho_do_frontend_passa(cliente):
    resposta = cliente.post("/api/v1/itens", headers={"X-Requested-With": "XMLHttpRequest"})
    assert resposta.status_code == 200


def test_get_continua_funcionando_sem_cabecalho(cliente):
    assert cliente.get("/api/v1/itens").status_code == 200


def test_preflight_do_cors_nao_e_bloqueado(cliente):
    resposta = cliente.options(
        "/api/v1/itens",
        headers={
            "Origin": ORIGEM_PERMITIDA,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-requested-with",
        },
    )
    assert resposta.status_code == 200


def test_recusa_leva_cabecalho_de_cors_para_o_frontend_ler_o_erro(cliente):
    resposta = cliente.post("/api/v1/itens", headers={"Origin": ORIGEM_PERMITIDA})
    assert resposta.status_code == 403
    assert resposta.headers.get("access-control-allow-origin") == ORIGEM_PERMITIDA


# ---------------------------------------------------------------------------
# PDFs: texto digitado não vira marcação do ReportLab
# ---------------------------------------------------------------------------
def test_texto_pdf_escapa_marcacao():
    assert texto_pdf("<b>&") == "&lt;b&gt;&amp;"
    assert texto_pdf(None) == ""


def test_ficha_epi_com_nome_malicioso_gera_pdf():
    from app.services.epi_pdf import gerar_ficha_epi_pdf

    pdf = gerar_ficha_epi_pdf(
        {"nome": NOME_MALICIOSO, "funcao": "<b>", "setor": "A & B", "local": "<x"},
        [{"quantidade": 1, "cod_epi": "<1>", "tamanho": "G", "motivo": "A", "numero_ca": "123", "data_entrega": "2026-11-17"}],
    )
    assert pdf.startswith(b"%PDF")


def test_pdf_de_exames_com_nome_malicioso_gera_pdf():
    from app.api.v1.endpoints.exames import _gerar_pdf

    exame = SimpleNamespace(
        nome=NOME_MALICIOSO, data_exame="01/01/2026", data_vencimento="01/01/2027", dias_para_vencer=40
    )
    assert _gerar_pdf([exame]).startswith(b"%PDF")


def test_pdf_de_cnh_com_nome_malicioso_gera_pdf():
    from app.api.v1.endpoints.cnhs import _gerar_pdf_cnh

    cnh = SimpleNamespace(
        setor="FROTA", nome=NOME_MALICIOSO, cnh_validade="01/01/2027", cnh_numero=None,
        observacao="<i>obs", status="OK", dias_para_vencer=40,
    )
    assert _gerar_pdf_cnh([cnh]).startswith(b"%PDF")
