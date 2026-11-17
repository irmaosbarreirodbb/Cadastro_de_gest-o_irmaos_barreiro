from datetime import datetime, timedelta, timezone
from typing import Any, Union
import jwt  # PyJWT (substitui o python-jose, que tem vulnerabilidades conhecidas e está sem manutenção)
import secrets
import bcrypt
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or not plain_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

# Hash descartável (de uma senha aleatória) usado quando o e-mail não existe.
# Assim o login leva o mesmo tempo com ou sem usuário cadastrado, e a demora
# da resposta não revela quais e-mails existem no sistema.
_HASH_FICTICIO = get_password_hash(secrets.token_urlsafe(32))

def simular_verificacao_senha(plain_password: str) -> None:
    verify_password(plain_password or "x", _HASH_FICTICIO)

def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # jti = identificador único deste login; o logout usa para invalidar o token no servidor.
    to_encode = {"exp": expire, "sub": str(subject), "jti": secrets.token_urlsafe(16)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict:
    """Valida assinatura e expiração. Levanta jwt.PyJWTError se o token for inválido."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
