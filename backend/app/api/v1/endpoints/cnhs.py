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
from app.core.encryption import encrypt_bytes, decrypt_bytes, encrypt_val, decrypt_val
from app.models.cnh import CNHFuncionario
from app.models.usuario import Usuario
from app.api.deps import get_current_user
from app.schemas.cnh import (
    CNHCreate,
    CNHUpdate,
    CNHOut,
    ImportacaoCNHResultadoOut
)
from app.services.cnh_importer import importar_planilha_cnh
from app.services.cnh_email_service import verificar_e_enviar_alertas_cnh

router = APIRouter()

_TAMANHO_MAX = 15 * 1024 * 1024  # 15 MB


def _cnh_to_out(item: "CNHFuncionario") -> dict:
    """Converte um registro de CNH para dict com cnh_numero descriptografado."""
    cnh_num_raw = item.cnh_numero
    cnh_num_plain = decrypt_val(cnh_num_raw) if cnh_num_raw else None
    return {
        "id": item.id,
        "setor": item.setor,
        "nome": item.nome,
        "cnh_numero": cnh_num_plain,
        "cnh_validade": item.cnh_validade,
        "observacao": item.observacao,
        "status": item.status,
        "dias_para_vencer": item.dias_para_vencer,
        "tem_pdf": item.tem_pdf,
        "pdf_nome": item.pdf_nome,
        "pdf_tamanho": item.pdf_tamanho,
        "created_at": item.created_at,
        "updated_at": item.updated_at,
    }


def _verificar_alertas_cnh_background() -> None:
    """Verifica alertas de CNH em segundo plano após alterações."""
    db = SessionLocal()
    try:
        verificar_e_enviar_alertas_cnh(db)
    except Exception as exc:
        print(f"⚠️ Verificação de alerta CNH em background falhou: {exc}")
    finally:
        db.close()


# ============================================================================
# 1. LISTAR — GET /cnhs
# ============================================================================

