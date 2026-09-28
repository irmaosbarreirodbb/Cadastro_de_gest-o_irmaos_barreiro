from typing import List, Optional
from datetime import datetime
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.encryption import encrypt_val, decrypt_val, encrypt_bytes, decrypt_bytes
from app.models.colaborador import ColaboradorCadastro
from app.models.documento_colaborador import DocumentoColaborador
from app.models.exame_toxicologico import ExameToxicologico
from app.models.cnh import CNHFuncionario
from app.models.usuario import Usuario
from app.schemas.colaborador import ColaboradorCreate, ColaboradorOut, StatusUpdate
from app.services.protocolo import gerar_protocolo
from app.api.deps import get_current_user
from app.core.rate_limit import enforce_rate_limit

router = APIRouter()

TIPOS_DOCUMENTO_PERMITIDOS = {
    "ficha_assinada",
    "identidade",
    "comprovante_residencia",
    "comprovante_bancario",
}
CONTENT_TYPES_PERMITIDOS = {"application/pdf", "image/jpeg", "image/png"}
TAMANHO_MAXIMO_DOCUMENTO = 10 * 1024 * 1024


def _validar_conteudo_documento(conteudo: bytes, content_type: str) -> None:
    assinaturas = {
        "application/pdf": b"%PDF-",
        "image/jpeg": b"\xff\xd8\xff",
        "image/png": b"\x89PNG\r\n\x1a\n",
    }
    assinatura = assinaturas.get(content_type)
    if not assinatura or not conteudo.startswith(assinatura):
        raise HTTPException(status_code=400, detail="O conteúdo do arquivo não corresponde ao tipo informado")


