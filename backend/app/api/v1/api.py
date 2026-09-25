from fastapi import APIRouter
from app.api.v1.endpoints import auth, colaboradores, documentos_pessoas_juridicas, funcionarios, diaristas, pessoas_juridicas, recibos, permissoes_trabalho, epis, exames, cnhs

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticação"])
api_router.include_router(colaboradores.router, prefix="/colaboradores", tags=["Fichas de Colaboradores"])
api_router.include_router(pessoas_juridicas.router, prefix="/pessoas-juridicas", tags=["Cadastros de Pessoas Jurídicas"])
api_router.include_router(documentos_pessoas_juridicas.router, prefix="/pessoas-juridicas", tags=["Documentos de Pessoas Jurídicas"])
api_router.include_router(funcionarios.router, prefix="/funcionarios-base", tags=["Catálogo de Funcionários"])
api_router.include_router(diaristas.router, prefix="/diaristas", tags=["Lançamentos de Diaristas"])
api_router.include_router(recibos.router, prefix="/recibos", tags=["Emissão de Recibos"])
api_router.include_router(permissoes_trabalho.router, prefix="/permissoes-trabalho", tags=["Permissões de Trabalho (PTs)"])
api_router.include_router(epis.router, prefix="/epis", tags=["Controle de EPIs"])
api_router.include_router(exames.router, prefix="/exames", tags=["Exames Toxicológicos"])
api_router.include_router(cnhs.router, prefix="/cnhs", tags=["Controle de CNH"])

