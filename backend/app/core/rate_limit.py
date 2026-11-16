"""Rate limiting local para proteger rotas expostas.

Em produção com múltiplas instâncias, substitua este armazenamento em memória por
Redis ou outro backend compartilhado.
"""
from collections import defaultdict, deque
from ipaddress import ip_address
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status

from app.core.config import settings

_requests = defaultdict(deque)
_lock = Lock()
_janelas: dict[str, int] = {}  # janela (segundos) de cada escopo, usada na limpeza
_INTERVALO_LIMPEZA = 600  # segundos entre faxinas dos contadores antigos
_ultima_limpeza = monotonic()


def get_client_ip(request: Request) -> str:
    """
    IP real de quem fez a requisição.

    No Railway toda requisição passa pelo proxy de borda, então request.client.host
    é o IP do proxy (igual para todos os usuários) e o limite viraria global:
    5 senhas erradas de qualquer pessoa travariam o login da empresa inteira.
    O Railway informa o IP do visitante no cabeçalho X-Real-IP
    (docs.railway.com/networking/public-networking/specs-and-limits).
    Em desenvolvimento o cabeçalho é ignorado, pois não há proxy para preenchê-lo.

    Só aceita o cabeçalho se for um IP válido: um texto qualquer enviado nele
    não vira uma "chave" nova no contador.
    """
    if settings.ENVIRONMENT != "development":
        real_ip = (request.headers.get("x-real-ip") or "").strip()
        if real_ip:
            try:
                return str(ip_address(real_ip))
            except ValueError:
                pass
    return request.client.host if request.client else "unknown"


def _limpar_expirados(now: float) -> None:
    """Remove contadores sem tentativas recentes para a memória não crescer sem limite.
    Cada escopo usa a própria janela (login = 15 min, cadastros = 1 h)."""
    vazias = []
    for chave, tentativas in _requests.items():
        janela = _janelas.get(chave.split(":", 1)[0], 0)
        if not tentativas or tentativas[-1] <= now - janela:
            vazias.append(chave)
    for chave in vazias:
        del _requests[chave]


def enforce_rate_limit(request: Request, scope: str, limit: int, window_seconds: int) -> None:
    global _ultima_limpeza
    client_ip = get_client_ip(request)
    key = f"{scope}:{client_ip}"
    now = monotonic()
    with _lock:
        _janelas[scope] = max(window_seconds, _janelas.get(scope, 0))
        if now - _ultima_limpeza > _INTERVALO_LIMPEZA:
            _limpar_expirados(now)
            _ultima_limpeza = now
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
