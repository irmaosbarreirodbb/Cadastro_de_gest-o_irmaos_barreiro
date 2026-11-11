import logging

import pytest
from cryptography.fernet import Fernet, MultiFernet

from app.core import encryption


@pytest.fixture
def chave_trocada(monkeypatch):
    """Simula a ENCRYPTION_KEY trocada: o token foi gerado com outra chave."""
    token_antigo = Fernet(Fernet.generate_key()).encrypt(b"123.456.789-00").decode()
    monkeypatch.setattr(encryption, "_fernet", MultiFernet([Fernet(Fernet.generate_key())]))
    return token_antigo


def test_ida_e_volta_com_a_chave_certa():
    token = encryption.encrypt_val("chave-pix-teste")
    assert token != "chave-pix-teste"
    assert encryption.decrypt_val(token) == "chave-pix-teste"


def test_chave_errada_devolve_o_token_intacto(chave_trocada):
    # Devolver o token preserva o dado: se a tela salvar o registro, encrypt_val
    # não recriptografa valores "gAAAAA..." e o original continua no banco.
    assert encryption.decrypt_val(chave_trocada) == chave_trocada
    assert encryption.encrypt_val(chave_trocada) == chave_trocada


def test_chave_errada_gera_erro_no_log_sem_o_valor(chave_trocada, caplog, monkeypatch):
    monkeypatch.setattr(encryption, "_falhas_descriptografia", 0)
    with caplog.at_level(logging.ERROR, logger="app.encryption"):
        encryption.decrypt_val(chave_trocada)
    assert "Falha ao descriptografar" in caplog.text
    assert chave_trocada not in caplog.text
    assert "123.456.789-00" not in caplog.text


def test_arquivo_antigo_sem_criptografia_nao_e_tratado_como_erro(caplog, monkeypatch):
    monkeypatch.setattr(encryption, "_falhas_descriptografia", 0)
    pdf = b"%PDF-1.4 conteudo"
    with caplog.at_level(logging.ERROR, logger="app.encryption"):
        assert encryption.decrypt_bytes(pdf) == pdf
    assert caplog.text == ""


def test_verificacao_de_amostras_detecta_chave_errada(chave_trocada):
    assert encryption.verificar_chave_com_amostras([chave_trocada, "texto puro", None]) == (1, 1)


def test_verificacao_de_amostras_com_chave_certa():
    token = encryption.encrypt_val("dado")
    assert encryption.verificar_chave_com_amostras([token]) == (1, 0)
