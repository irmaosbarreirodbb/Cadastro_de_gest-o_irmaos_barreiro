from typing import List, Optional
from datetime import datetime
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.encryption import encrypt_val, decrypt_val, encrypt_bytes, decrypt_bytes
from app.models.colaborador import ColaboradorCadastro
from app.models.documento_colaborador import DocumentoColaborador
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
