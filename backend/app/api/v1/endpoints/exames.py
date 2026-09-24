import io
import os
from pathlib import Path
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, text

from app.core.database import get_db, SessionLocal
from app.core.encryption import encrypt_bytes, decrypt_bytes
from app.models.exame_toxicologico import ExameToxicologico
from app.models.usuario import Usuario
from app.api.deps import get_current_user
from app.schemas.exame_toxicologico import (
    ExameToxicologicoCreate,
    ExameToxicologicoUpdate,
    ExameToxicologicoOut,
    ImportacaoExameResultadoOut
)
from app.services.exame_importer import importar_planilha_exames
from app.services.email_service import verificar_e_enviar_alertas

router = APIRouter()

_TAMANHO_MAX = 10 * 1024 * 1024  # 10 MB


def _verificar_alertas_em_background() -> None:
    """Verifica alertas após uma alteração, sem atrasar a resposta da API."""
    db = SessionLocal()
    try:
        verificar_e_enviar_alertas(db)
    except Exception as exc:
        print(f"⚠️ Verificação de alerta após alteração falhou: {exc}")
    finally:
        db.close()


# ============================================================================
# 1. LISTAR — GET /exames
# ============================================================================

@router.get("", response_model=List[ExameToxicologicoOut])
def listar_exames(
    busca: Optional[str] = Query(None, description="Busca por nome do motorista"),
    status_filtro: Optional[str] = Query(None, alias="status", description="OK | VENCENDO | VENCIDO"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista todos os exames toxicológicos com filtros opcionais."""
    query = db.query(ExameToxicologico)
    if busca:
        query = query.filter(ExameToxicologico.nome.ilike(f"%{busca.strip()}%"))
    exames = query.order_by(ExameToxicologico.nome.asc()).all()
    if status_filtro:
        s = status_filtro.strip().upper()
        exames = [e for e in exames if e.status == s]
    return exames


# ============================================================================
# 2. CRIAR — POST /exames
# ============================================================================

@router.post("", response_model=ExameToxicologicoOut, status_code=status.HTTP_201_CREATED)
def criar_exame(
    dados: ExameToxicologicoCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Cadastra manualmente um novo exame toxicológico."""
    nome_norm = dados.nome.strip()
    if not nome_norm:
        raise HTTPException(status_code=400, detail="O nome do motorista é obrigatório.")

    # Verifica duplicata
    existente = db.query(ExameToxicologico).filter(
        func.upper(ExameToxicologico.nome) == nome_norm.upper()
    ).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"Motorista '{nome_norm}' já cadastrado. Use edição para atualizar."
        )

    novo = ExameToxicologico(
        nome=nome_norm,
        data_exame=dados.data_exame.strip(),
        data_vencimento=dados.data_vencimento.strip()
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    background_tasks.add_task(_verificar_alertas_em_background)
    return novo


# ============================================================================
# 3. ATUALIZAR — PUT /exames/{id}
# ============================================================================

@router.put("/{exame_id}", response_model=ExameToxicologicoOut)
def atualizar_exame(
    exame_id: int,
    dados: ExameToxicologicoUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Atualiza dados de um exame existente."""
    exame = db.query(ExameToxicologico).filter(ExameToxicologico.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado.")

    update_data = dados.dict(exclude_unset=True)
    validade_alterada = "data_vencimento" in update_data
    for field, val in update_data.items():
        setattr(exame, field, val.strip() if isinstance(val, str) else val)

    exame.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(exame)
    if validade_alterada:
        db.execute(
            text("DELETE FROM alertas_exames_enviados WHERE exame_id = :exame_id"),
            {"exame_id": exame.id},
        )
        db.commit()
    background_tasks.add_task(_verificar_alertas_em_background)
    return exame


# ============================================================================
# 4. EXCLUIR — DELETE /exames/{id}
# ============================================================================

@router.delete("/{exame_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_exame(
    exame_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Exclui um exame toxicológico."""
    exame = db.query(ExameToxicologico).filter(ExameToxicologico.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado.")
    db.delete(exame)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# 5. LIMPAR TODOS — DELETE /exames/limpar-todos
# ============================================================================

@router.delete("/limpar-todos", status_code=status.HTTP_200_OK)
def limpar_todos_exames(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Remove todos os registros de exames toxicológicos."""
    total = db.query(ExameToxicologico).delete()
    db.commit()
    return {"mensagem": f"{total} registro(s) removido(s) com sucesso.", "total": total}


# ============================================================================
# 6. IMPORTAR PLANILHA — POST /exames/importar-planilha
# ============================================================================

@router.post("/importar-planilha", response_model=ImportacaoExameResultadoOut)
async def importar_planilha(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Importa planilha Excel ou CSV com dados de exames toxicológicos."""
    if not file.filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Formato inválido. Envie .xlsx, .xls ou .csv.")

    file_bytes = await file.read()
    if len(file_bytes) > _TAMANHO_MAX:
        raise HTTPException(status_code=400, detail="Arquivo deve ter no máximo 10 MB.")

    try:
        inseridos, atualizados, ignorados, erros = importar_planilha_exames(
            file_bytes, file.filename, db
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar planilha: {str(e)}")

    total_importados = inseridos + atualizados
    if total_importados:
        background_tasks.add_task(_verificar_alertas_em_background)
    return ImportacaoExameResultadoOut(
        total_importados=inseridos,
        total_atualizados=atualizados,
        total_ignorados=ignorados,
        mensagem=(
            f"Importação concluída! {inseridos} novo(s) inserido(s), "
            f"{atualizados} atualizado(s), {ignorados} ignorado(s)."
        ),
        erros=erros
    )


# ============================================================================
# 7. EXPORTAR PDF — GET /exames/exportar-pdf
# ============================================================================

@router.get("/exportar-pdf")
def exportar_pdf(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Gera PDF com a relação completa de motoristas e exames toxicológicos."""
    exames = db.query(ExameToxicologico).order_by(ExameToxicologico.nome.asc()).all()
    if not exames:
        raise HTTPException(status_code=404, detail="Nenhum exame cadastrado.")

    pdf_bytes = _gerar_pdf(exames)
    data_str = datetime.now().strftime("%Y%m%d_%H%M")
    filename = f"exames_toxicologicos_{data_str}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )


def _gerar_pdf(exames: List[ExameToxicologico]) -> bytes:
    """Gera PDF fiel ao documento físico (logo + tabela 3 colunas)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import HRFlowable

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        leftMargin=15 * mm,
        rightMargin=15 * mm
    )

    VERMELHO = colors.HexColor("#B91C1C")
    AMARELO = colors.HexColor("#FDE047")
    AMARELO_FUNDO = colors.HexColor("#FEF9C3")
    CINZA_HEADER = colors.HexColor("#F1F5F9")
    CINZA_BORDA = colors.HexColor("#CBD5E1")
    LARANJA_ALERTA = colors.HexColor("#FEF3C7")
    VERMELHO_CLARO = colors.HexColor("#FEE2E2")

    estilo_titulo = ParagraphStyle(
        "Titulo",
        fontSize=13,
        fontName="Helvetica-Bold",
        textColor=colors.black,
        alignment=TA_CENTER,
        spaceAfter=2
    )
    estilo_subtitulo = ParagraphStyle(
        "Subtitulo",
        fontSize=9,
        fontName="Helvetica",
        textColor=colors.HexColor("#475569"),
        alignment=TA_CENTER,
        spaceAfter=8
    )
    estilo_empresa = ParagraphStyle(
        "Empresa",
        fontSize=16,
        fontName="Helvetica-Bold",
        textColor=VERMELHO,
        alignment=TA_CENTER,
        spaceAfter=2
    )

    data_emissao = datetime.now().strftime("%d/%m/%Y")
    elementos = []

    # Cabeçalho
    elementos.append(Paragraph("IRMÃOS BARREIRO", estilo_empresa))
    logo_path = Path(__file__).resolve().parents[4] / "brand" / "logo-irmaos-barreiro.png"
    if logo_path.exists():
        logo = Image(str(logo_path), width=58 * mm, height=58 * mm * 616 / 1280)
        logo.hAlign = "CENTER"
        elementos.insert(0, logo)
    elementos.append(Paragraph("Distribuidora de Bebidas Ltda", estilo_subtitulo))
    elementos.append(HRFlowable(width="100%", thickness=1, color=VERMELHO))
    elementos.append(Spacer(1, 4 * mm))

    # Caixa amarela de título (igual à foto)
    titulo_box_data = [[
        Paragraph(
            "<b>Relação Motoristas com Controle Exame Toxicológico</b>",
            ParagraphStyle("TitBox", fontSize=11, fontName="Helvetica-Bold",
                           alignment=TA_CENTER, textColor=colors.black)
        )
    ]]
    titulo_box = Table(titulo_box_data, colWidths=["100%"])
    titulo_box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AMARELO),
        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#92400E")),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    elementos.append(titulo_box)

    # Data de emissão à direita
    elementos.append(
        Paragraph(
            f"<font color='#6B7280' size='8'>Emitido em: {data_emissao}</font>",
            ParagraphStyle("DataRight", fontSize=8, alignment=TA_RIGHT, spaceAfter=4)
        )
    )
    elementos.append(Spacer(1, 2 * mm))

    # Tabela principal
    cabecalho = [
        Paragraph("<b>Motorista</b>", ParagraphStyle("CH", fontSize=9, fontName="Helvetica-Bold", alignment=TA_LEFT)),
        Paragraph("<b>Exame Toxicológico</b>", ParagraphStyle("CH2", fontSize=9, fontName="Helvetica-Bold", alignment=TA_CENTER)),
        Paragraph("<b>Vencimento</b>", ParagraphStyle("CH3", fontSize=9, fontName="Helvetica-Bold", alignment=TA_CENTER)),
    ]
    dados_tabela = [cabecalho]

    for ex in exames:
        dias = ex.dias_para_vencer
        nome_par = Paragraph(ex.nome, ParagraphStyle("Cell", fontSize=8.5, alignment=TA_LEFT))
        exame_par = Paragraph(ex.data_exame, ParagraphStyle("CellC", fontSize=8.5, alignment=TA_CENTER))
        venc_par = Paragraph(ex.data_vencimento, ParagraphStyle("CellC2", fontSize=8.5, alignment=TA_CENTER))
        dados_tabela.append([nome_par, exame_par, venc_par])

    largura_util = A4[0] - 30 * mm  # 180mm
    tabela = Table(
        dados_tabela,
        colWidths=[largura_util * 0.55, largura_util * 0.225, largura_util * 0.225],
        repeatRows=1
    )

    # Estilos base
    estilos = [
        ("BACKGROUND", (0, 0), (-1, 0), CINZA_HEADER),
        ("BOX", (0, 0), (-1, -1), 0.5, CINZA_BORDA),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, CINZA_BORDA),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]

    # Destaque por status (vencidos/vencendo)
    for i, ex in enumerate(exames, start=1):
        dias = ex.dias_para_vencer
        if dias < 0:
            estilos.append(("BACKGROUND", (0, i), (-1, i), VERMELHO_CLARO))
        elif dias <= 10:
            estilos.append(("BACKGROUND", (0, i), (-1, i), LARANJA_ALERTA))

    tabela.setStyle(TableStyle(estilos))
    elementos.append(tabela)

    # Rodapé com legenda
    elementos.append(Spacer(1, 6 * mm))
    elementos.append(HRFlowable(width="100%", thickness=0.5, color=CINZA_BORDA))
    elementos.append(Spacer(1, 2 * mm))
    elementos.append(
        Paragraph(
            "<font color='#6B7280' size='7'>"
            "🟡 Fundo amarelo = vencendo em até 10 dias &nbsp;&nbsp;|&nbsp;&nbsp; 🔴 Fundo vermelho = vencido"
            "</font>",
            ParagraphStyle("Legenda", fontSize=7, alignment=TA_CENTER)
        )
    )
    elementos.append(
        Paragraph(
            f"<font color='#94A3B8' size='7'>Total de motoristas: {len(exames)}</font>",
            ParagraphStyle("Total", fontSize=7, alignment=TA_RIGHT, spaceBefore=2)
        )
    )

    # Remove a legenda antiga (que usava emojis e podia virar quadrados)
    # e recria os marcadores com células coloridas compatíveis com qualquer fonte.
    elementos = [
        item for item in elementos
        if not (
            hasattr(item, "getPlainText")
            and (
                "Fundo amarelo" in item.getPlainText()
                or "Total de motoristas:" in item.getPlainText()
            )
        )
    ]
    legenda = Table(
        [[
            "",
            Paragraph("Fundo amarelo = vencendo em ate 10 dias", ParagraphStyle("LegendaAmarela", fontSize=7, textColor=colors.HexColor("#64748B"))),
            "",
            Paragraph("Fundo vermelho = vencido", ParagraphStyle("LegendaVermelha", fontSize=7, textColor=colors.HexColor("#64748B"))),
        ]],
        colWidths=[3.5 * mm, 58 * mm, 3.5 * mm, 34 * mm],
        hAlign="CENTER",
    )
    legenda.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), AMARELO_FUNDO),
        ("BACKGROUND", (2, 0), (2, 0), VERMELHO_CLARO),
        ("BOX", (0, 0), (0, 0), 0.3, colors.HexColor("#D97706")),
        ("BOX", (2, 0), (2, 0), 0.3, colors.HexColor("#DC2626")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 1),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    elementos.append(legenda)
    elementos.append(
        Paragraph(
            f"<font color='#94A3B8' size='7'>Total de motoristas: {len(exames)}</font>",
            ParagraphStyle("TotalFinal", fontSize=7, alignment=TA_RIGHT, spaceBefore=3),
        )
    )

    doc.build(elementos)
    return buf.getvalue()


# ============================================================================
# 8. VERIFICAR VENCIMENTOS E ENVIAR E-MAIL — POST /exames/verificar-vencimentos
# ============================================================================

@router.post("/verificar-vencimentos")
def verificar_vencimentos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Verifica exames próximos do vencimento e dispara alerta via Brevo."""
    resultado = verificar_e_enviar_alertas(db)
    return resultado


# ============================================================================
# 9. UPLOAD PDF DO LAUDO — POST /exames/{exame_id}/pdf
# ============================================================================

@router.post("/{exame_id}/pdf", response_model=ExameToxicologicoOut)
async def upload_pdf_exame(
    exame_id: int,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Armazena o documento PDF do exame toxicológico no banco de dados."""
    exame = db.query(ExameToxicologico).filter(ExameToxicologico.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado.")

    ext = Path(arquivo.filename or "").suffix.lower()
    if ext != ".pdf" and arquivo.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos.")

    conteudo = await arquivo.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="O arquivo enviado está vazio.")
    if len(conteudo) > 15 * 1024 * 1024:  # 15 MB
        raise HTTPException(status_code=400, detail="O arquivo PDF deve ter no máximo 15 MB.")

    if not conteudo.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="O arquivo fornecido não é um documento PDF válido.")

    nome_arquivo = os.path.basename(arquivo.filename or "laudo_toxicologico.pdf").replace('"', '').replace('\r', '').replace('\n', '')[:255]

    exame.pdf_arquivo = encrypt_bytes(conteudo)
    exame.pdf_nome = nome_arquivo
    exame.pdf_content_type = "application/pdf"
    exame.pdf_tamanho = len(conteudo)
    exame.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(exame)
    return exame


# ============================================================================
# 10. VISUALIZAR / BAIXAR PDF DO LAUDO — GET /exames/{exame_id}/pdf
# ============================================================================

@router.get("/{exame_id}/pdf")
def obter_pdf_exame(
    exame_id: int,
    download: bool = Query(False, description="Se True, baixa como anexo; caso contrário, abre inline"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Retorna o laudo PDF armazenado no banco de dados para visualização ou download."""
    exame = db.query(ExameToxicologico).filter(ExameToxicologico.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado.")

    if not exame.pdf_arquivo:
        raise HTTPException(status_code=404, detail="Nenhum arquivo PDF anexado para este exame.")

    pdf_bytes = decrypt_bytes(exame.pdf_arquivo)
    disposition = "attachment" if download else "inline"
    nome = exame.pdf_nome or f"exame_toxicologico_{exame.id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{nome}"',
            "X-Content-Type-Options": "nosniff"
        }
    )


# ============================================================================
# 11. REMOVER PDF DO LAUDO — DELETE /exames/{exame_id}/pdf
# ============================================================================

@router.delete("/{exame_id}/pdf", response_model=ExameToxicologicoOut)
def remover_pdf_exame(
    exame_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Remove o laudo PDF vinculado ao exame toxicológico."""
    exame = db.query(ExameToxicologico).filter(ExameToxicologico.id == exame_id).first()
    if not exame:
        raise HTTPException(status_code=404, detail="Exame não encontrado.")

    exame.pdf_arquivo = None
    exame.pdf_nome = None
    exame.pdf_content_type = None
    exame.pdf_tamanho = None
    exame.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(exame)
    return exame
