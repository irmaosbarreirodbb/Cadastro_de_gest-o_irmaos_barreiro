"""
Serviço de e-mail via Brevo REST API.
Envia alertas automáticos quando exames toxicológicos estão próximos do vencimento.

Sistema inteligente de alertas:
  - Disparo automático diário às 08:00 (controlado por scheduler em main.py)
  - Anti-duplicata: registra no banco quais alertas já foram enviados hoje
  - Só alerta motoristas que entram na janela ≤ 10 dias NESTE ciclo diário
  - Motoristas com exame já vencido continuam recebendo alerta a cada 3 dias
"""
import os
import json
import requests
from datetime import datetime, date, timedelta
from typing import List
from sqlalchemy import Column, Integer, String, Date, DateTime, text
from sqlalchemy.orm import Session

from app.core.database import Base
from app.models.exame_toxicologico import ExameToxicologico


# ─── Configurações ────────────────────────────────────────────────────────────

BREVO_API_URL  = "https://api.brevo.com/v3/smtp/email"
DIAS_ALERTA    = 10   # Janela de alerta: ≤ 10 dias para vencer
DIAS_REENVIO_VENCIDO = 3  # Reenvia alerta a cada N dias para exames já vencidos


# ─── Modelo de controle de alertas enviados ───────────────────────────────────

class AlertaExameEnviado(Base):
    """
    Tabela de controle para evitar envio duplicado de alertas.
    Cada linha representa um alerta enviado para um motorista em uma data.
    """
    __tablename__ = "alertas_exames_enviados"

    id            = Column(Integer, primary_key=True, autoincrement=True)
    exame_id      = Column(Integer, nullable=False, index=True)
    nome_motorista = Column(String(150), nullable=False)
    data_envio    = Column(Date, nullable=False, default=date.today)
    tipo          = Column(String(20), nullable=False, default="VENCENDO")  # VENCENDO | VENCIDO
    created_at    = Column(DateTime, default=datetime.utcnow)


# ─── Helpers de credenciais ───────────────────────────────────────────────────

def _get_brevo_key() -> str:
    return os.getenv("BREVO_API_KEY", "")

def _get_email_to() -> str:
    return os.getenv("ALERT_EMAIL_TO", "")

def _get_email_from() -> dict:
    return {
        "email": os.getenv("ALERT_EMAIL_FROM", "noreply@irmaosbarreiro.com.br"),
        "name": os.getenv("ALERT_EMAIL_FROM_NAME", "Irmãos Barreiro — Alertas")
    }


# ─── Construtor do e-mail HTML ────────────────────────────────────────────────

