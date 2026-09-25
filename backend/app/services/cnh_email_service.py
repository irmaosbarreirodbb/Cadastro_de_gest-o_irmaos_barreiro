"""
Serviço de e-mail para Controle de CNH via Brevo REST API.
Envia alertas automáticos quando CNHs de funcionários (Frota e Adm) estão próximas do vencimento.

Sistema de alertas:
  - Disparo diário automático via scheduler
  - Janela de alerta: ≤ 30 dias para vencer
  - Anti-duplicata com a tabela 'alertas_cnh_enviados'
  - Reenvio a cada 3 dias para CNHs já vencidas
"""
import os
import json
import requests
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from typing import List
from html import escape
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.encryption import decrypt_val
from app.models.cnh import CNHFuncionario, AlertaCNHEnviado


BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
DIAS_ALERTA = 30   # Janela de alerta: ≤ 30 dias para vencer
DIAS_REENVIO_VENCIDO = 3  # Reenvia alerta a cada N dias para CNH já vencida
FUSO_HORARIO = ZoneInfo("America/Sao_Paulo")


def _hoje_local() -> date:
    return datetime.now(FUSO_HORARIO).date()


def _get_brevo_key() -> str:
    return settings.BREVO_API_KEY.strip()


def _get_email_to() -> str:
    return settings.ALERT_EMAIL_TO.strip()


def _get_logo_url() -> str:
    return settings.ALERT_LOGO_URL.strip()


def _get_email_from() -> dict:
    return {
        "email": settings.ALERT_EMAIL_FROM.strip(),
        "name": os.getenv("ALERT_EMAIL_FROM_NAME", "Irmãos Barreiro — Alertas CNH")
    }


