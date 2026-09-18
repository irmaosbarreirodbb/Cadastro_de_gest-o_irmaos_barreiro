from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.encryption import encrypt_val, decrypt_val
from app.models.funcionario import FuncionarioBase
from app.models.registro_funcionario import RegistroFuncionario
from app.models.diarista import DiaristaLancamento
from app.models.colaborador import ColaboradorCadastro
from app.models.usuario import Usuario
from app.schemas.funcionario import (
    FuncionarioBaseCreate, 
    FuncionarioBaseOut,
    FuncionarioRegistroCreate,
    FuncionarioRegistroOut,
    FuncionarioRelatorioOut,
    FuncionarioRelatorioDiaria
)
from app.api.deps import get_current_user

router = APIRouter()

def _descriptografar_funcionario(f):
    if not f:
        return f
    f.chave_pix = decrypt_val(f.chave_pix)
    return f

# =========================================================================
# 1. REGISTROS DE FUNCIONÁRIOS (TABELA DEDICADA: registro_funcionarios)
# =========================================================================

@router.get("/registros", response_model=List[FuncionarioRegistroOut])
def listar_registros_funcionarios(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Retorna todos os registros da tabela dedicada 'registro_funcionarios' com:
    - Data de entrada
    - Total de diárias já realizadas
    - Total em dinheiro acumulado até o momento
    """
    funcionarios = db.query(RegistroFuncionario).order_by(RegistroFuncionario.nome.asc()).all()
    resultado = []

    # Carrega todas as diárias para agregação rápida em memória
    todas_diarias = db.query(DiaristaLancamento).all()
    
    # Agrupa diárias por nome em maiúsculo
    mapa_diarias = {}
    for dia in todas_diarias:
        nome_key = (dia.nome or "").strip().upper()
        if nome_key:
            if nome_key not in mapa_diarias:
                mapa_diarias[nome_key] = {"qtd": 0, "total": 0.0}
            mapa_diarias[nome_key]["qtd"] += dia.quantidade_diarias or 1
            mapa_diarias[nome_key]["total"] += float(dia.valor_total or 0.0)

    for f in funcionarios:
        nome_key = (f.nome or "").strip().upper()
        totais = mapa_diarias.get(nome_key, {"qtd": 0, "total": 0.0})
        funcao_final = f.funcao or ""
        resultado.append(FuncionarioRegistroOut(
            id=f.id,
            nome=f.nome,
            funcao=funcao_final,
            profissao=funcao_final,
            data_entrada=f.data_entrada,
            total_diarias=totais["qtd"],
            total_valor=round(totais["total"], 2),
            created_at=f.created_at
        ))

    return resultado

@router.post("/registros", response_model=FuncionarioRegistroOut, status_code=status.HTTP_201_CREATED)
def criar_registro_funcionario(
    dados: FuncionarioRegistroCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    nome_norm = dados.nome.strip().upper()
    if not nome_norm:
        raise HTTPException(status_code=400, detail="O nome do funcionário é obrigatório.")

    funcao_informada = (dados.funcao or dados.profissao or "").strip()
    data_ent = (dados.data_entrada or "").strip()

    # Cria novo registro persistido diretamente na tabela 'registro_funcionarios'
    novo_reg = RegistroFuncionario(
        nome=nome_norm,
        funcao=funcao_informada,
        data_entrada=data_ent
    )
    db.add(novo_reg)

    # Mantém também funcionarios_base sincronizado
    fb_existente = db.query(FuncionarioBase).filter(func.upper(FuncionarioBase.nome) == nome_norm).first()
    if not fb_existente:
        db.add(FuncionarioBase(
            id=novo_reg.id,
            nome=nome_norm,
            profissao=funcao_informada,
            data_entrada=data_ent,
            ativo=True
        ))
    else:
        fb_existente.data_entrada = data_ent
        fb_existente.profissao = funcao_informada

    db.commit()
    db.refresh(novo_reg)

    # Calcula diárias existentes se já houver lançamentos com esse nome
    diarias = db.query(DiaristaLancamento).filter(func.upper(DiaristaLancamento.nome) == nome_norm).all()
    total_d = sum(d.quantidade_diarias or 1 for d in diarias)
    total_v = sum(float(d.valor_total or 0.0) for d in diarias)

    return FuncionarioRegistroOut(
        id=novo_reg.id,
        nome=novo_reg.nome,
        funcao=novo_reg.funcao,
        profissao=novo_reg.funcao,
        data_entrada=novo_reg.data_entrada,
        total_diarias=total_d,
        total_valor=round(total_v, 2),
        created_at=novo_reg.created_at
    )

@router.put("/registros/{funcionario_id}", response_model=FuncionarioRegistroOut)
def atualizar_registro_funcionario(
    funcionario_id: str,
    dados: FuncionarioRegistroCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reg_obj = db.query(RegistroFuncionario).filter(RegistroFuncionario.id == funcionario_id).first()
    if not reg_obj:
        # Fallback para funcionarios_base caso seja um id legado
        fb = db.query(FuncionarioBase).filter(FuncionarioBase.id == funcionario_id).first()
        if not fb:
            raise HTTPException(status_code=404, detail="Funcionário não encontrado na tabela de registros.")
        reg_obj = RegistroFuncionario(
            id=fb.id,
            nome=fb.nome,
            funcao=fb.profissao,
            data_entrada=fb.data_entrada
        )
        db.add(reg_obj)

    nome_norm = dados.nome.strip().upper()
    funcao_informada = (dados.funcao or dados.profissao or "").strip()
    data_ent = (dados.data_entrada or "").strip()

    reg_obj.nome = nome_norm
    reg_obj.funcao = funcao_informada
    reg_obj.data_entrada = data_ent

    # Sincroniza funcionarios_base se existir
    fb = db.query(FuncionarioBase).filter(FuncionarioBase.id == funcionario_id).first()
    if fb:
        fb.nome = nome_norm
        fb.profissao = funcao_informada
        fb.data_entrada = data_ent

    db.commit()
    db.refresh(reg_obj)

    diarias = db.query(DiaristaLancamento).filter(func.upper(DiaristaLancamento.nome) == nome_norm).all()
    total_d = sum(d.quantidade_diarias or 1 for d in diarias)
    total_v = sum(float(d.valor_total or 0.0) for d in diarias)

    return FuncionarioRegistroOut(
        id=reg_obj.id,
        nome=reg_obj.nome,
        funcao=reg_obj.funcao,
        profissao=reg_obj.funcao,
        data_entrada=reg_obj.data_entrada,
        total_diarias=total_d,
        total_valor=round(total_v, 2),
        created_at=reg_obj.created_at
    )

@router.delete("/registros/{funcionario_id}", status_code=status.HTTP_200_OK)
def remover_registro_funcionario(
    funcionario_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    reg_obj = db.query(RegistroFuncionario).filter(RegistroFuncionario.id == funcionario_id).first()
    if reg_obj:
        db.delete(reg_obj)

    fb = db.query(FuncionarioBase).filter(FuncionarioBase.id == funcionario_id).first()
    if fb:
        db.delete(fb)
    
    db.commit()
    return {"message": "Funcionário removido com sucesso da tabela de registros."}

@router.get("/registros/{funcionario_id}/relatorio", response_model=FuncionarioRelatorioOut)
def obter_relatorio_completo_funcionario(
    funcionario_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Retorna o relatório completo do funcionário a partir da tabela 'registro_funcionarios'
    com data de entrada, total de diárias, total em dinheiro recebido e a lista de diárias.
    """
    reg_obj = db.query(RegistroFuncionario).filter(RegistroFuncionario.id == funcionario_id).first()
    if not reg_obj:
        # Fallback
        reg_obj = db.query(FuncionarioBase).filter(FuncionarioBase.id == funcionario_id).first()

    if not reg_obj:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado na tabela de registros.")

    nome_norm = (reg_obj.nome or "").strip().upper()
    diarias_db = (
        db.query(DiaristaLancamento)
        .filter(func.upper(DiaristaLancamento.nome) == nome_norm)
        .order_by(DiaristaLancamento.data.desc())
        .all()
    )

    lista_diarias = []
    total_qtd = 0
    total_dinheiro = 0.0

    for d in diarias_db:
        qtd = d.quantidade_diarias or 1
        val_tot = float(d.valor_total or 0.0)
        total_qtd += qtd
        func_nome = getattr(reg_obj, 'funcao', '') or getattr(reg_obj, 'profissao', '') or ""
        lista_diarias.append(FuncionarioRelatorioDiaria(
            id=d.id,
            data=d.data or "",
            funcao=d.profissao or func_nome,
            profissao=d.profissao or func_nome,
            valor_diaria=float(d.valor_diaria or 0.0),
            quantidade_diarias=qtd,
            valor_total=round(val_tot, 2),
            pago=bool(d.pago),
            observacoes=d.observacoes
        ))

    func_cargo = getattr(reg_obj, 'funcao', '') or getattr(reg_obj, 'profissao', '') or ""
    return FuncionarioRelatorioOut(
        id=reg_obj.id,
        nome=reg_obj.nome,
        funcao=func_cargo,
        profissao=func_cargo,
        data_entrada=reg_obj.data_entrada,
        total_diarias=total_qtd,
        total_valor=round(total_dinheiro, 2),
        diarias=lista_diarias
    )

# =========================================================================
# 2. ENDPOINTS LEGADOS / AUTOCOMPLETE PARA CADASTRO DE DIÁRIAS
# =========================================================================

@router.get("", response_model=List[FuncionarioBaseOut])
def buscar_funcionarios_base(
    q: Optional[str] = Query(None, description="Termo de busca por nome ou profissao"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    termo = q.strip().lower() if q and q.strip() else None
    mapa = {}

    # 1. Busca em colaboradores_cadastros (Fichas de admissão)
    colabs = db.query(ColaboradorCadastro).all()
    for c in colabs:
        nome = (c.nome_completo or "").strip()
        chave = nome.upper()
        if chave and chave not in mapa:
            cargo_limpo = c.cargo or ""
            if not termo or (termo in nome.lower() or termo in cargo_limpo.lower()):
                mapa[chave] = FuncionarioBaseOut(
                    id=c.id,
                    nome=chave,
                    profissao=cargo_limpo,
                    tipo_pix="cpf",
                    chave_pix=decrypt_val(c.chave_pix),
                    ativo=True,
                    data_entrada=None,
                    created_at=c.created_at
                )

    # 2. Busca em registro_funcionarios (Módulo 5)
    regs = db.query(RegistroFuncionario).all()
    for r in regs:
        nome = (r.nome or "").strip()
        chave = nome.upper()
        if chave:
            func_limpo = r.funcao or ""
            if chave not in mapa:
                if not termo or (termo in nome.lower() or termo in func_limpo.lower()):
                    mapa[chave] = FuncionarioBaseOut(
                        id=r.id,
                        nome=chave,
                        profissao=func_limpo,
                        tipo_pix="cpf",
                        chave_pix=None,
                        ativo=True,
                        data_entrada=r.data_entrada,
                        created_at=r.created_at
                    )
            elif func_limpo and not mapa[chave].profissao:
                mapa[chave].profissao = func_limpo

    # 3. Busca em diaristas_lancamentos
    # A data do primeiro lançamento de diária é o início dos pagamentos.
    # Ordenamos pela data da diária para preencher esse dado no autocomplete.
    diaristas = db.query(DiaristaLancamento).order_by(DiaristaLancamento.data.asc(), DiaristaLancamento.created_at.asc()).all()
    primeiras_datas_pagamento = {}
    for d in diaristas:
        nome = (d.nome or "").strip()
        chave = nome.upper()
        if chave:
            if d.data and chave not in primeiras_datas_pagamento:
                primeiras_datas_pagamento[chave] = d.data
            prof_limpo = d.profissao or ""
            if chave not in mapa:
                pix_limpo = decrypt_val(d.chave_pix)
                if not termo or (termo in nome.lower() or termo in prof_limpo.lower() or (pix_limpo and termo in pix_limpo.lower())):
                    mapa[chave] = FuncionarioBaseOut(
                        id=d.id,
                        nome=chave,
                        profissao=prof_limpo,
                        tipo_pix=d.tipo_pix or "cpf",
                        chave_pix=pix_limpo,
                        ativo=True,
                        data_entrada=d.data,
                        created_at=d.created_at
                    )
            else:
                if prof_limpo and not mapa[chave].profissao:
                    mapa[chave].profissao = prof_limpo
                pix_limpo = decrypt_val(d.chave_pix)
                if pix_limpo and not mapa[chave].chave_pix:
                    mapa[chave].chave_pix = pix_limpo
                    if d.tipo_pix:
                        mapa[chave].tipo_pix = d.tipo_pix

    # A primeira diária prevalece sobre qualquer data cadastrada manualmente
    # ao sugerir o funcionário para o registro individual.
    for chave, primeira_data in primeiras_datas_pagamento.items():
        if chave in mapa:
            mapa[chave].data_entrada = primeira_data

    # 4. Busca em funcionarios_base
    fb_list = db.query(FuncionarioBase).all()
    for fb in fb_list:
        nome = (fb.nome or "").strip()
        chave = nome.upper()
        if chave:
            prof_limpo = fb.profissao or ""
            fb_pix = decrypt_val(fb.chave_pix)
            if chave not in mapa:
                if not termo or (termo in nome.lower() or termo in prof_limpo.lower() or (fb_pix and termo in fb_pix.lower())):
                    mapa[chave] = FuncionarioBaseOut(
                        id=fb.id,
                        nome=chave,
                        profissao=prof_limpo,
                        tipo_pix=fb.tipo_pix or "cpf",
                        chave_pix=fb_pix,
                        ativo=True,
                        data_entrada=fb.data_entrada,
                        created_at=fb.created_at
                    )
            else:
                if prof_limpo and not mapa[chave].profissao:
                    mapa[chave].profissao = prof_limpo
                if fb_pix and not mapa[chave].chave_pix:
                    mapa[chave].chave_pix = fb_pix
                    if fb.tipo_pix:
                        mapa[chave].tipo_pix = fb.tipo_pix

    resultado = list(mapa.values())
    resultado.sort(key=lambda x: x.nome)
    return resultado

@router.post("", response_model=FuncionarioBaseOut, status_code=status.HTTP_201_CREATED)
def criar_funcionario_base(
    dados: FuncionarioBaseCreate, 
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    dados_dict = dados.model_dump()
    if dados_dict.get("chave_pix"):
        dados_dict["chave_pix"] = encrypt_val(dados_dict["chave_pix"])

    funcionario = FuncionarioBase(**dados_dict)
    db.add(funcionario)
    db.commit()
    db.refresh(funcionario)
    return _descriptografar_funcionario(funcionario)

@router.put("/{funcionario_id}", response_model=FuncionarioBaseOut)
def atualizar_funcionario_base(
    funcionario_id: str,
    dados: FuncionarioBaseCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    func = db.query(FuncionarioBase).filter(FuncionarioBase.id == funcionario_id).first()
    if not func:
        raise HTTPException(status_code=404, detail="Funcionário não encontrado no catálogo base")
    
    dados_dict = dados.model_dump(exclude_unset=True)
    if "chave_pix" in dados_dict and dados_dict["chave_pix"]:
        dados_dict["chave_pix"] = encrypt_val(dados_dict["chave_pix"])

    for field, value in dados_dict.items():
        setattr(func, field, value)
        
    db.commit()
    db.refresh(func)
    return _descriptografar_funcionario(func)
