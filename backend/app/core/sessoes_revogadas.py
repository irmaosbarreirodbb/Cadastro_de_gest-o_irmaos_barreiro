"""Tokens invalidados pelo logout.

O JWT vale 8 horas por conta própria. Sem esta lista, quem copiasse o token de
alguém continuaria entrando no sistema mesmo depois de a pessoa clicar em Sair.
No logout, o identificador do token (jti) entra aqui até a hora em que ele
expiraria; o get_current_user recusa qualquer token que esteja na lista.

Limitação: a lista fica na memória do processo. Um novo deploy ou restart
esvazia a lista (tokens já deslogados voltariam a valer até expirarem), e com
várias réplicas cada uma teria a sua. Para isso, o próximo passo seria guardar
a lista no banco ou no Redis.
"""
from threading import Lock
from time import time

_revogados: dict[str, float] = {}  # jti -> timestamp (epoch) em que o token expira
_lock = Lock()


def revogar(jti: str, expira_em: float) -> None:
    if not jti:
        return
    with _lock:
        _limpar_expirados()
        _revogados[jti] = expira_em


def esta_revogado(jti: str | None) -> bool:
    if not jti:
        return False
    with _lock:
        expira_em = _revogados.get(jti)
        if expira_em is None:
            return False
        if expira_em <= time():
            del _revogados[jti]  # já expirou de qualquer jeito; não precisa mais guardar
            return False
        return True


def _limpar_expirados() -> None:
    agora = time()
    for jti in [j for j, exp in _revogados.items() if exp <= agora]:
        del _revogados[jti]
