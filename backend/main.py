import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text, func
from app.core.config import settings
from app.core.database import Base, engine, SessionLocal
from app.core.security import get_password_hash
from app.core.encryption import encrypt_val
from app.api.v1.api import api_router
from app.models import (
    Usuario, 
    FuncionarioBase, 
    RegistroFuncionario, 
    DiaristaLancamento, 
    Recibo, 
    ColaboradorCadastro,
    DocumentoColaborador,
    PessoaJuridicaCadastro,
    DocumentoPessoaJuridica,
    PermissaoTrabalho,
    EPI,
    EntregaEPI,
    FuncionarioEPI
)

# Inicializa as tabelas no banco de dados PostgreSQL (Barreiro) automaticamente na inicialização
def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        
        # Garante compatibilidade de tamanho para campos criptografados
        with engine.connect() as conn:
            migration_sqls = [
                "ALTER TABLE pessoas_fisicas_cadastros ALTER COLUMN cpf TYPE TEXT;",
                "ALTER TABLE pessoas_fisicas_cadastros ALTER COLUMN rg TYPE TEXT;",
                "ALTER TABLE pessoas_fisicas_cadastros ALTER COLUMN telefone TYPE TEXT;",
                "ALTER TABLE pessoas_fisicas_cadastros ALTER COLUMN agencia TYPE TEXT;",
                "ALTER TABLE pessoas_fisicas_cadastros ALTER COLUMN conta TYPE TEXT;",
                "ALTER TABLE pessoas_fisicas_cadastros ALTER COLUMN agencia DROP NOT NULL;",
                "ALTER TABLE pessoas_fisicas_cadastros ALTER COLUMN conta DROP NOT NULL;",
                "ALTER TABLE pessoas_fisicas_cadastros ALTER COLUMN chave_pix TYPE TEXT;",
                "ALTER TABLE funcionarios_base ALTER COLUMN chave_pix TYPE TEXT;",
                "ALTER TABLE diaristas_lancamentos ALTER COLUMN chave_pix TYPE TEXT;",
                "ALTER TABLE recibos ALTER COLUMN cpf_diarista TYPE TEXT;",
                "ALTER TABLE recibos ALTER COLUMN chave_pix TYPE TEXT;",
                "ALTER TABLE funcionarios_base ADD COLUMN IF NOT EXISTS data_entrada VARCHAR(20);",
                """
                DO $$
                BEGIN
                    IF to_regclass('public.colaboradores_cadastros') IS NOT NULL THEN
                        -- Preserva exclusivamente o cadastro solicitado e seus anexos.
                        INSERT INTO pessoas_fisicas_cadastros
                        SELECT * FROM colaboradores_cadastros
                        WHERE nome_completo ILIKE '%PEDRO ALCANTRA%'
                        ON CONFLICT (id) DO NOTHING;

                        IF to_regclass('public.documentos_colaboradores') IS NOT NULL THEN
                            INSERT INTO documentos_pessoas_fisicas
                            SELECT d.* FROM documentos_colaboradores d
                            INNER JOIN colaboradores_cadastros c ON c.id = d.colaborador_id
                            WHERE c.nome_completo ILIKE '%PEDRO ALCANTRA%'
                            ON CONFLICT (id) DO NOTHING;
                        END IF;

                    END IF;
                END $$;
                """,
                """
                CREATE TABLE IF NOT EXISTS registro_funcionarios (
                    id VARCHAR PRIMARY KEY,
                    nome VARCHAR(150) NOT NULL,
                    funcao VARCHAR(100),
                    data_entrada VARCHAR(20),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """,
                """
                CREATE TABLE IF NOT EXISTS permissoes_trabalho (
                    id VARCHAR PRIMARY KEY,
                    tipo VARCHAR(50) NOT NULL,
                    numero_pt VARCHAR(30),
                    dados JSON NOT NULL DEFAULT '{}',
                    responsavel VARCHAR(150),
                    local_trabalho VARCHAR(200),
                    data_inicio VARCHAR(30),
                    status VARCHAR(30) DEFAULT 'EMITIDA' NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """,
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='registro_funcionarios' AND column_name='profissao'
                    ) THEN
                        UPDATE registro_funcionarios 
                        SET funcao = COALESCE(NULLIF(funcao, ''), profissao)
                        WHERE funcao IS NULL OR funcao = '';
                        
                    END IF;
                END $$;
                """,
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS categoria VARCHAR(50) DEFAULT 'OUTROS';",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS observacao TEXT;",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS fabricante VARCHAR(150);",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS data_fabricacao VARCHAR(30);",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS validade_epi VARCHAR(30);",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS numero_ca VARCHAR(50);",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS validade_ca VARCHAR(30);",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS estoque_real FLOAT DEFAULT 0.0;",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS estoque_minimo FLOAT DEFAULT 0.0;",
                "ALTER TABLE epis ADD COLUMN IF NOT EXISTS unidade VARCHAR(20) DEFAULT 'UN';",
                "ALTER TABLE entregas_epis ADD COLUMN IF NOT EXISTS cod_epi VARCHAR(20);",
                "ALTER TABLE entregas_epis ADD COLUMN IF NOT EXISTS tamanho VARCHAR(30);",
                "ALTER TABLE entregas_epis ADD COLUMN IF NOT EXISTS local VARCHAR(100);",
                "ALTER TABLE entregas_epis ADD COLUMN IF NOT EXISTS motivo VARCHAR(20) DEFAULT 'A';",
                "ALTER TABLE entregas_epis ADD COLUMN IF NOT EXISTS termo_assinado BOOLEAN DEFAULT FALSE;"
            ]
            for sql in migration_sqls:
                try:
                    conn.execute(text(sql))
                except Exception as ex:
                    print(f"Migration notice: {ex}")
            conn.commit()
        
        # Carga inicial (seed) apenas se não houver nenhum usuário
        db = SessionLocal()
        try:
            # Usuário Padrão para Login com Senha Hashada (BCrypt) caso o banco seja 100% novo
            if settings.ENVIRONMENT == "development" and os.getenv("DEVELOPMENT_SEED_PASSWORD") and db.query(Usuario).count() == 0:
                user_padrao = Usuario(
                    email="colaborador@irmaosbarreiro.com.br",
                    senha=get_password_hash(os.environ["DEVELOPMENT_SEED_PASSWORD"])
                )
                db.add(user_padrao)
                db.commit()
                print("SEED: Usuário padrão criado com senha criptografada (BCrypt)!")
        finally:
            db.close()
    except Exception as e:
        print(f"Aviso ao inicializar DB: {e}")

# Executa criação de tabelas e seeds
init_db()

# Desabilita a interface Swagger (/docs) e ReDoc (/redoc) em produção
# para não expor a estrutura completa da API publicamente.
_is_production = settings.ENVIRONMENT != "development"
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API RESTful oficial da Distribuidora Irmãos Barreiro com criptografia de dados sensíveis e conectada ao PostgreSQL (Barreiro).",
    version="1.0.0",
    docs_url=None if _is_production else "/docs",
    redoc_url=None if _is_production else "/redoc",
    openapi_url=None if _is_production else "/openapi.json",
)

# Configuração flexível e segura de CORS para comunicação com o Frontend
env_origins = os.getenv("ALLOWED_ORIGINS", "")
custom_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
development_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Origem de produção atual do portal. Continua sendo uma lista explícita;
# valores adicionais podem ser informados em ALLOWED_ORIGINS.
production_origins = [
    "https://distribuidorairmaosbarreiros.up.railway.app",
    "https://distribuidorairmaosbarreirobebidas.up.railway.app",
    "https://distribuidorbarreirosbebidasltda.up.railway.app",
]
ALLOWED_ORIGINS = list(set((
    development_origins if settings.ENVIRONMENT == "development" else production_origins
) + custom_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security headers HTTP para hardening da API
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest
from starlette.responses import Response as StarletteResponse

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: StarletteRequest, call_next):
        response: StarletteResponse = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        if _is_production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# Inclui os roteadores da API v1
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {"status": "online"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
