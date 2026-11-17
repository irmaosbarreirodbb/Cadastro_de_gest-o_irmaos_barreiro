import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.core.uploads import ler_com_limite
from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.encryption import decrypt_bytes, encrypt_bytes
from app.models.documento_pessoa_juridica import DocumentoPessoaJuridica
from app.models.pessoa_juridica import PessoaJuridicaCadastro
from app.models.usuario import Usuario

router = APIRouter()
_TIPOS = {"application/pdf", "image/jpeg", "image/png"}
_MAXIMO = 10 * 1024 * 1024


def _validar_conteudo(conteudo: bytes, content_type: str) -> None:
    assinaturas = {
        "application/pdf": b"%PDF-",
        "image/jpeg": b"\xff\xd8\xff",
        "image/png": b"\x89PNG\r\n\x1a\n",
    }
    assinatura = assinaturas.get(content_type)
    if not assinatura or not conteudo.startswith(assinatura):
        raise HTTPException(status_code=400, detail="O conteúdo do arquivo não corresponde ao tipo informado")


def _buscar_cadastro(cadastro_id, db):
    cadastro = db.query(PessoaJuridicaCadastro).filter(PessoaJuridicaCadastro.id == cadastro_id).first()
    if not cadastro:
        raise HTTPException(status_code=404, detail="Cadastro de pessoa jurídica não encontrado")
    return cadastro


def _resumo(item):
    return {"id": item.id, "posicao": item.posicao, "nome_arquivo": item.nome_arquivo, "content_type": item.content_type, "tamanho_bytes": item.tamanho_bytes, "updated_at": item.updated_at}


@router.get("/{cadastro_id}/documentos")
def listar(cadastro_id: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    _buscar_cadastro(cadastro_id, db)
    itens = db.query(DocumentoPessoaJuridica).filter(DocumentoPessoaJuridica.pessoa_juridica_id == cadastro_id).order_by(DocumentoPessoaJuridica.posicao).all()
    return [_resumo(item) for item in itens]


@router.post("/{cadastro_id}/documentos", status_code=status.HTTP_201_CREATED)
async def enviar(cadastro_id: str, posicao: int = Form(...), arquivo: UploadFile = File(...), db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    _buscar_cadastro(cadastro_id, db)
    if posicao < 1 or posicao > 8:
        raise HTTPException(status_code=400, detail="Posição de documento inválida")
    if arquivo.content_type not in _TIPOS:
        raise HTTPException(status_code=400, detail="Envie somente arquivos PDF, JPG ou PNG")
    conteudo = await ler_com_limite(arquivo, _MAXIMO)
    if not conteudo or len(conteudo) > _MAXIMO:
        raise HTTPException(status_code=400, detail="O arquivo deve ter no máximo 10 MB")
    _validar_conteudo(conteudo, arquivo.content_type)
    nome = os.path.basename(arquivo.filename or "documento").replace('"', '').replace('\r', '').replace('\n', '')[:255]
    item = db.query(DocumentoPessoaJuridica).filter(DocumentoPessoaJuridica.pessoa_juridica_id == cadastro_id, DocumentoPessoaJuridica.posicao == posicao).first()
    if item:
        item.nome_arquivo, item.content_type, item.tamanho_bytes, item.arquivo = nome, arquivo.content_type, len(conteudo), encrypt_bytes(conteudo)
    else:
        item = DocumentoPessoaJuridica(pessoa_juridica_id=cadastro_id, posicao=posicao, nome_arquivo=nome, content_type=arquivo.content_type, tamanho_bytes=len(conteudo), arquivo=encrypt_bytes(conteudo))
        db.add(item)
    db.commit(); db.refresh(item)
    return _resumo(item)


@router.get("/{cadastro_id}/documentos/{documento_id}/arquivo")
def baixar(cadastro_id: str, documento_id: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    item = db.query(DocumentoPessoaJuridica).filter(DocumentoPessoaJuridica.id == documento_id, DocumentoPessoaJuridica.pessoa_juridica_id == cadastro_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    return Response(content=decrypt_bytes(item.arquivo), media_type=item.content_type, headers={"Content-Disposition": f'attachment; filename="{item.nome_arquivo}"', "X-Content-Type-Options": "nosniff"})


@router.delete("/{cadastro_id}/documentos/{documento_id}", status_code=status.HTTP_204_NO_CONTENT)
def remover(cadastro_id: str, documento_id: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    item = db.query(DocumentoPessoaJuridica).filter(DocumentoPessoaJuridica.id == documento_id, DocumentoPessoaJuridica.pessoa_juridica_id == cadastro_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Documento não encontrado")
    db.delete(item); db.commit()