def _construir_html(exames: List[ExameToxicologico]) -> str:
    linhas_tabela = ""
    for ex in exames:
        dias = ex.dias_para_vencer
        if dias < 0:
            badge_cor   = "#DC2626"
            badge_texto = f"VENCIDO há {abs(dias)} dia(s)"
            row_bg      = "#FFF5F5"
        elif dias == 0:
            badge_cor   = "#DC2626"
            badge_texto = "VENCE HOJE"
            row_bg      = "#FFF5F5"
        else:
            badge_cor   = "#D97706"
            badge_texto = f"Vence em {dias} dia(s)"
            row_bg      = "#FFFBEB"

        linhas_tabela += f"""
        <tr style="background:{row_bg}; border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 11px 14px; font-size: 13px; color: #1E293B; font-weight: 600;">{ex.nome}</td>
          <td style="padding: 11px 14px; font-size: 13px; color: #475569; text-align: center;">{ex.data_exame}</td>
          <td style="padding: 11px 14px; font-size: 13px; color: #475569; text-align: center;">{ex.data_vencimento}</td>
          <td style="padding: 11px 14px; text-align: center;">
            <span style="background:{badge_cor}; color:#fff; padding: 4px 11px; border-radius: 20px;
                         font-size: 11px; font-weight: 700; white-space: nowrap; letter-spacing: 0.3px;">
              {badge_texto}
            </span>
          </td>
        </tr>"""

    total       = len(exames)
    data_envio  = datetime.now().strftime("%d/%m/%Y às %H:%M")
    vencendo    = sum(1 for e in exames if e.dias_para_vencer >= 0)
    vencidos    = total - vencendo

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family: 'Segoe UI', Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F1F5F9; padding: 36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0"
               style="background:#ffffff; border-radius:14px; overflow:hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.10);">

          <!-- Cabeçalho Vermelho -->
          <tr>
            <td style="background: linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%); padding: 30px 36px; text-align: center;">
              <p style="color:#ffffff; font-size: 24px; font-weight: 900; margin: 0 0 4px; letter-spacing: -0.5px;">
                🚛 Irmãos Barreiro
              </p>
              <p style="color:#FCA5A5; font-size: 13px; margin: 0; font-weight: 500;">
                Distribuidora de Bebidas — Sistema Automático de Alertas
              </p>
            </td>
          </tr>

          <!-- Bloco de Alerta -->
          <tr>
            <td style="padding: 28px 36px 12px;">
              <div style="background:#FEF2F2; border-left: 5px solid #DC2626; padding: 16px 20px; border-radius: 8px;">
                <p style="color:#991B1B; font-size: 15px; font-weight: 800; margin: 0 0 6px;">
                  ⚠️ Alerta Automático — Exames Toxicológicos
                </p>
                <p style="color:#7F1D1D; font-size: 12.5px; margin: 0; line-height: 1.6;">
                  <strong>{total} motorista(s)</strong> com exame vencendo nos próximos {DIAS_ALERTA} dias ou já vencido.
                  Este alerta é disparado automaticamente pelo sistema às 08:00 quando detecta motoristas na janela crítica.
                </p>
              </div>
            </td>
          </tr>

          <!-- Resumo rápido -->
          <tr>
            <td style="padding: 12px 36px;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="50%" style="padding-right: 8px;">
                    <div style="background:#FEF3C7; border-radius: 10px; padding: 12px 16px; text-align:center;">
                      <span style="font-size: 26px; font-weight: 900; color: #92400E;">{vencendo}</span><br>
                      <span style="font-size: 11px; font-weight: 700; color: #B45309; text-transform: uppercase; letter-spacing: 0.5px;">Vencendo em breve</span>
                    </div>
                  </td>
                  <td width="50%" style="padding-left: 8px;">
                    <div style="background:#FEE2E2; border-radius: 10px; padding: 12px 16px; text-align:center;">
                      <span style="font-size: 26px; font-weight: 900; color: #991B1B;">{vencidos}</span><br>
                      <span style="font-size: 11px; font-weight: 700; color: #DC2626; text-transform: uppercase; letter-spacing: 0.5px;">Já vencidos</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Tabela de Motoristas -->
          <tr>
            <td style="padding: 12px 36px 24px;">
              <table width="100%" cellspacing="0" cellpadding="0"
                     style="border: 1px solid #E2E8F0; border-radius: 10px; overflow: hidden; border-collapse: collapse;">
                <thead>
                  <tr style="background:#F8FAFC;">
                    <th style="padding: 11px 14px; font-size: 11px; color: #64748B; text-align: left; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;">Motorista</th>
                    <th style="padding: 11px 14px; font-size: 11px; color: #64748B; text-align: center; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;">Data Exame</th>
                    <th style="padding: 11px 14px; font-size: 11px; color: #64748B; text-align: center; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;">Vencimento</th>
                    <th style="padding: 11px 14px; font-size: 11px; color: #64748B; text-align: center; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas_tabela}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Instrução de ação -->
          <tr>
            <td style="padding: 0 36px 24px;">
              <div style="background:#F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 14px 18px;">
                <p style="color:#14532D; font-size: 12.5px; font-weight: 700; margin: 0;">
                  ✅ Ação necessária: Agende o(s) exame(s) toxicológico(s) o mais breve possível para manter
                  a habilitação dos motoristas em conformidade com a legislação vigente.
                </p>
              </div>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background:#F8FAFC; border-top: 1px solid #E2E8F0; padding: 18px 36px; text-align: center;">
              <p style="color:#94A3B8; font-size: 11px; margin: 0; line-height: 1.8;">
                🤖 Enviado automaticamente em <strong>{data_envio}</strong><br>
                Sistema de Gestão — Distribuidora Irmãos Barreiro · Cascavel, CE<br>
                <em>Alertas são disparados diariamente às 08:00 quando há exames na janela crítica.</em>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


