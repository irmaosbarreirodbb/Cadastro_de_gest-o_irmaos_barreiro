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
    FuncionarioEPI,
    ExameToxicologico
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
                "ALTER TABLE entregas_epis ADD COLUMN IF NOT EXISTS termo_assinado BOOLEAN DEFAULT FALSE;",
                """
                CREATE TABLE IF NOT EXISTS exames_toxicologicos (
                    id SERIAL PRIMARY KEY,
                    nome VARCHAR(150) NOT NULL,
                    data_exame VARCHAR(30) NOT NULL,
                    data_vencimento VARCHAR(30) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """,
                # Tabela de controle: evita envio duplicado de alertas de e-mail
                """
                CREATE TABLE IF NOT EXISTS alertas_exames_enviados (
                    id             SERIAL PRIMARY KEY,
                    exame_id       INTEGER NOT NULL,
                    nome_motorista VARCHAR(150) NOT NULL,
                    data_envio     DATE NOT NULL DEFAULT CURRENT_DATE,
                    tipo           VARCHAR(20) NOT NULL DEFAULT 'VENCENDO',
                    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                """,
                "CREATE INDEX IF NOT EXISTS idx_alertas_exame_data ON alertas_exames_enviados (exame_id, data_envio);"
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

# ============================================================================
# Scheduler inteligente de alertas de exames toxicológicos
#
# Comportamento:
#   • Dispara todos os dias às 08:00 (horário local do servidor)
#   • Usa sistema anti-duplicata baseado em banco de dados
#   • Exames VENCENDO (≤ 10 dias): alerta enviado uma única vez ao entrar na janela
#   • Exames VENCIDOS: realerta a cada 3 dias até ser renovado
#   • Resistente a reinicializações: o controle está no banco, não em memória
#   • Recuperação automática de erros: aguarda 5 min e tenta novamente
# ============================================================================
import threading
import time as _time

def _scheduler_alertas_exames():
    """
    Thread daemon com scheduler diário preciso às 08:00.
    Sistema anti-duplicata persistente via tabela alertas_exames_enviados.
    """
    import datetime as _dt
    from app.core.database import SessionLocal as _SessionLocal
    from app.services.email_service import verificar_e_enviar_alertas

    # Aguarda 30s após o boot para o banco estar 100% pronto
    _time.sleep(30)
    print("🔔 Scheduler de exames toxicológicos iniciado.")

    while True:
        agora = _dt.datetime.now()

        # ── Calcula próxima execução às 08:00 ──
        proximo_disparo = agora.replace(hour=8, minute=0, second=0, microsecond=0)
        if agora >= proximo_disparo:
            # Já passou das 08:00 de hoje → próxima é amanhã às 08:00
            proximo_disparo += _dt.timedelta(days=1)

        espera_seg = (proximo_disparo - agora).total_seconds()
        horas      = int(espera_seg // 3600)
        minutos    = int((espera_seg % 3600) // 60)
        print(
            f"⏰ Scheduler exames: próximo disparo em "
            f"{horas}h {minutos}min "
            f"({proximo_disparo.strftime('%d/%m/%Y às %H:%M')})"
        )

        # Dorme até às 08:00
        _time.sleep(espera_seg)

        # ── Executa verificação inteligente ──
        print(f"\n🚀 Scheduler exames: iniciando verificação às {_dt.datetime.now().strftime('%H:%M:%S')} de {_dt.date.today().strftime('%d/%m/%Y')}")
        tentativas = 0
        while tentativas < 3:
            db = None
            try:
                db = _SessionLocal()
                resultado = verificar_e_enviar_alertas(db)

                total    = resultado.get("total_alertas", 0)
                enviado  = resultado.get("enviado", False)
                mensagem = resultado.get("mensagem", "concluído.")
                motoristas = resultado.get("motoristas", [])

                if total > 0 and enviado:
                    print(f"📧 E-mail de alerta enviado! {total} motorista(s): {', '.join(motoristas)}")
                elif total > 0 and not enviado:
                    print(f"⚠️  Alerta detectado mas falha no envio: {mensagem}")
                else:
                    print(f"📭 Nenhum alerta necessário hoje.")
                break  # Sucesso — sai do loop de tentativas

            except Exception as exc:
                tentativas += 1
                print(f"❌ Scheduler exames — erro (tentativa {tentativas}/3): {exc}")
                if tentativas < 3:
                    _time.sleep(300)  # Aguarda 5 min antes de tentar novamente
            finally:
                if db:
                    try:
                        db.close()
                    except Exception:
                        pass

        print(f"✅ Ciclo do scheduler encerrado em {_dt.datetime.now().strftime('%H:%M:%S')}\n")


# Inicia a thread daemon — não bloqueia o servidor
_thread_alertas = threading.Thread(
    target=_scheduler_alertas_exames,
    daemon=True,
    name="AlertasExamesToxicologicos"
)
_thread_alertas.start()
print("✅ Thread de alertas automáticos de exames toxicológicos registrada.")

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
