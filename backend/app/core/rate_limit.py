"""Rate limiting local para proteger rotas expostas.

Em produção com múltiplas instâncias, substitua este armazenamento em memória por
Redis ou outro backend compartilhado.
"""
from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status

from app.core.config import settings

_requests = defaultdict(deque)
_lock = Lock()


def get_client_ip(request: Request) -> str:
    """
    IP real de quem fez a requisição.

    No Railway toda requisição passa pelo proxy de borda, então request.client.host
    é o IP do proxy (igual para todos os usuários) e o limite viraria global:
    5 senhas erradas de qualquer pessoa travariam o login da empresa inteira.
    O Railway informa o IP do visitante no cabeçalho X-Real-IP
    (docs.railway.com/networking/public-networking/specs-and-limits).
    Em desenvolvimento o cabeçalho é ignorado, pois não há proxy para preenchê-lo.
    """
    if settings.ENVIRONMENT != "development":
        real_ip = (request.headers.get("x-real-ip") or "").strip()
        if real_ip:
            return real_ip
    return request.client.host if request.client else "unknown"


def enforce_rate_limit(request: Request, scope: str, limit: int, window_seconds: int) -> None:
    client_ip = get_client_ip(request)
    key = f"{scope}:{client_ip}"
    now = monotonic()
    with _lock:
        attempts = _requests[key]
        while attempts and attempts[0] <= now - window_seconds:
            attempts.popleft()
        if len(attempts) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Muitas tentativas. Aguarde alguns minutos e tente novamente.",
                headers={"Retry-After": str(window_seconds)},
            )
        attempts.append(now)