# ─── Envio via Brevo ──────────────────────────────────────────────────────────

def _enviar_via_brevo(exames: List[ExameToxicologico]) -> bool:
    """Envia o e-mail de alerta via Brevo REST API."""
    api_key  = _get_brevo_key()
    email_to = _get_email_to()

    if not api_key or api_key == "SUA_API_KEY_BREVO_AQUI":
        print("⚠️  BREVO_API_KEY não configurada no .env — e-mail não enviado.")
        return False
    if not email_to:
        print("⚠️  ALERT_EMAIL_TO não configurado no .env — e-mail não enviado.")
        return False
    if not exames:
        return True

    remetente  = _get_email_from()
    html_body  = _construir_html(exames)
    total      = len(exames)
    vencidos   = sum(1 for e in exames if e.dias_para_vencer < 0)
    vencendo   = total - vencidos

    assunto = (
        f"🚨 URGENTE: {vencidos} exame(s) VENCIDO(s) — Irmãos Barreiro"
        if vencidos > 0
        else f"⚠️ Alerta: {vencendo} exame(s) vencendo em até {DIAS_ALERTA} dias — Irmãos Barreiro"
    )

    payload = {
        "sender":      remetente,
        "to":          [{"email": email_to}],
        "subject":     assunto,
        "htmlContent": html_body
    }
    headers = {
        "accept":       "application/json",
        "api-key":      api_key,
        "content-type": "application/json"
    }

    try:
        resp = requests.post(BREVO_API_URL, headers=headers,
                             data=json.dumps(payload), timeout=20)
        if resp.status_code in (200, 201, 202):
            print(f"✅ Alerta Brevo enviado para {email_to} — {total} motorista(s). "
                  f"({vencidos} vencido(s), {vencendo} vencendo)")
            return True
        else:
            print(f"❌ Brevo retornou {resp.status_code}: {resp.text[:200]}")
            return False
    except Exception as exc:
        print(f"❌ Exceção ao chamar Brevo API: {exc}")
        return False


# ─── Sistema inteligente de controle de alertas ───────────────────────────────