def _construir_html_cnh(cnhs: List[CNHFuncionario]) -> str:
    logo_url = _get_logo_url()
    linhas_tabela = ""

    # Ordenar por setor (FROTA primeiro, depois ADM) e dias_para_vencer
    cnhs_ordenadas = sorted(
        cnhs,
        key=lambda x: (0 if (x.setor or "").upper() == "FROTA" else 1, x.dias_para_vencer)
    )

    for item in cnhs_ordenadas:
        dias = item.dias_para_vencer
        if dias < 0:
            badge_cor = "#DC2626"
            badge_texto = f"VENCIDA há {abs(dias)} dia(s)"
            row_bg = "#FFF5F5"
        elif dias == 0:
            badge_cor = "#DC2626"
            badge_texto = "VENCE HOJE"
            row_bg = "#FFF5F5"
        elif dias <= 10:
            badge_cor = "#EA580C"
            badge_texto = f"Vence em {dias} dia(s)"
            row_bg = "#FFFBEB"
        else:
            badge_cor = "#D97706"
            badge_texto = f"Vence em {dias} dia(s)"
            row_bg = "#FFFBEB"

        setor_label = "Frota" if (item.setor or "").upper() == "FROTA" else "Administração"
        setor_badge_bg = "#EFF6FF" if (item.setor or "").upper() == "FROTA" else "#F3E8FF"
        setor_badge_color = "#1D4ED8" if (item.setor or "").upper() == "FROTA" else "#7E22CE"

        num_cnh = decrypt_val(item.cnh_numero) if item.cnh_numero else "-"

        linhas_tabela += f"""
        <tr style="background:{row_bg}; border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 10px 12px; font-size: 13px; color: #1E293B; font-weight: 600;">{escape(str(item.nome))}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="background:{setor_badge_bg}; color:{setor_badge_color}; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;">
              {escape(setor_label)}
            </span>
          </td>
          <td style="padding: 10px 12px; font-size: 12px; color: #475569; text-align: center; font-family: monospace;">{escape(str(num_cnh))}</td>
          <td style="padding: 10px 12px; font-size: 13px; color: #475569; text-align: center; font-weight: 600;">{escape(str(item.cnh_validade))}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="background:{badge_cor}; color:#fff; padding: 4px 10px; border-radius: 20px;
                         font-size: 11px; font-weight: 700; white-space: nowrap; letter-spacing: 0.3px;">
              {badge_texto}
            </span>
          </td>
        </tr>"""

    total = len(cnhs)
    data_envio = datetime.now(FUSO_HORARIO).strftime("%d/%m/%Y às %H:%M")
    vencendo = sum(1 for e in cnhs if e.dias_para_vencer >= 0)
    vencidos = total - vencendo
    frota_count = sum(1 for e in cnhs if (e.setor or "").upper() == "FROTA")
    adm_count = total - frota_count

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F1F5F9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="660" cellspacing="0" cellpadding="0"
               style="background:#FFFFFF; border-radius: 14px; overflow:hidden;
                      box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #E2E8F0;">

          <!-- CABEÇALHO -->
          <tr>
            <td style="background: linear-gradient(135deg, #991B1B 0%, #DC2626 50%, #B91C1C 100%);
                       padding: 28px 32px 24px; text-align: center;">
              {f'<img src="{logo_url}" alt="Irmãos Barreiro" height="48" style="max-height:48px; width:auto; margin-bottom:12px; display:inline-block;"/>' if logo_url else ''}
              <h1 style="color:#FFFFFF; margin:0 0 4px; font-size: 20px; font-weight: 800; letter-spacing: -0.3px;">
                DISTRIBUIDORA IRMÃOS BARREIRO
              </h1>
              <p style="color:#FECACA; margin:0; font-size: 13px; font-weight: 500;">
                Sistema de Gestão &bull; Controle de Vencimentos CNH
              </p>
            </td>
          </tr>

          <!-- TARJA DE ALERTA -->
          <tr>
            <td style="background: #FEF3C7; border-bottom: 2px solid #F59E0B; padding: 12px 32px; text-align: center;">
              <span style="font-size: 13px; font-weight: 700; color: #92400E;">
                ⚠️ ALERTA DE VENCIMENTO DE CNH — FROTA &bull; ADM
              </span>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding: 28px 32px 20px;">
              <p style="color:#334155; font-size:14px; margin:0 0 16px; line-height: 1.6;">
                Olá, Gestão e Recursos Humanos! Segue a relação atualizada de CNHs dos colaboradores que requerem atenção imediata para regularização junto ao Detran.
              </p>

              <!-- CARDS DE RESUMO -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 22px;">
                <tr>
                  <td width="32%" style="background:#FFF5F5; border: 1px solid #FECACA; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 800; color: #DC2626;">{vencidos}</div>
                    <div style="font-size: 11px; font-weight: 700; color: #991B1B; text-transform: uppercase;">Já Vencida(s)</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background:#FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 22px; font-weight: 800; color: #D97706;">{vencendo}</div>
                    <div style="font-size: 11px; font-weight: 700; color: #92400E; text-transform: uppercase;">Vencendo em breve</div>
                  </td>
                  <td width="2%"></td>
                  <td width="32%" style="background:#F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center;">
                    <div style="font-size: 14px; font-weight: 700; color: #475569; margin-top: 4px;">Frota: <b>{frota_count}</b> | Adm: <b>{adm_count}</b></div>
                    <div style="font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; margin-top: 4px;">Distribuição</div>
                  </td>
                </tr>
              </table>

              <!-- TABELA DE CONDUTORES -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"
                     style="border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden;">
                <thead>
                  <tr style="background:#F8FAFC; border-bottom: 2px solid #E2E8F0;">
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #64748B; text-align: left; text-transform: uppercase;">Funcionário</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #64748B; text-align: center; text-transform: uppercase;">Setor</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #64748B; text-align: center; text-transform: uppercase;">Nº CNH</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #64748B; text-align: center; text-transform: uppercase;">Validade</th>
                    <th style="padding: 10px 12px; font-size: 11px; font-weight: 700; color: #64748B; text-align: center; text-transform: uppercase;">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas_tabela}
                </tbody>
              </table>

              <p style="color:#64748B; font-size:12px; margin: 20px 0 0; line-height: 1.5;">
                ℹ️ <b>Importante:</b> Conforme o Código de Trânsito Brasileiro (CTB), conduzir veículo com a CNH vencida há mais de 30 dias é infração gravíssima. Favor orientar os condutores para a renovação com antecedência.
              </p>
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="background:#F8FAFC; border-top: 1px solid #E2E8F0; padding: 18px 32px; text-align: center;">
              <p style="color:#94A3B8; font-size: 11px; margin: 0 0 4px;">
                Relatório gerado em <b>{data_envio}</b> &bull; Distribuidora Irmãos Barreiro Bebidas Ltda.
              </p>
              <p style="color:#CBD5E1; font-size: 10px; margin: 0;">
                E-mail automático enviado pelo Portal de Gestão Irmãos Barreiro via Brevo API.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _buscar_cnhs_para_alerta(db: Session, forcar_todos: bool = False) -> List[CNHFuncionario]:
    """
    Retorna CNHs que precisam de alerta:
      - Validade ≤ 30 dias (ou já vencidas)
      - Anti-duplicata: se não for forçado, ignora as que já foram notificadas hoje
    """
    todas = db.query(CNHFuncionario).all()
    candidatos = [c for c in todas if c.dias_para_vencer <= DIAS_ALERTA]

    if forcar_todos or not candidatos:
        return candidatos

    hoje = _hoje_local()
    limite_reenvio = hoje - timedelta(days=DIAS_REENVIO_VENCIDO)

    resultado = []
    for c in candidatos:
        dias = c.dias_para_vencer
        if dias < 0:
            # Já vencido: envia se não recebeu alerta nos últimos N dias
            alerta_recente = (
                db.query(AlertaCNHEnviado)
                .filter(
                    AlertaCNHEnviado.cnh_id == c.id,
                    AlertaCNHEnviado.tipo == "VENCIDO",
                    AlertaCNHEnviado.data_envio >= limite_reenvio,
                )
                .first()
            )
            if not alerta_recente:
                resultado.append(c)
        else:
            # Vencendo: envia se ainda não enviou hoje
            alerta_hoje = (
                db.query(AlertaCNHEnviado)
                .filter(
                    AlertaCNHEnviado.cnh_id == c.id,
                    AlertaCNHEnviado.tipo == "VENCENDO",
                    AlertaCNHEnviado.data_envio == hoje,
                )
                .first()
            )
            if not alerta_hoje:
                resultado.append(c)

    return resultado


