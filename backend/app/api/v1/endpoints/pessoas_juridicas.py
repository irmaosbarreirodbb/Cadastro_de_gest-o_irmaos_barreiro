from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.encryption import decrypt_val, encrypt_val
from app.models.pessoa_juridica import PessoaJuridicaCadastro
from app.models.usuario import Usuario
from app.schemas.pessoa_juridica import PessoaJuridicaCreate, PessoaJuridicaOut
from app.services.protocolo import gerar_protocolo
from app.core.rate_limit import enforce_rate_limit

router = APIRouter()

_CAMPOS_CRIPTOGRAFADOS = {"cnpj", "telefone", "agencia", "conta", "chave_pix"}


def _descriptografar(item: PessoaJuridicaCadastro):
    for campo in _CAMPOS_CRIPTOGRAFADOS:
        valor = getattr(item, campo)
        if valor:
            setattr(item, campo, decrypt_val(valor))
    return item


@router.post("", response_model=PessoaJuridicaOut, status_code=status.HTTP_201_CREATED)
def criar_pessoa_juridica(
    dados: PessoaJuridicaCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user),
):
    enforce_rate_limit(request, "cadastro-pessoa-juridica", limit=10, window_seconds=3600)
    dados_dict = dados.model_dump()
    for campo in _CAMPOS_CRIPTOGRAFADOS:
        if dados_dict.get(campo):
            dados_dict[campo] = encrypt_val(dados_dict[campo])

    cadastro = PessoaJuridicaCadastro(protocolo=gerar_protocolo(), **dados_dict)
    db.add(cadastro)
    db.commit()
    db.refresh(cadastro)
    return _descriptografar(cadastro)


@router.get("", response_model=List[PessoaJuridicaOut])
def listar_pessoas_juridicas(db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    itens = db.query(PessoaJuridicaCadastro).order_by(PessoaJuridicaCadastro.created_at.desc()).all()
    return [_descriptografar(item) for item in itens]


@router.get("/{cadastro_id}", response_model=PessoaJuridicaOut)
def obter_pessoa_juridica(cadastro_id: str, db: Session = Depends(get_db), current_user: Usuario = Depends(get_current_user)):
    item = db.query(PessoaJuridicaCadastro).filter(PessoaJuridicaCadastro.id == cadastro_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Cadastro de pessoa jurídica não encontrado")
    return _descriptografar(item)