def _garantir_tabela_alertas(db: Session) -> None:
    """Cria a tabela de controle se não existir (idempotente)."""
    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS alertas_exames_enviados (
                id             SERIAL PRIMARY KEY,
                exame_id       INTEGER NOT NULL,
                nome_motorista VARCHAR(150) NOT NULL,
                data_envio     DATE NOT NULL DEFAULT CURRENT_DATE,
                tipo           VARCHAR(20) NOT NULL DEFAULT 'VENCENDO',
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_alertas_exame_data
            ON alertas_exames_enviados (exame_id, data_envio);
        """))
        db.commit()
    except Exception as exc:
        print(f"⚠️  Aviso ao criar tabela de alertas: {exc}")
        db.rollback()


def _ja_recebeu_alerta_hoje(db: Session, exame_id: int) -> bool:
    """Verifica se o motorista já recebeu alerta hoje."""
    hoje = date.today()
    resultado = db.execute(text("""
        SELECT 1 FROM alertas_exames_enviados
        WHERE exame_id = :eid AND data_envio = :hoje
        LIMIT 1
    """), {"eid": exame_id, "hoje": hoje}).fetchone()
    return resultado is not None


def _ultimo_alerta(db: Session, exame_id: int) -> "date | None":
    """Retorna a data do último alerta enviado para este exame."""
    row = db.execute(text("""
        SELECT data_envio FROM alertas_exames_enviados
        WHERE exame_id = :eid
        ORDER BY data_envio DESC
        LIMIT 1
    """), {"eid": exame_id}).fetchone()
    return row[0] if row else None


def _registrar_alerta(db: Session, exame: ExameToxicologico) -> None:
    """Salva o registro de alerta enviado hoje para este motorista."""
    hoje = date.today()
    tipo = "VENCIDO" if exame.dias_para_vencer < 0 else "VENCENDO"
    db.execute(text("""
        INSERT INTO alertas_exames_enviados (exame_id, nome_motorista, data_envio, tipo)
        VALUES (:eid, :nome, :hoje, :tipo)
    """), {"eid": exame.id, "nome": exame.nome, "hoje": hoje, "tipo": tipo})
    db.commit()


# ─── Função principal do scheduler ───────────────────────────────────────────

def verificar_e_enviar_alertas(db: Session) -> dict:
    """
    Sistema inteligente de alertas automáticos.

    Lógica de disparo:
      ─ Exames VENCENDO (dias_para_vencer entre 0 e 10):
          → Envia APENAS UMA VEZ quando entra na janela.
          → Não reenvia enquanto o vencimento não mudar.
      ─ Exames VENCIDOS (dias_para_vencer < 0):
          → Reenvia alerta a cada DIAS_REENVIO_VENCIDO dias
            (padrão 3 dias) até o exame ser renovado.
      ─ Anti-duplicata diária:
          → Se já foi enviado hoje para este exame, pula.
    """
    # Garante que a tabela de controle existe
    _garantir_tabela_alertas(db)

    hoje = date.today()
    todos_exames = db.query(ExameToxicologico).all()
    a_alertar: List[ExameToxicologico] = []

    for exame in todos_exames:
        dias = exame.dias_para_vencer

        # Fora da janela de alerta e em dia — ignora
        if dias > DIAS_ALERTA:
            continue

        # Já recebeu alerta hoje — nunca duplica no mesmo dia
        if _ja_recebeu_alerta_hoje(db, exame.id):
            continue

        if dias >= 0:
            # ── Exame VENCENDO (0 a 10 dias) ──
            # Envia apenas se nunca recebeu alerta OU se recebeu alerta
            # quando ainda estava fora da janela (entrou na janela hoje).
            ultimo = _ultimo_alerta(db, exame.id)
            if ultimo is None:
                # Nunca alertado → inclui
                a_alertar.append(exame)
            else:
                # Já alertado anteriormente → inclui se hoje é o dia exato
                # em que entrou na janela (dias == DIAS_ALERTA) para reforçar,
                # ou se o último alerta foi antes da janela atual começar.
                # Na prática: não reenvia enquanto segue "VENCENDO".
                # (O reforço só ocorre para vencidos abaixo.)
                pass

        else:
            # ── Exame VENCIDO ──
            # Reenvia a cada DIAS_REENVIO_VENCIDO dias
            ultimo = _ultimo_alerta(db, exame.id)
            if ultimo is None:
                a_alertar.append(exame)
            else:
                dias_desde_ultimo = (hoje - ultimo).days
                if dias_desde_ultimo >= DIAS_REENVIO_VENCIDO:
                    a_alertar.append(exame)

    if not a_alertar:
        print(f"📭 Scheduler [{hoje}]: Nenhum novo alerta necessário.")
        return {
            "enviado": False,
            "total_alertas": 0,
            "mensagem": "Nenhum motorista requer alerta neste ciclo."
        }

    # Ordena: vencidos primeiro, depois por dias restantes (mais urgente antes)
    a_alertar.sort(key=lambda e: e.dias_para_vencer)

    enviado = _enviar_via_brevo(a_alertar)

    if enviado:
        # Registra alerta enviado para cada motorista
        for exame in a_alertar:
            try:
                _registrar_alerta(db, exame)
            except Exception as exc:
                print(f"⚠️  Erro ao registrar alerta para {exame.nome}: {exc}")
                db.rollback()

    nomes = [e.nome for e in a_alertar]
    return {
        "enviado": enviado,
        "total_alertas": len(a_alertar),
        "motoristas": nomes,
        "mensagem": (
            f"E-mail enviado — {len(a_alertar)} motorista(s): {', '.join(nomes)}."
            if enviado else
            "Alerta identificado mas falha no envio. Verifique BREVO_API_KEY e ALERT_EMAIL_TO no .env"
        )
    }


# ─── Função legada (mantida para compatibilidade com o endpoint manual) ───────

def enviar_alerta_vencimentos(exames: List[ExameToxicologico]) -> bool:
    """Envio direto sem controle de duplicatas (usado pelo endpoint manual)."""
    return _enviar_via_brevo(exames)
