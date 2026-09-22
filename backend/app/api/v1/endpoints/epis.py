from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from datetime import datetime
import io

from app.core.database import get_db
from app.models.epi import EPI, EntregaEPI
from app.models.funcionario_epi import FuncionarioEPI
from app.models.usuario import Usuario
from app.api.deps import get_current_user
from app.schemas.epi import (
    EPICreate,
    EPIUpdate,
    EPIOut,
    EntregaEPICreate,
    EntregaEPIUpdate,
    EntregaEPIOut,
    FuncionarioEPICreate,
    FuncionarioEPIUpdate,
    FuncionarioEPIOut,
    ImportacaoResultadoOut,
    PreviewPlanilhaOut
)
from app.services.importer import preview_planilha, importar_planilha_para_banco
from app.services.xml_importer import importar_nfe_para_banco
from app.services.epi_pdf import gerar_ficha_epi_pdf
from app.services.epi_classification import classificar_categoria


router = APIRouter()


# ============================================================================
# 1. GESTÃO DE ESTOQUE DE EPIs (TABELA PRINCIPAL COM BADGE COMPRAR / OK)
# ============================================================================

@router.get("", response_model=List[EPIOut])
def listar_epis(
    busca: Optional[str] = Query(None, description="Busca por descrição, CA ou fabricante"),
    situacao: Optional[str] = Query(None, description="Filtrar por 'COMPRAR' ou 'OK'"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lista todos os EPIs cadastrados com cálculo automático da situação
    ('COMPRAR' se Estoque Real <= Estoque Mínimo, senão 'OK').
    """
    query = db.query(EPI)

    if busca:
        termo = f"%{busca.strip()}%"
        query = query.filter(
            or_(
                EPI.descricao.ilike(termo),
                EPI.numero_ca.ilike(termo),
                EPI.fabricante.ilike(termo)
            )
        )

    itens = query.order_by(EPI.id.asc()).all()

    if situacao:
        situacao_upper = situacao.strip().upper()
        if situacao_upper in ("COMPRAR", "OK"):
            itens = [item for item in itens if item.situacao == situacao_upper]

    return itens


@router.post("", response_model=EPIOut, status_code=status.HTTP_201_CREATED)
def criar_epi(
    epi_in: EPICreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Cadastra manualmente um novo EPI."""
    dados = epi_in.dict()
    dados["categoria"] = classificar_categoria(dados.get("descricao"), dados.get("categoria"))
    novo_epi = EPI(**dados)
    db.add(novo_epi)
    db.commit()
    db.refresh(novo_epi)
    return novo_epi


@router.put("/{epi_id}", response_model=EPIOut)
def atualizar_epi(
    epi_id: int,
    epi_in: EPIUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Atualiza dados cadastrais ou estoques de um EPI existente."""
    epi = db.query(EPI).filter(EPI.id == epi_id).first()
    if not epi:
        raise HTTPException(status_code=404, detail="EPI não encontrado.")

    dados = epi_in.dict(exclude_unset=True)
    if "descricao" in dados or "categoria" in dados:
        dados["categoria"] = classificar_categoria(
            dados.get("descricao", epi.descricao),
            dados.get("categoria", epi.categoria),
        )
    for field, val in dados.items():
        setattr(epi, field, val)

    db.commit()
    db.refresh(epi)
    return epi


@router.delete("/item/{epi_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_epi(
    epi_id: int,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Exclui um EPI e o histórico atrelado a ele."""
    epi = db.query(EPI).filter(EPI.id == epi_id).first()
    if not epi:
        raise HTTPException(status_code=404, detail="EPI não encontrado.")

    db.delete(epi)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/limpar-todos", status_code=status.HTTP_200_OK)
def limpar_todos_epis(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Exclui todos os EPIs e entregas atreladas do banco de dados de uma só vez."""
    total_entregas = db.query(EntregaEPI).delete()
    total_epis = db.query(EPI).delete()
    db.commit()
    return {
        "mensagem": f"Estoque zerado com sucesso! {total_epis} itens removidos do banco de dados.",
        "total_epis": total_epis,
        "total_entregas": total_entregas
    }


# ============================================================================
# 2. CARGA E MIGRAÇÃO DE PLANILHAS (EXCEL .xlsx / .xls OU .csv)
# ============================================================================

_TAMANHO_MAX_UPLOAD = 10 * 1024 * 1024  # 10 MB


@router.post("/preview-planilha", response_model=PreviewPlanilhaOut)
async def endpoint_preview_planilha(
    file: UploadFile = File(...),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lê as primeiras linhas da planilha enviada para pré-visualização no frontend
    antes de confirmar a gravação definitiva.
    """
    if not file.filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Formato não suportado. Envie arquivos .xlsx, .xls ou .csv.")

    file_bytes = await file.read()
    if len(file_bytes) > _TAMANHO_MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="O arquivo deve ter no máximo 10 MB.")
    try:
        dados = preview_planilha(file_bytes, file.filename)
        return dados
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível processar a planilha. Verifique o formato do arquivo.")


@router.post("/importar-planilha", response_model=ImportacaoResultadoOut)
async def endpoint_importar_planilha(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Processa a planilha do Excel ou CSV e migra os dados diretamente para o banco
    utilizando lógica de UPSERT (atualiza se existir por CA/descrição ou insere novo).
    """
    if not file.filename.lower().endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(status_code=400, detail="Formato não suportado. Envie arquivos .xlsx, .xls ou .csv.")

    file_bytes = await file.read()
    if len(file_bytes) > _TAMANHO_MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="O arquivo deve ter no máximo 10 MB.")
    try:
        resultado = importar_planilha_para_banco(file_bytes, file.filename, db)
        return resultado
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível importar a planilha. Verifique o formato do arquivo.")


# ============================================================================
# 3. ENTRADA VIA NOTA FISCAL (DANFE XML)
# ============================================================================

@router.post("/importar-xml")
async def endpoint_importar_xml(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Lê o arquivo XML da NF-e (DANFE) e incrementa automaticamente o saldo
    de estoque dos EPIs no banco de dados.
    """
    if not file.filename.lower().endswith(".xml"):
        raise HTTPException(status_code=400, detail="Formato inválido. Por favor, envie um arquivo .xml de NF-e.")

    xml_bytes = await file.read()
    if len(xml_bytes) > _TAMANHO_MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="O arquivo deve ter no máximo 10 MB.")
    try:
        resultado = importar_nfe_para_banco(xml_bytes, db)
        return resultado
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Não foi possível processar o XML da NF-e. Verifique se o arquivo é válido.")





# ============================================================================
# 4. ENTREGA DE EPI / BAIXA DE ESTOQUE / FICHA INDIVIDUAL (IMAGEM 2)
# ============================================================================

@router.post("/entregas", response_model=EntregaEPIOut, status_code=status.HTTP_201_CREATED)
def registrar_entrega(
    entrega_in: EntregaEPICreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Registra a entrega de um EPI para um funcionário e realiza a baixa
    automática correspondente no estoque real do item.
    """
    epi = db.query(EPI).filter(EPI.id == entrega_in.epi_id).first()
    if not epi:
        raise HTTPException(status_code=404, detail="EPI não encontrado no estoque.")

    # Registra entrega
    nova_entrega = EntregaEPI(**entrega_in.dict())
    db.add(nova_entrega)

    # Dá baixa no estoque real (permite saldo negativo caso solicitado, mas reduz)
    epi.estoque_real = (epi.estoque_real or 0.0) - entrega_in.quantidade

    db.commit()
    db.refresh(nova_entrega)
    return nova_entrega


@router.delete("/entregas/{entrega_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_entrega(
    entrega_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Exclui uma entrega e estorna a quantidade para o estoque do EPI."""
    entrega = db.query(EntregaEPI).filter(EntregaEPI.id == entrega_id).first()
    if not entrega:
        raise HTTPException(status_code=404, detail="Registro de entrega não encontrado.")

    if entrega.epi:
        entrega.epi.estoque_real = (entrega.epi.estoque_real or 0.0) + entrega.quantidade

    db.delete(entrega)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/entregas/{entrega_id}", response_model=EntregaEPIOut)
def atualizar_entrega(
    entrega_id: str,
    dados: EntregaEPIUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Atualiza um lançamento de entrega de EPI de um funcionário.
    Recalcula e ajusta automaticamente o saldo de estoque com base
    na nova quantidade e/ou troca de item de EPI.
    """
    entrega = db.query(EntregaEPI).filter(EntregaEPI.id == entrega_id).first()
    if not entrega:
        raise HTTPException(status_code=404, detail="Registro de entrega não encontrado.")

    antiga_qtd = float(entrega.quantidade or 0.0)
    antigo_epi_id = entrega.epi_id
    nova_qtd = float(dados.quantidade) if dados.quantidade is not None else antiga_qtd
    novo_epi_id = dados.epi_id if dados.epi_id is not None else antigo_epi_id

    if antigo_epi_id == novo_epi_id:
        diff = nova_qtd - antiga_qtd
        if diff != 0:
            epi = db.query(EPI).filter(EPI.id == antigo_epi_id).first()
            if epi:
                epi.estoque_real = (epi.estoque_real or 0.0) - diff
    else:
        old_epi = db.query(EPI).filter(EPI.id == antigo_epi_id).first()
        if old_epi:
            old_epi.estoque_real = (old_epi.estoque_real or 0.0) + antiga_qtd
        new_epi = db.query(EPI).filter(EPI.id == novo_epi_id).first()
        if new_epi:
            new_epi.estoque_real = (new_epi.estoque_real or 0.0) - nova_qtd

    update_dict = dados.dict(exclude_unset=True)
    for k, v in update_dict.items():
        setattr(entrega, k, v)

    db.commit()
    db.refresh(entrega)
    return entrega


# ============================================================================
# 5. GERENCIAMENTO DE FUNCIONÁRIOS DEDICADO DO MÓDULO DE EPIs
#    Tabela EXCLUSIVA: funcionarios_epis (não mistura com outros módulos)
# ============================================================================

@router.get("/funcionarios", response_model=List[FuncionarioEPIOut])
def listar_funcionarios_epi(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Retorna a lista de funcionários cadastrados EXCLUSIVAMENTE no módulo de EPIs
    (tabela 'funcionarios_epis'), com a contagem de EPIs em posse.
    """
    # Sincroniza colaboradores de entregas existentes para dentro de funcionarios_epis
    # garantindo que entregas prévias tenham seu registro próprio sem perder nada
    nomes_existentes = {
        (f.nome or "").strip().upper(): f for f in db.query(FuncionarioEPI).all()
    }

    entregas = db.query(EntregaEPI).all()
    precisa_commit = False
    for ent in entregas:
        nome_ent = (ent.colaborador_nome or "").strip().upper()
        if nome_ent and nome_ent not in nomes_existentes:
            novo_f = FuncionarioEPI(
                nome=ent.colaborador_nome.strip(),
                funcao=ent.funcao or "Ajudante de Motorista",
                setor=ent.setor or "Distribuição",
                local=ent.local or "Cascavel",
                registro=ent.colaborador_registro or "373",
                data_entrada=ent.data_entrega
            )
            db.add(novo_f)
            nomes_existentes[nome_ent] = novo_f
            precisa_commit = True

    if precisa_commit:
        db.commit()

    # Contagem de entregas por funcionário
    contagem_entregas = {}
    for ent in entregas:
        n = (ent.colaborador_nome or "").strip().upper()
        contagem_entregas[n] = contagem_entregas.get(n, 0) + 1

    funcionarios = db.query(FuncionarioEPI).order_by(FuncionarioEPI.nome.asc()).all()
    resultado = []
    for f in funcionarios:
        nome_up = (f.nome or "").strip().upper()
        resultado.append(FuncionarioEPIOut(
            id=str(f.id),
            nome=f.nome,
            funcao=f.funcao or "Ajudante de Motorista",
            setor=f.setor or "Distribuição",
            local=f.local or "Cascavel",
            registro=f.registro or "373",
            data_entrada=f.data_entrada,
            total_epis=contagem_entregas.get(nome_up, 0)
        ))

    return resultado


@router.post("/funcionarios", response_model=FuncionarioEPIOut, status_code=status.HTTP_201_CREATED)
def criar_funcionario_epi(
    dados: FuncionarioEPICreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Cadastra ou atualiza um funcionário EXCLUSIVAMENTE na tabela do módulo de EPIs (funcionarios_epis).
    Não altera nem mistura com dados de outros módulos do sistema.
    """
    nome_norm = dados.nome.strip()
    if not nome_norm:
        raise HTTPException(status_code=400, detail="O nome do funcionário é obrigatório.")

    # Verifica se já existe na tabela exclusiva de EPIs
    existente = db.query(FuncionarioEPI).filter(
        func.upper(FuncionarioEPI.nome) == nome_norm.upper()
    ).first()

    if existente:
        if dados.funcao:
            existente.funcao = dados.funcao.strip()
        if dados.setor:
            existente.setor = dados.setor.strip()
        if dados.local:
            existente.local = dados.local.strip()
        if dados.registro:
            existente.registro = dados.registro.strip()
        if dados.data_entrada:
            existente.data_entrada = dados.data_entrada.strip()
        db.commit()
        db.refresh(existente)

        total_epis = db.query(EntregaEPI).filter(
            func.upper(EntregaEPI.colaborador_nome) == existente.nome.upper()
        ).count()

        return FuncionarioEPIOut(
            id=str(existente.id),
            nome=existente.nome,
            funcao=existente.funcao or "Ajudante de Motorista",
            setor=existente.setor or "Distribuição",
            local=existente.local or "Cascavel",
            registro=existente.registro or "373",
            data_entrada=existente.data_entrada,
            total_epis=total_epis
        )

    novo_func = FuncionarioEPI(
        nome=nome_norm,
        funcao=dados.funcao or "Ajudante de Motorista",
        setor=dados.setor or "Distribuição",
        local=dados.local or "Cascavel",
        registro=dados.registro or "373",
        data_entrada=dados.data_entrada or datetime.now().strftime("%Y-%m-%d")
    )
    db.add(novo_func)
    db.commit()
    db.refresh(novo_func)

    return FuncionarioEPIOut(
        id=str(novo_func.id),
        nome=novo_func.nome,
        funcao=novo_func.funcao or "Ajudante de Motorista",
        setor=novo_func.setor or "Distribuição",
        local=novo_func.local or "Cascavel",
        registro=novo_func.registro or "373",
        data_entrada=novo_func.data_entrada,
        total_epis=0
    )


@router.put("/funcionarios/{funcionario_id}", response_model=FuncionarioEPIOut)
def atualizar_funcionario_epi(
    funcionario_id: str,
    dados: FuncionarioEPIUpdate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Atualiza os dados de um funcionário exclusivo do módulo de EPIs.
    """
    func_epi = db.query(FuncionarioEPI).filter(FuncionarioEPI.id == funcionario_id).first()
    if not func_epi:
        raise HTTPException(status_code=404, detail="Funcionário de EPI não encontrado.")

    nome_antigo = func_epi.nome

    if dados.nome is not None and dados.nome.strip():
        func_epi.nome = dados.nome.strip()
    if dados.funcao is not None:
        func_epi.funcao = dados.funcao.strip()
    if dados.setor is not None:
        func_epi.setor = dados.setor.strip()
    if dados.local is not None:
        func_epi.local = dados.local.strip()
    if dados.registro is not None:
        func_epi.registro = dados.registro.strip()
    if dados.data_entrada is not None:
        func_epi.data_entrada = dados.data_entrada.strip()

    # Se o nome mudou, sincroniza as entregas associadas
    if dados.nome and dados.nome.strip() != nome_antigo:
        db.query(EntregaEPI).filter(
            func.upper(EntregaEPI.colaborador_nome) == nome_antigo.upper()
        ).update({"colaborador_nome": func_epi.nome}, synchronize_session=False)

    db.commit()
    db.refresh(func_epi)

    total_epis = db.query(EntregaEPI).filter(
        func.upper(EntregaEPI.colaborador_nome) == func_epi.nome.upper()
    ).count()

    return FuncionarioEPIOut(
        id=str(func_epi.id),
        nome=func_epi.nome,
        funcao=func_epi.funcao or "Ajudante de Motorista",
        setor=func_epi.setor or "Distribuição",
        local=func_epi.local or "Cascavel",
        registro=func_epi.registro or "373",
        data_entrada=func_epi.data_entrada,
        total_epis=total_epis
    )


@router.delete("/funcionarios/limpar-todos")
def limpar_todos_funcionarios_epi(
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Exclui o catálogo de funcionários e suas entregas, estornando o estoque."""
    entregas = db.query(EntregaEPI).all()
    for entrega in entregas:
        if entrega.epi:
            entrega.epi.estoque_real = (entrega.epi.estoque_real or 0.0) + (entrega.quantidade or 0.0)
        db.delete(entrega)

    total_funcionarios = db.query(FuncionarioEPI).delete(synchronize_session=False)
    db.commit()
    return {
        "mensagem": f"Banco de funcionários zerado com sucesso. {total_funcionarios} funcionário(s) excluído(s).",
        "funcionarios_excluidos": total_funcionarios,
        "entregas_excluidas": len(entregas),
    }


@router.delete("/funcionarios/{funcionario_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_funcionario_epi(
    funcionario_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Remove um funcionário da tabela exclusiva de EPIs.
    """
    func_epi = db.query(FuncionarioEPI).filter(FuncionarioEPI.id == funcionario_id).first()
    if not func_epi:
        raise HTTPException(status_code=404, detail="Funcionário de EPI não encontrado.")

    # Remove também o histórico e estorna os itens ao estoque.
    entregas = db.query(EntregaEPI).filter(
        func.upper(EntregaEPI.colaborador_nome) == func_epi.nome.upper()
    ).all()
    for entrega in entregas:
        if entrega.epi:
            entrega.epi.estoque_real = (entrega.epi.estoque_real or 0.0) + (entrega.quantidade or 0.0)
        db.delete(entrega)

    db.delete(func_epi)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)




@router.get("/entregas", response_model=List[EntregaEPIOut])
def listar_entregas(
    colaborador: Optional[str] = Query(None, description="Filtrar por nome do colaborador"),
    epi_id: Optional[int] = Query(None, description="Filtrar por ID do EPI"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """Lista as entregas registradas com filtros opcionais."""
    query = db.query(EntregaEPI)
    if colaborador:
        query = query.filter(EntregaEPI.colaborador_nome.ilike(f"%{colaborador.strip()}%"))
    if epi_id:
        query = query.filter(EntregaEPI.epi_id == epi_id)

    return query.order_by(EntregaEPI.created_at.desc()).all()


@router.get("/entregas/{entrega_id}/pdf")
def gerar_pdf_entrega(
    entrega_id: str,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Gera e faz download da Ficha Individual de EPI em PDF com Termo de
    Responsabilidade e Ato Faltoso (Art. 482 CLT / NR-6) para a entrega indicada.
    """
    entrega = db.query(EntregaEPI).filter(EntregaEPI.id == entrega_id).first()
    if not entrega:
        raise HTTPException(status_code=404, detail="Registro de entrega não encontrado.")

    colaborador = {
        "nome": entrega.colaborador_nome,
        "registro": entrega.colaborador_registro or "N/A",
        "funcao": entrega.funcao or "Operacional",
        "setor": entrega.setor or "Logística / Distribuição",
        "local": entrega.local or "Cascavel",
        "data_admissao": entrega.data_entrega
    }

    # Busca dados do EPI
    epi = entrega.epi
    item_entrega = {
        "data_entrega": entrega.data_entrega,
        "quantidade": entrega.quantidade,
        "unidade": epi.unidade if epi else "UN",
        "descricao": epi.descricao if epi else "EPI",
        "numero_ca": epi.numero_ca if epi else "S/CA",
        "motivo": entrega.motivo,
        "cod_epi": entrega.cod_epi or str(entrega.epi_id),
        "tamanho": entrega.tamanho or ""
    }

    pdf_bytes = gerar_ficha_epi_pdf(colaborador, [item_entrega])
    filename = f"ficha_epi_{entrega.colaborador_nome.replace(' ', '_')}_{entrega.id[:8]}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )


@router.get("/ficha-colaborador-pdf")
def gerar_pdf_ficha_completa(
    colaborador_nome: str = Query(..., description="Nome do colaborador para gerar a ficha"),
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(get_current_user)
):
    """
    Gera a Ficha Oficial de EPI completa com todo o histórico de entregas
    feitas para o colaborador informado, idêntica ao modelo físico (Imagem 2).
    """
    entregas = (
        db.query(EntregaEPI)
        .filter(EntregaEPI.colaborador_nome.ilike(f"%{colaborador_nome.strip()}%"))
        .order_by(EntregaEPI.created_at.desc())
        .all()
    )

    if not entregas:
        raise HTTPException(status_code=404, detail=f"Nenhuma entrega encontrada para '{colaborador_nome}'.")

    primeira = entregas[0]
    colaborador = {
        "nome": primeira.colaborador_nome,
        "registro": primeira.colaborador_registro or "N/A",
        "funcao": primeira.funcao or "Operacional",
        "setor": primeira.setor or "Logística",
        "local": primeira.local or "Cascavel",
        "data_admissao": primeira.data_entrega
    }

    itens = []
    for ent in entregas:
        epi = ent.epi
        itens.append({
            "data_entrega": ent.data_entrega,
            "quantidade": ent.quantidade,
            "unidade": epi.unidade if epi else "UN",
            "descricao": epi.descricao if epi else "EPI",
            "numero_ca": epi.numero_ca if epi else "S/CA",
            "motivo": ent.motivo,
            "cod_epi": ent.cod_epi or str(ent.epi_id),
            "tamanho": ent.tamanho or ""
        })

    pdf_bytes = gerar_ficha_epi_pdf(colaborador, itens)
    filename = f"ficha_epi_completa_{colaborador_nome.replace(' ', '_')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )
