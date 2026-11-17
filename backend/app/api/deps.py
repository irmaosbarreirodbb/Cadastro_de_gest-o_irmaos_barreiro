import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.sessoes_revogadas import esta_revogado
from app.models.usuario import Usuario

SESSION_COOKIE = "barreiro_session"

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)


def extrair_token(request: Request, token: str | None = None) -> str | None:
    """Token do cabeçalho Authorization (Bearer) ou, se não houver, do cookie de sessão."""
    return token or request.cookies.get(SESSION_COOKIE)


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Usuario:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Acesso não autorizado. Token de autenticação inválido ou expirado.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    token = extrair_token(request, token)
    if not token:
        raise credentials_exception

    try:
        payload = decode_access_token(token)
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    # Token invalidado por logout continua com assinatura válida, então é checado à parte.
    if esta_revogado(payload.get("jti")):
        raise credentials_exception

    user = db.query(Usuario).filter(Usuario.id == user_id).first()
    if user is None or not getattr(user, "ativo", True):
        raise credentials_exception

    return user
