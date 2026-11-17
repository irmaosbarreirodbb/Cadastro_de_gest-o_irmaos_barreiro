"""PIX ilegível ("gAAAAA..." que nenhuma chave abre) não pode ser copiado para outro registro."""
import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.api.validacoes import recusar_dado_ilegivel
from app.core.encryption import encrypt_val, token_ilegivel

# Token gerado com uma chave que o sistema não conhece (como os PIX de 13/11).
TOKEN_ILEGIVEL = Fernet(Fernet.generate_key()).encrypt(b"123.456.789-00").decode()


def test_token_de_chave_desconhecida_e_ilegivel():
    assert token_ilegivel(TOKEN_ILEGIVEL) is True


def test_token_da_chave_atual_e_texto_comum_nao_sao_ilegiveis():
    assert token_ilegivel(encrypt_val("pix@empresa.com")) is False
    assert token_ilegivel("pix@empresa.com") is False
    assert token_ilegivel("") is False
    assert token_ilegivel(None) is False


def test_criar_com_pix_ilegivel_e_recusado():
    with pytest.raises(HTTPException) as erro:
        recusar_dado_ilegivel(TOKEN_ILEGIVEL, "PIX")
    assert erro.value.status_code == 400
    assert "Informe o PIX novamente" in erro.value.detail


def test_editar_mantendo_o_mesmo_pix_gravado_passa():
    # Ex.: mudar só a quantidade de um lançamento antigo cujo PIX está ilegível.
    recusar_dado_ilegivel(TOKEN_ILEGIVEL, "PIX", valor_atual=TOKEN_ILEGIVEL)


def test_editar_trocando_por_outro_pix_ilegivel_e_recusado():
    outro = Fernet(Fernet.generate_key()).encrypt(b"x").decode()
    with pytest.raises(HTTPException):
        recusar_dado_ilegivel(outro, "PIX", valor_atual=TOKEN_ILEGIVEL)


def test_pix_normal_passa():
    recusar_dado_ilegivel("85999990000", "PIX")
    recusar_dado_ilegivel(None, "PIX")