def _registrar_alertas_enviados(db: Session, cnhs: List[CNHFuncionario]) -> None:
    hoje = _hoje_local()
    for c in cnhs:
        tipo = "VENCIDO" if c.dias_para_vencer < 0 else "VENCENDO"
        registro = AlertaCNHEnviado(
            cnh_id=c.id,
            nome_motorista=c.nome,
            setor=c.setor or "FROTA",
            data_envio=hoje,
            tipo=tipo
        )
        db.add(registro)
    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"⚠️ Erro ao registrar alertas_cnh_enviados: {exc}")


def enviar_alerta_cnh_brevo(cnhs: List[CNHFuncionario]) -> dict:
    """Dispara a mensagem via API Brevo."""
    api_key = _get_brevo_key()
    email_to = _get_email_to()
    email_from = _get_email_from()

    if not api_key:
        return {"sucesso": False, "motivo": "BREVO_API_KEY não configurada no backend (.env)."}
    if not email_to:
        return {"sucesso": False, "motivo": "ALERT_EMAIL_TO não configurado no backend (.env)."}

    # Formatar destinatários
    destinatarios = [
        {"email": e.strip()}
        for e in email_to.split(",")
        if e.strip() and "@" in e
    ]
    if not destinatarios:
        return {"sucesso": False, "motivo": f"Nenhum e-mail válido encontrado em ALERT_EMAIL_TO: '{email_to}'"}

    total = len(cnhs)
    vencidos = sum(1 for e in cnhs if e.dias_para_vencer < 0)
    vencendo = total - vencidos

    if vencidos > 0 and vencendo > 0:
        assunto = f"⚠️ [CNH] {vencidos} vencida(s) e {vencendo} vencendo — Irmãos Barreiro"
    elif vencidos > 0:
        assunto = f"🚨 [URGENTE CNH] {vencidos} CNH(s) VENCIDA(S) — Irmãos Barreiro"
    else:
        assunto = f"⚠️ [CNH] {vencendo} CNH(s) vencendo em até 30 dias — Irmãos Barreiro"

    html_content = _construir_html_cnh(cnhs)

    payload = {
        "sender": email_from,
        "to": destinatarios,
        "subject": assunto,
        "htmlContent": html_content,
    }

    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json",
    }

    try:
        resp = requests.post(BREVO_API_URL, headers=headers, json=payload, timeout=15)
        if resp.status_code in (200, 201, 202):
            return {
                "sucesso": True,
                "message_id": resp.json().get("messageId", ""),
                "status_code": resp.status_code,
                "destinatarios": [d["email"] for d in destinatarios],
            }
        else:
            return {
                "sucesso": False,
                "motivo": f"Brevo retornou status {resp.status_code}: {resp.text}",
                "status_code": resp.status_code,
            }
    except requests.exceptions.Timeout:
        return {"sucesso": False, "motivo": "Timeout ao conectar com a API do Brevo (15s)."}
    except Exception as exc:
        return {"sucesso": False, "motivo": f"Exceção ao enviar via Brevo: {str(exc)}"}


def verificar_e_enviar_alertas_cnh(db: Session, forcar: bool = False) -> dict:
    """Verifica e dispara alertas de CNHs."""
    cnhs = _buscar_cnhs_para_alerta(db, forcar_todos=forcar)
    if not cnhs:
        return {
            "enviado": False,
            "total_alertas": 0,
            "mensagem": "Nenhuma CNH vencendo ou vencida requer alerta no momento.",
            "funcionarios": [],
        }

    resultado_envio = enviar_alerta_cnh_brevo(cnhs)
    if resultado_envio["sucesso"]:
        _registrar_alertas_enviados(db, cnhs)
        return {
            "enviado": True,
            "total_alertas": len(cnhs),
            "mensagem": f"E-mail de alerta enviado para {len(cnhs)} funcionário(s)!",
            "funcionarios": [c.nome for c in cnhs],
            "detalhes": resultado_envio,
        }
    else:
        return {
            "enviado": False,
            "total_alertas": len(cnhs),
            "mensagem": f"Alerta gerado para {len(cnhs)} funcionário(s), mas o e-mail não foi entregue: {resultado_envio['motivo']}",
            "funcionarios": [c.nome for c in cnhs],
            "detalhes": resultado_envio,
        }
