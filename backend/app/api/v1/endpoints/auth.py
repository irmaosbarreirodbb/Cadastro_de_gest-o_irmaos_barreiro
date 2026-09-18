from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.usuario import Usuario
from app.schemas.auth import LoginRequest, Token, UserOut
from app.api.deps import get_current_user
from app.core.rate_limit import enforce_rate_limit
from app.core.config import settings

router = APIRouter()

@router.post("/login", response_model=Token)
def login(login_data: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce_rate_limit(request, "login", limit=5, window_seconds=900)
    email_clean = login_data.email.strip()
    user = db.query(Usuario).filter(Usuario.email.ilike(email_clean)).first()
    
    # Resposta idêntica para usuário não encontrado ou senha inválida (evita enumeração)
    credenciais_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais inválidas. Verifique seu e-mail e senha.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not user:
        raise credenciais_invalidas
    
    if not verify_password(login_data.senha, user.senha):
        raise credenciais_invalidas
            
    token = create_access_token(subject=user.id)
    # Frontend e backend usam domínios públicos distintos no Railway. Para o
    # navegador enviar a sessão nas chamadas fetch entre eles, o cookie precisa
    # permitir contexto cross-site em produção. Continua protegido por HTTPS e
    # inacessível ao JavaScript.
    is_production = settings.ENVIRONMENT != "development"
    cookie_max_age = int(settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    response.set_cookie(
        key="barreiro_session",
        value=token,
        httponly=True,
        secure=is_production,
        samesite="none" if is_production else "lax",
        max_age=cookie_max_age,
        path="/",
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserOut.model_validate(user),
        "message": "Autenticado com sucesso."
    }

@router.post("/logout")
def logout(response: Response):
    """
    Encerra a sessão ativa e revoga o cookie HttpOnly do navegador.
    """
    is_production = settings.ENVIRONMENT != "development"
    response.delete_cookie(
        key="barreiro_session",
        path="/",
        secure=is_production,
        httponly=True,
        samesite="none" if is_production else "lax",
    )
    return {"status": "ok", "message": "Sessão encerrada com sucesso."}

@router.get("/me", response_model=UserOut)
def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
