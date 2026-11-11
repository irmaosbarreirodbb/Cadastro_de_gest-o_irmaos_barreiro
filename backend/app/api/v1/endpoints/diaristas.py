from typing import List, Optional, Dict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.encryption import encrypt_val, decrypt_val
from app.models.diarista import DiaristaLancamento
from app.models.recibo import Recibo
from app.models.usuario import Usuario
from app.schemas.diarista import DiaristaCreate, DiaristaUpdate, DiaristaOut
from app.api.deps import get_current_user

router = APIRouter()

def _descriptografar_diarista(d):
    if not d:
        return d
    d.chave_pix = decrypt_val(d.chave_pix)
    return d

@router.get("", response_model=List[DiaristaOut])
def listar_diaristas(
    data: Optional[str] = Query(None, description="Data ISO YYYY-MM-DD"),
    mes: Optional[str] = Query(None, description="Mês ISO YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    query = db.query(DiaristaLancamento)
    if data:
        query = query.filter(DiaristaLancamento.data == data)
    elif mes:
        query = query.filter(DiaristaLancamento.data.startswith(mes))
    lista = query.order_by(DiaristaLancamento.data.desc(), DiaristaLancamento.created_at.desc()).all()
    return [_descriptografar_diarista(d) for d in lista]

@router.get("/datas-disponiveis", response_model=Dict[str, int])
def datas_disponiveis(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    resultados = db.query(
        DiaristaLancamento.data,
        func.count(DiaristaLancamento.id)
    ).group_by(DiaristaLancamento.data).all()
    
    return {row[0]: row[1] for row in resultados if row[0]}

@router.post("", response_model=DiaristaOut, status_code=status.HTTP_201_CREATED)
def criar_diarista(
    dados: DiaristaCreate, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    valor_total = float(dados.valor_diaria) * int(dados.quantidade_diarias)
    dados_dict = dados.model_dump()
    
    # Criptografa a chave PIX do lançamento no PostgreSQL
    if dados_dict.get("chave_pix"):
        dados_dict["chave_pix"] = encrypt_val(dados_dict["chave_pix"])

    diarista = DiaristaLancamento(
        valor_total=valor_total,
        **dados_dict
    )
    db.add(diarista)
    db.commit()
    db.refresh(diarista)
    return _descriptografar_diarista(diarista)

@router.patch("/{diarista_id}/status-pago", response_model=DiaristaOut)
def toggle_status_pago(
    diarista_id: str, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    diarista = db.query(DiaristaLancamento).filter(DiaristaLancamento.id == diarista_id).first()
    if not diarista:
        raise HTTPException(status_code=404, detail="Lançamento de diária não encontrado")
    
    diarista.pago = not diarista.pago
    diarista.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(diarista)
    return _descriptografar_diarista(diarista)

@router.put("/{diarista_id}", response_model=DiaristaOut)
def atualizar_diarista(
    diarista_id: str,
    dados: DiaristaUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    diarista = db.query(DiaristaLancamento).filter(DiaristaLancamento.id == diarista_id).first()
    if not diarista:
        raise HTTPException(status_code=404, detail="Lançamento de diária não encontrado")
    
    updates = dados.model_dump(exclude_unset=True)
    if "chave_pix" in updates and updates["chave_pix"]:
        updates["chave_pix"] = encrypt_val(updates["chave_pix"])

    for field, value in updates.items():
        setattr(diarista, field, value)
        
    # Recalcula total se valor ou quantidade mudaram
    if "valor_diaria" in updates or "quantidade_diarias" in updates:
        diarista.valor_total = float(diarista.valor_diaria) * int(diarista.quantidade_diarias)
        
    diarista.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(diarista)
    return _descriptografar_diarista(diarista)

@router.delete("/{diarista_id}")
def remover_diarista(
    diarista_id: str, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    diarista = db.query(DiaristaLancamento).filter(DiaristaLancamento.id == diarista_id).first()
    if not diarista:
        raise HTTPException(status_code=404, detail="Lançamento de diária não encontrado")
    
    # Desvincula recibos vinculados a este lançamento para preservar o histórico e evitar erro de chave estrangeira
    db.query(Recibo).filter(Recibo.diarista_id == diarista_id).update({Recibo.diarista_id: None})
    
    db.delete(diarista)
    db.commit()
    return {"message": "Diarista removido com sucesso"}

@router.delete("/reset/dia")
def resetar_diaristas(
    data: str = Query(..., description="Data ISO YYYY-MM-DD obrigatória"), 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    data_limpa = data.strip()
    if not data_limpa:
        raise HTTPException(status_code=400, detail="A data de referência deve ser informada obrigatoriamente.")
        
    subquery = db.query(DiaristaLancamento.id).filter(DiaristaLancamento.data == data_limpa).subquery()
    db.query(Recibo).filter(Recibo.diarista_id.in_(subquery)).update({Recibo.diarista_id: None}, synchronize_session=False)
    
    query = db.query(DiaristaLancamento).filter(DiaristaLancamento.data == data_limpa)
    removidos = query.delete(synchronize_session=False)
    db.commit()
    return {"message": f"Relação de diaristas da data {data_limpa} limpa com sucesso ({removidos} registro(s))."}
