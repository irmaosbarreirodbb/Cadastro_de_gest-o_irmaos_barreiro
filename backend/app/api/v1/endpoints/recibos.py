from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.encryption import encrypt_val, decrypt_val
from app.models.recibo import Recibo
from app.models.usuario import Usuario
from app.schemas.recibo import ReciboCreate, ReciboOut
from app.services.extenso import numero_por_extenso
from app.services.protocolo import gerar_numero_recibo
from app.api.deps import get_current_user
from app.api.validacoes import recusar_dado_ilegivel

router = APIRouter()

def _descriptografar_recibo(r):
    if not r:
        return r
    r.cpf_diarista = decrypt_val(r.cpf_diarista)
    r.chave_pix = decrypt_val(r.chave_pix)
    return r

@router.get("/extenso")
def obter_valor_por_extenso(valor: float = Query(..., gt=0)):
    return {
        "valor": valor,
        "extenso": numero_por_extenso(valor)
    }

@router.post("", response_model=ReciboOut, status_code=status.HTTP_201_CREATED)
def emitir_recibo(
    dados: ReciboCreate, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    numero_recibo = gerar_numero_recibo()
    extenso = dados.valor_extenso or numero_por_extenso(dados.valor_total)

    dados_dict = dados.model_dump(exclude={"valor_extenso"})
    # Um recibo com CPF/PIX ilegível sairia impresso como "gAAAAA...".
    recusar_dado_ilegivel(dados_dict.get("cpf_diarista"), "CPF")
    recusar_dado_ilegivel(dados_dict.get("chave_pix"), "PIX")
    if dados_dict.get("cpf_diarista"):
        dados_dict["cpf_diarista"] = encrypt_val(dados_dict["cpf_diarista"])
    if dados_dict.get("chave_pix"):
        dados_dict["chave_pix"] = encrypt_val(dados_dict["chave_pix"])

    recibo = Recibo(
        numero_recibo=numero_recibo,
        valor_extenso=extenso,
        **dados_dict
    )
    db.add(recibo)
    db.commit()
    db.refresh(recibo)
    return _descriptografar_recibo(recibo)

@router.get("", response_model=List[ReciboOut])
def listar_recibos(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    lista = db.query(Recibo).order_by(Recibo.created_at.desc()).all()
    return [_descriptografar_recibo(r) for r in lista]