@router.get("", response_model=List[CNHOut])
def listar_cnhs(
    busca: Optional[str] = Query(None, description="Busca por nome ou nº de CNH"),
    setor: Optional[str] = Query(None, description="Filtro por setor: FROTA | ADM"),
    status_filtro: Optional[str] = Query(None, alias="status", description="OK | VENCENDO | VENCIDO"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista todas as CNHs com filtros opcionais de setor, busca e status."""
    query = db.query(CNHFuncionario)

    if setor:
        s_norm = setor.strip().upper()
        if s_norm in ("FROTA", "ADM"):
            query = query.filter(CNHFuncionario.setor == s_norm)

    # Busca por nome e observação no banco; busca por nº CNH feita após descriptografia
    if busca:
        termo_busca = busca.strip().lower()
        query = query.filter(
            CNHFuncionario.nome.ilike(f"%{termo_busca}%")
        )

    itens = query.order_by(
        CNHFuncionario.setor.asc(),
        CNHFuncionario.nome.asc()
    ).all()

    # Filtragem por busca no nº CNH (descriptografado)
    if busca:
        termo_busca = busca.strip().lower()
        itens_filtrados = []
        for item in itens:
            # Já filtrado por nome acima; adiciona todos esses
            itens_filtrados.append(item)
        # Também busca registros que casem pelo nº CNH descriptografado
        todos = db.query(CNHFuncionario)
        if setor:
            s_norm = setor.strip().upper()
            if s_norm in ("FROTA", "ADM"):
                todos = todos.filter(CNHFuncionario.setor == s_norm)
        ids_ja = {i.id for i in itens_filtrados}
        for item in todos.all():
            if item.id not in ids_ja:
                num_plain = decrypt_val(item.cnh_numero) if item.cnh_numero else ""
                if termo_busca in (num_plain or "").lower():
                    itens_filtrados.append(item)
        itens = itens_filtrados

    if status_filtro:
        s = status_filtro.strip().upper()
        itens = [item for item in itens if item.status == s]

    return [_cnh_to_out(i) for i in itens]


# ============================================================================
# 2. CRIAR — POST /cnhs
# ============================================================================

@router.post("", response_model=CNHOut, status_code=status.HTTP_201_CREATED)
def criar_cnh(
    dados: CNHCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Cadastra manualmente uma nova CNH para um funcionário."""
    nome_norm = dados.nome.strip()
    if not nome_norm:
        raise HTTPException(status_code=400, detail="O nome do funcionário é obrigatório.")

    setor_norm = (dados.setor or "FROTA").strip().upper()
    if setor_norm not in ("FROTA", "ADM"):
        setor_norm = "FROTA"

    # Verifica duplicata
    existente = db.query(CNHFuncionario).filter(
        func.upper(CNHFuncionario.nome) == nome_norm.upper()
    ).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail=f"Funcionário '{nome_norm}' já cadastrado. Edite o registro existente para atualizar."
        )

    # Criptografa o número da CNH antes de persistir
    cnh_num_enc = encrypt_val(dados.cnh_numero.strip()) if dados.cnh_numero else None

    novo = CNHFuncionario(
        setor=setor_norm,
        nome=nome_norm,
        cnh_numero=cnh_num_enc,
        cnh_validade=dados.cnh_validade.strip(),
        observacao=dados.observacao.strip() if dados.observacao else None
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    background_tasks.add_task(_verificar_alertas_cnh_background)
    return _cnh_to_out(novo)


# ============================================================================
# 3. ATUALIZAR — PUT /cnhs/{id}
# ============================================================================

@router.put("/{cnh_id}", response_model=CNHOut)
def atualizar_cnh(
    cnh_id: int,
    dados: CNHUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Atualiza dados de uma CNH existente."""
    registro = db.query(CNHFuncionario).filter(CNHFuncionario.id == cnh_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro de CNH não encontrado.")

    update_data = dados.dict(exclude_unset=True)
    validade_alterada = "cnh_validade" in update_data

    for field, val in update_data.items():
        if field == "setor" and isinstance(val, str):
            setattr(registro, field, val.strip().upper())
        elif field == "cnh_numero" and isinstance(val, str):
            # Criptografa o número da CNH ao atualizar
            setattr(registro, field, encrypt_val(val.strip()) if val.strip() else None)
        elif isinstance(val, str):
            setattr(registro, field, val.strip())
        else:
            setattr(registro, field, val)

    registro.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(registro)

    if validade_alterada:
        db.execute(
            text("DELETE FROM alertas_cnh_enviados WHERE cnh_id = :cnh_id"),
            {"cnh_id": registro.id},
        )
        db.commit()

    background_tasks.add_task(_verificar_alertas_cnh_background)
    return _cnh_to_out(registro)


# ============================================================================
# 4. EXCLUIR — DELETE /cnhs/{id}
# ============================================================================

@router.delete("/{cnh_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_cnh(
    cnh_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Exclui um registro de CNH."""
    registro = db.query(CNHFuncionario).filter(CNHFuncionario.id == cnh_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro de CNH não encontrado.")

    # Remove alertas vinculados
    db.execute(
        text("DELETE FROM alertas_cnh_enviados WHERE cnh_id = :cnh_id"),
        {"cnh_id": registro.id},
    )
    db.delete(registro)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ============================================================================
# 5. LIMPAR TODOS — DELETE /cnhs/limpar-todos
# ============================================================================

@router.delete("/limpar-todos", status_code=status.HTTP_200_OK)
def limpar_todas_cnhs(
    setor: Optional[str] = Query(None, description="FROTA | ADM"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Remove registros de CNH (opcionalmente apenas de um setor)."""
    query = db.query(CNHFuncionario)
    if setor:
        s_norm = setor.strip().upper()
        if s_norm in ("FROTA", "ADM"):
            query = query.filter(CNHFuncionario.setor == s_norm)

    total = query.delete(synchronize_session=False)
    db.commit()
    return {"mensagem": f"{total} registro(s) de CNH removido(s) com sucesso.", "total": total}


# ============================================================================
# 6. IMPORTAR PLANILHA — POST /cnhs/importar-planilha
# ============================================================================

@router.post("/importar-planilha", response_model=ImportacaoCNHResultadoOut)
async def importar_planilha(
    background_tasks: BackgroundTasks,
    setor: Optional[str] = Query("FROTA", description="Setor padrão caso a planilha não possua abas/coluna: FROTA | ADM"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Importa planilha Excel (.xlsx, .xls) ou CSV com CNHs dos funcionários."""
    if not file.filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Formato inválido. Envie um arquivo .xlsx, .xls ou .csv.")

    file_bytes = await file.read()
    if len(file_bytes) > _TAMANHO_MAX:
        raise HTTPException(status_code=400, detail="O arquivo deve ter no máximo 15 MB.")

    try:
        inseridos, atualizados, ignorados, erros = importar_planilha_cnh(
            file_bytes, file.filename, db, setor_padrao=setor
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao processar planilha de CNH: {str(e)}")

    total_importados = inseridos + atualizados
    if total_importados:
        background_tasks.add_task(_verificar_alertas_cnh_background)

    return ImportacaoCNHResultadoOut(
        total_importados=inseridos,
        total_atualizados=atualizados,
        total_ignorados=ignorados,
        mensagem=(
            f"Importação concluída com sucesso! {inseridos} novo(s) condutor(es) cadastrado(s), "
            f"{atualizados} atualizado(s) e {ignorados} ignorado(s)."
        ),
        erros=erros
    )


# ============================================================================
# 7. EXPORTAR PDF — GET /cnhs/exportar-pdf
# ============================================================================

@router.get("/exportar-pdf")
def exportar_pdf(
    setor: Optional[str] = Query(None, description="FROTA | ADM | vazio para ambos"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Gera PDF oficial de Controle de Vencimentos CNH fiel à folha física."""
    query = db.query(CNHFuncionario)
    if setor:
        s_norm = setor.strip().upper()
        if s_norm in ("FROTA", "ADM"):
            query = query.filter(CNHFuncionario.setor == s_norm)

    cnhs = query.order_by(
        CNHFuncionario.setor.asc(),
        CNHFuncionario.nome.asc()
    ).all()

    if not cnhs:
        raise HTTPException(status_code=404, detail="Nenhum registro de CNH encontrado para exportação.")

    pdf_bytes = _gerar_pdf_cnh(cnhs, setor_filtro=setor)
    data_str = datetime.now().strftime("%Y%m%d_%H%M")
    filename = f"controle_vencimentos_cnh_{data_str}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )


def _gerar_pdf_cnh(cnhs: List[CNHFuncionario], setor_filtro: Optional[str] = None) -> bytes:
    """Gera PDF fiel ao layout oficial de Controle de Vencimentos CNH Funcionários DIB."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=10 * mm,
        bottomMargin=12 * mm,
        leftMargin=10 * mm,
        rightMargin=10 * mm
    )

    AMARELO_BANNER = colors.HexColor("#EAB308")     # Amarelo clássico da folha
    AMARELO_CABECALHO = colors.HexColor("#FEF08A")  # Amarelo suave
    CINZA_COLUNAS = colors.HexColor("#E2E8F0")
    CINZA_BORDA = colors.HexColor("#94A3B8")
    TEXTO_ESCURO = colors.HexColor("#0F172A")
    VERMELHO_TEXTO = colors.HexColor("#DC2626")

    estilo_titulo = ParagraphStyle(
        "TituloCNH",
        fontSize=11,
        fontName="Helvetica-Bold",
        textColor=TEXTO_ESCURO,
        alignment=TA_CENTER,
        leading=14
    )
    estilo_data_topo = ParagraphStyle(
        "DataTopo",
        fontSize=8,
        fontName="Helvetica",
        textColor=colors.HexColor("#334155"),
        alignment=TA_RIGHT
    )
    estilo_setor_titulo = ParagraphStyle(
        "SetorTitulo",
        fontSize=10,
        fontName="Helvetica-Bold",
        textColor=TEXTO_ESCURO,
        alignment=TA_CENTER
    )
    estilo_col_header = ParagraphStyle(
        "ColHeader",
        fontSize=8,
        fontName="Helvetica-Bold",
        textColor=TEXTO_ESCURO,
        alignment=TA_CENTER
    )
    estilo_celula_centro = ParagraphStyle(
        "CelCentro",
        fontSize=7.5,
        fontName="Helvetica",
        textColor=TEXTO_ESCURO,
        alignment=TA_CENTER
    )
    estilo_celula_esq = ParagraphStyle(
        "CelEsq",
        fontSize=7.5,
        fontName="Helvetica",
        textColor=TEXTO_ESCURO,
        alignment=TA_LEFT
    )
    estilo_celula_cnh_num = ParagraphStyle(
        "CelCNHNum",
        fontSize=7.5,
        fontName="Helvetica",
        textColor=VERMELHO_TEXTO,
        alignment=TA_CENTER
    )

    elementos = []

    # 1. Logo da empresa
    logo_path = Path(__file__).resolve().parents[4] / "brand" / "logo-irmaos-barreiro.png"
    if logo_path.exists():
        logo = Image(str(logo_path), width=45 * mm, height=45 * mm * 616 / 1280)
        logo.hAlign = "CENTER"
        elementos.append(logo)
        elementos.append(Spacer(1, 2 * mm))

    # 2. Data no topo à direita
    data_emissao = datetime.now().strftime("%d/%m/%Y")
    elementos.append(Paragraph(f"Emissão: <b>{data_emissao}</b>", estilo_data_topo))
    elementos.append(Spacer(1, 2 * mm))

    # 3. Faixa de Título Principal: "Controle de Vencimentos CNH Funcionarios DIB"
    largura_total = 190 * mm
    tabela_titulo = Table(
        [[Paragraph("Controle de Vencimentos CNH Funcionarios DIB", estilo_titulo)]],
        colWidths=[largura_total],
        rowHeights=[18]
    )
    tabela_titulo.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AMARELO_BANNER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LINEBELOW", (0, 0), (-1, -1), 1, CINZA_BORDA),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))
    elementos.append(tabela_titulo)
    elementos.append(Spacer(1, 3 * mm))

    # Separa grupos por setor
    grupos = {}
    if not setor_filtro or setor_filtro.upper() not in ("FROTA", "ADM"):
        grupos["Frota"] = [c for c in cnhs if (c.setor or "").upper() == "FROTA"]
        grupos["Adm"] = [c for c in cnhs if (c.setor or "").upper() == "ADM"]
    elif setor_filtro.upper() == "FROTA":
        grupos["Frota"] = [c for c in cnhs if (c.setor or "").upper() == "FROTA"]
    else:
        grupos["Adm"] = [c for c in cnhs if (c.setor or "").upper() == "ADM"]

    larguras_colunas = [10 * mm, 72 * mm, 28 * mm, 32 * mm, 48 * mm]

    for nome_setor, lista_setor in grupos.items():
        if not lista_setor and len(grupos) > 1:
            continue

        # Cabeçalho da Seção (Amarelo)
        tabela_secao = Table(
            [[Paragraph(nome_setor, estilo_setor_titulo)]],
            colWidths=[largura_total],
            rowHeights=[16]
        )
        tabela_secao.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), AMARELO_CABECALHO),
            ("BOX", (0, 0), (-1, -1), 1, CINZA_BORDA),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        elementos.append(tabela_secao)

        # Cabeçalho das Colunas
        dados_tabela = [
            [
                Paragraph("<b>№</b>", estilo_col_header),
                Paragraph("<b>FUNCIONÁRIOS</b>", estilo_col_header),
                Paragraph("<b>CNH Validade</b>", estilo_col_header),
                Paragraph("<b>№ CNH</b>", estilo_col_header),
                Paragraph("<b>Observação</b>", estilo_col_header),
            ]
        ]

        # Linhas de dados (cnh_numero descriptografado antes de exibir)
        for idx, item in enumerate(lista_setor, start=1):
            cnh_num_pdf = decrypt_val(item.cnh_numero) if item.cnh_numero else "-"
            dados_tabela.append([
                Paragraph(str(idx), estilo_celula_centro),
                Paragraph(str(item.nome), estilo_celula_esq),
                Paragraph(str(item.cnh_validade or "-"), estilo_celula_centro),
                Paragraph(str(cnh_num_pdf or "-"), estilo_celula_cnh_num),
                Paragraph(str(item.observacao or ""), estilo_celula_esq),
            ])

        tabela_dados = Table(
            dados_tabela,
            colWidths=larguras_colunas,
            repeatRows=1
        )
        tabela_dados.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), CINZA_COLUNAS),
            ("GRID", (0, 0), (-1, -1), 0.5, CINZA_BORDA),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("LEFTPADDING", (0, 0), (-1, -1), 3),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        elementos.append(tabela_dados)
        elementos.append(Spacer(1, 4 * mm))

    # Resumo final
    elementos.append(
        Paragraph(
            f"<font color='#64748B' size='7'>Total de condutores cadastrados: <b>{len(cnhs)}</b></font>",
            ParagraphStyle("TotalFinalCNH", fontSize=7, alignment=TA_RIGHT, spaceBefore=2),
        )
    )

    doc.build(elementos)
    return buf.getvalue()


# ============================================================================
# 8. VERIFICAR VENCIMENTOS E ENVIAR E-MAIL — POST /cnhs/verificar-vencimentos
# ============================================================================

@router.post("/verificar-vencimentos")
def verificar_vencimentos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Verifica CNHs próximas do vencimento e dispara alerta via Brevo."""
    resultado = verificar_e_enviar_alertas_cnh(db, forcar=True)
    return resultado


# ============================================================================
# 9. UPLOAD PDF DA CNH — POST /cnhs/{cnh_id}/pdf
# ============================================================================

@router.post("/{cnh_id}/pdf", response_model=CNHOut)
async def upload_pdf_cnh(
    cnh_id: int,
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Armazena o documento PDF da CNH do condutor com criptografia no banco."""
    registro = db.query(CNHFuncionario).filter(CNHFuncionario.id == cnh_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro de CNH não encontrado.")

    ext = Path(arquivo.filename or "").suffix.lower()
    if ext != ".pdf" and arquivo.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos.")

    conteudo = await arquivo.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="O arquivo enviado está vazio.")
    if len(conteudo) > _TAMANHO_MAX:
        raise HTTPException(status_code=400, detail="O arquivo PDF deve ter no máximo 15 MB.")

    if not conteudo.startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="O arquivo fornecido não é um documento PDF válido.")

    nome_arquivo = os.path.basename(arquivo.filename or "cnh_documento.pdf").replace('"', '').replace('\r', '').replace('\n', '')[:255]

    registro.pdf_arquivo = encrypt_bytes(conteudo)
    registro.pdf_nome = nome_arquivo
    registro.pdf_content_type = "application/pdf"
    registro.pdf_tamanho = len(conteudo)
    registro.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(registro)
    return _cnh_to_out(registro)

@router.get("/{cnh_id}/pdf")
def obter_pdf_cnh(
    cnh_id: int,
    download: bool = Query(False, description="Se True, baixa como anexo; caso contrário, abre inline"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Retorna o documento PDF da CNH armazenado no banco para visualização ou download."""
    registro = db.query(CNHFuncionario).filter(CNHFuncionario.id == cnh_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro de CNH não encontrado.")

    if not registro.pdf_arquivo:
        raise HTTPException(status_code=404, detail="Nenhum arquivo PDF anexado para este condutor.")

    pdf_bytes = decrypt_bytes(registro.pdf_arquivo)
    disposition = "attachment" if download else "inline"
    nome = registro.pdf_nome or f"cnh_{registro.nome.replace(' ', '_')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{nome}"',
            "X-Content-Type-Options": "nosniff"
        }
    )


# ============================================================================
# 11. REMOVER PDF DA CNH — DELETE /cnhs/{cnh_id}/pdf
# ============================================================================

@router.delete("/{cnh_id}/pdf", response_model=CNHOut)
def remover_pdf_cnh(
    cnh_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Remove o documento PDF anexado da CNH."""
    registro = db.query(CNHFuncionario).filter(CNHFuncionario.id == cnh_id).first()
    if not registro:
        raise HTTPException(status_code=404, detail="Registro de CNH não encontrado.")

    registro.pdf_arquivo = None
    registro.pdf_nome = None
    registro.pdf_content_type = None
    registro.pdf_tamanho = None
    registro.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(registro)
    return _cnh_to_out(registro)
