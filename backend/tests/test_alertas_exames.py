from datetime import date, timedelta

from app.services.email_service import DIAS_ALERTA, _deve_alertar_vencendo

HOJE = date(2026, 11, 11)


def test_nunca_alertado_recebe_alerta():
    assert _deve_alertar_vencendo(None, HOJE, dias_para_vencer=5) is True


def test_ja_alertado_no_ciclo_atual_nao_repete():
    # Vence em 5 dias; janela começou há 5 dias; alerta enviado há 3 dias.
    assert _deve_alertar_vencendo(HOJE - timedelta(days=3), HOJE, dias_para_vencer=5) is False


def test_alerta_no_primeiro_dia_da_janela_conta_como_do_ciclo_atual():
    inicio_janela = HOJE + timedelta(days=5 - DIAS_ALERTA)
    assert _deve_alertar_vencendo(inicio_janela, HOJE, dias_para_vencer=5) is False


def test_exame_renovado_recebe_novo_alerta_no_proximo_ciclo():
    # Último alerta foi do vencimento anterior (~2,5 anos atrás); o exame foi
    # renovado no mesmo registro e agora vence de novo em 8 dias.
    alerta_do_ciclo_anterior = HOJE - timedelta(days=900)
    assert _deve_alertar_vencendo(alerta_do_ciclo_anterior, HOJE, dias_para_vencer=8) is True


def test_alerta_enviado_quando_estava_vencido_nao_bloqueia_novo_ciclo():
    # Exame venceu, recebeu alertas de VENCIDO, foi renovado e voltou a vencer.
    alerta_quando_vencido = HOJE - timedelta(days=700)
    assert _deve_alertar_vencendo(alerta_quando_vencido, HOJE, dias_para_vencer=0) is True