def _obter_colaborador_ou_404(colaborador_id: str, db: Session):
    item = db.query(ColaboradorCadastro).filter(ColaboradorCadastro.id == colaborador_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ficha cadastral nao encontrada")
    return item


def _resumo_documento(documento: DocumentoColaborador):
    return {
        "id": documento.id,
        "tipo_documento": documento.tipo_documento,
        "nome_arquivo": documento.nome_arquivo,
        "content_type": documento.content_type,
        "tamanho_bytes": documento.tamanho_bytes,
        "updated_at": documento.updated_at,
    }

def _descriptografar_colaborador(col):
    if not col:
        return col
    col.cpf = decrypt_val(col.cpf)
    col.rg = decrypt_val(col.rg)
    col.telefone = decrypt_val(col.telefone)
    col.agencia = decrypt_val(col.agencia)
    col.conta = decrypt_val(col.conta)
    col.chave_pix = decrypt_val(col.chave_pix)
    return col


# ============================================================================
# CONSULTA RÁPIDA DE MOTORISTA (CNH + EXAME TOXICOLÓGICO)
# ============================================================================
@router.get("/consultar-motorista-dados")
def consultar_motorista_dados(
    nome: str = Query(..., min_length=2, description="Nome ou termo de busca do colaborador"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Busca automaticamente nas tabelas de CNH (cnhs_funcionarios) e Exame Toxicológico
    (exames_toxicologicos) por nome para autopreenchimento no formulário de cadastro.
    """
    nome_norm = (nome or "").strip()
    if not nome_norm or len(nome_norm) < 2:
        return {"encontrado": False, "cnh": None, "exame": None}

    def _para_iso_date(data_str: Optional[str]) -> Optional[str]:
        if not data_str:
            return None
        s = str(data_str).strip()
        if "/" in s:
            partes = s.split("/")
            if len(partes) == 3:
                dia, mes, ano = partes[0].zfill(2), partes[1].zfill(2), partes[2]
                if len(ano) == 4:
                    return f"{ano}-{mes}-{dia}"
        elif "-" in s:
            partes = s.split("-")
            if len(partes) == 3 and len(partes[0]) == 4:
                return s
        return s

    def _para_display_date(data_str: Optional[str]) -> Optional[str]:
        if not data_str:
            return None
        s = str(data_str).strip()
        if "-" in s:
            partes = s.split("-")
            if len(partes) == 3 and len(partes[0]) == 4:
                return f"{partes[2].zfill(2)}/{partes[1].zfill(2)}/{partes[0]}"
        return s

    resultado_cnh = None
    resultado_exame = None
    encontrado_cnh = False
    encontrado_exame = False

    # 1. Busca na tabela de CNH (cnhs_funcionarios)
    cnh_item = db.query(CNHFuncionario).filter(
        func.trim(func.upper(CNHFuncionario.nome)) == nome_norm.upper()
    ).order_by(CNHFuncionario.id.desc()).first()

    if not cnh_item:
        cnh_item = db.query(CNHFuncionario).filter(
            CNHFuncionario.nome.ilike(f"%{nome_norm}%")
        ).order_by(CNHFuncionario.id.desc()).first()

    if cnh_item:
        encontrado_cnh = True
        cnh_num_plain = decrypt_val(cnh_item.cnh_numero) if cnh_item.cnh_numero else ""
        cnh_digits = "".join(filter(str.isdigit, cnh_num_plain)) if cnh_num_plain else cnh_num_plain
        resultado_cnh = {
            "id": cnh_item.id,
            "nome": cnh_item.nome,
            "setor": cnh_item.setor,
            "cnh_numero": cnh_digits or cnh_num_plain or "",
            "cnh_validade": _para_iso_date(cnh_item.cnh_validade),
            "cnh_validade_display": _para_display_date(cnh_item.cnh_validade) or cnh_item.cnh_validade,
            "observacao": cnh_item.observacao or ""
        }

    # 2. Busca na tabela de Exame Toxicológico (exames_toxicologicos)
    exame_item = db.query(ExameToxicologico).filter(
        func.trim(func.upper(ExameToxicologico.nome)) == nome_norm.upper()
    ).order_by(ExameToxicologico.id.desc()).first()

    if not exame_item:
        exame_item = db.query(ExameToxicologico).filter(
            ExameToxicologico.nome.ilike(f"%{nome_norm}%")
        ).order_by(ExameToxicologico.id.desc()).first()

    if exame_item:
        encontrado_exame = True
        resultado_exame = {
            "id": exame_item.id,
            "nome": exame_item.nome,
            "data_exame": _para_iso_date(exame_item.data_exame),
            "data_vencimento": _para_iso_date(exame_item.data_vencimento),
            "data_exame_display": _para_display_date(exame_item.data_exame) or exame_item.data_exame,
            "data_vencimento_display": _para_display_date(exame_item.data_vencimento) or exame_item.data_vencimento
        }

    return {
        "encontrado": bool(encontrado_cnh or encontrado_exame),
        "encontrado_cnh": encontrado_cnh,
        "encontrado_exame": encontrado_exame,
        "cnh": resultado_cnh,
        "exame": resultado_exame
    }


@router.post("", response_model=ColaboradorOut, status_code=status.HTTP_201_CREATED)
def criar_cadastro_colaborador(
    dados: ColaboradorCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    enforce_rate_limit(request, "cadastro-colaborador", limit=10, window_seconds=3600)
    protocolo = gerar_protocolo()
    agora_str = datetime.now().strftime("%d/%m/%Y %H:%M:%S")

    dados_dict = dados.model_dump()
    # Criptografa dados sensíveis antes de gravar no PostgreSQL
    dados_dict["cpf"] = encrypt_val(dados_dict.get("cpf"))
    dados_dict["rg"] = encrypt_val(dados_dict.get("rg"))
    dados_dict["telefone"] = encrypt_val(dados_dict.get("telefone"))
    dados_dict["agencia"] = encrypt_val(dados_dict.get("agencia"))
    dados_dict["conta"] = encrypt_val(dados_dict.get("conta"))
    dados_dict["chave_pix"] = encrypt_val(dados_dict.get("chave_pix"))

    colaborador = ColaboradorCadastro(
        protocolo=protocolo,
        data_emissao=agora_str,
        **dados_dict
    )
    db.add(colaborador)
    db.commit()
    db.refresh(colaborador)

    nome_norm = (dados.nome_completo or "").strip()

    def _norm_data(d_str):
        if d_str and '-' in d_str:
            parts = d_str.split('-')
            if len(parts) == 3:
                return f"{parts[2]}/{parts[1]}/{parts[0]}"
        return d_str or ""

    # Sincroniza com o módulo de exames toxicológicos se informado
    if dados.exame_toxicologico_emissao and dados.exame_toxicologico_vencimento:
        try:
            dt_ex = _norm_data(dados.exame_toxicologico_emissao)
            dt_vc = _norm_data(dados.exame_toxicologico_vencimento)

            if nome_norm and dt_ex and dt_vc:
                existente_exame = db.query(ExameToxicologico).filter(
                    func.upper(ExameToxicologico.nome) == nome_norm.upper()
                ).first()
                if existente_exame:
                    existente_exame.data_exame = dt_ex
                    existente_exame.data_vencimento = dt_vc
                else:
                    novo_exame = ExameToxicologico(
                        nome=nome_norm,
                        data_exame=dt_ex,
                        data_vencimento=dt_vc
                    )
                    db.add(novo_exame)
                db.commit()
        except Exception:
            db.rollback()

    # Sincroniza com o módulo de CNH se informado
    if dados.cnh_validade:
        try:
            dt_cnh = _norm_data(dados.cnh_validade)
            cnh_num_raw = (dados.cnh_numero or "").strip()
            cnh_num_enc = encrypt_val(cnh_num_raw) if cnh_num_raw else None

            if nome_norm and dt_cnh:
                existente_cnh = db.query(CNHFuncionario).filter(
                    func.upper(CNHFuncionario.nome) == nome_norm.upper()
                ).first()
                if existente_cnh:
                    if cnh_num_enc:
                        existente_cnh.cnh_numero = cnh_num_enc
                    existente_cnh.cnh_validade = dt_cnh
                else:
                    nova_cnh = CNHFuncionario(
                        nome=nome_norm,
                        setor="FROTA",
                        cnh_numero=cnh_num_enc,
                        cnh_validade=dt_cnh,
                        observacao="Cadastrado via Ficha de Colaborador"
                    )
                    db.add(nova_cnh)
                db.commit()
        except Exception:
            db.rollback()

    return _descriptografar_colaborador(colaborador)

@router.get("", response_model=List[ColaboradorOut])
def listar_colaboradores(
    search: Optional[str] = Query(None, description="Busca por Nome"),
    status: Optional[str] = Query(None, description="Filtro por status (PENDENTE, VALIDADO)"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = db.query(ColaboradorCadastro)
    if search:
        termo = f"%{search.strip()}%"
        query = query.filter(ColaboradorCadastro.nome_completo.ilike(termo))
    if status:
        query = query.filter(ColaboradorCadastro.status == status)
    
    lista = query.order_by(ColaboradorCadastro.created_at.desc()).all()
    return [_descriptografar_colaborador(c) for c in lista]

@router.get("/{colaborador_id}", response_model=ColaboradorOut)
def obter_colaborador(
    colaborador_id: str, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    item = db.query(ColaboradorCadastro).filter(ColaboradorCadastro.id == colaborador_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ficha cadastral não encontrada")
    return _descriptografar_colaborador(item)

@router.patch("/{colaborador_id}/status", response_model=ColaboradorOut)
def atualizar_status(
    colaborador_id: str, 
    payload: StatusUpdate, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    item = db.query(ColaboradorCadastro).filter(ColaboradorCadastro.id == colaborador_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ficha cadastral não encontrada")
    item.status = payload.status
    db.commit()
    db.refresh(item)
    return _descriptografar_colaborador(item)


@router.get("/{colaborador_id}/documentos")
def listar_documentos(
    colaborador_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _obter_colaborador_ou_404(colaborador_id, db)
    documentos = (
        db.query(DocumentoColaborador)
        .filter(DocumentoColaborador.colaborador_id == colaborador_id)
        .order_by(DocumentoColaborador.updated_at.desc())
        .all()
    )
    return [_resumo_documento(documento) for documento in documentos]


@router.post("/{colaborador_id}/documentos", status_code=status.HTTP_201_CREATED)
async def enviar_documento(
    colaborador_id: str,
    tipo_documento: str = Form(...),
    arquivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    _obter_colaborador_ou_404(colaborador_id, db)
    if tipo_documento not in TIPOS_DOCUMENTO_PERMITIDOS:
        raise HTTPException(status_code=400, detail="Espaco de documento invalido")
    if arquivo.content_type not in CONTENT_TYPES_PERMITIDOS:
        raise HTTPException(status_code=400, detail="Envie somente arquivos PDF, JPG ou PNG")

    conteudo = await arquivo.read()
    if not conteudo:
        raise HTTPException(status_code=400, detail="O arquivo enviado esta vazio")
    if len(conteudo) > TAMANHO_MAXIMO_DOCUMENTO:
        raise HTTPException(status_code=400, detail="O arquivo deve ter no maximo 10 MB")
    _validar_conteudo_documento(conteudo, arquivo.content_type)

    nome_arquivo = os.path.basename(arquivo.filename or "documento").replace('"', '').replace('\r', '').replace('\n', '')[:255]
    documento = (
        db.query(DocumentoColaborador)
        .filter(
            DocumentoColaborador.colaborador_id == colaborador_id,
            DocumentoColaborador.tipo_documento == tipo_documento,
        )
        .first()
    )
    if documento:
        documento.nome_arquivo = nome_arquivo
        documento.content_type = arquivo.content_type
        documento.tamanho_bytes = len(conteudo)
        documento.arquivo = encrypt_bytes(conteudo)
    else:
        documento = DocumentoColaborador(
            colaborador_id=colaborador_id,
            tipo_documento=tipo_documento,
            nome_arquivo=nome_arquivo,
            content_type=arquivo.content_type,
            tamanho_bytes=len(conteudo),
            arquivo=encrypt_bytes(conteudo),
        )
        db.add(documento)
    db.commit()
    db.refresh(documento)
    return _resumo_documento(documento)


@router.get("/{colaborador_id}/documentos/{documento_id}/arquivo")
def baixar_documento(
    colaborador_id: str,
    documento_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    documento = (
        db.query(DocumentoColaborador)
        .filter(
            DocumentoColaborador.id == documento_id,
            DocumentoColaborador.colaborador_id == colaborador_id,
        )
        .first()
    )
    if not documento:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")
    return Response(
        content=decrypt_bytes(documento.arquivo),
        media_type=documento.content_type,
        headers={"Content-Disposition": f'attachment; filename="{documento.nome_arquivo}"', "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/{colaborador_id}/documentos/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover_documento(
    colaborador_id: str,
    documento_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    documento = (
        db.query(DocumentoColaborador)
        .filter(
            DocumentoColaborador.id == documento_id,
            DocumentoColaborador.colaborador_id == colaborador_id,
        )
        .first()
    )
    if not documento:
        raise HTTPException(status_code=404, detail="Documento nao encontrado")
    db.delete(documento)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
