import base64
import hashlib
import logging
from threading import Lock
from typing import Iterable

from cryptography.fernet import Fernet, MultiFernet
from app.core.config import settings

logger = logging.getLogger("app.encryption")

# Contador de falhas de descriptografia (por processo). Uma falha quase sempre
# significa ENCRYPTION_KEY trocada sem a chave anterior em LEGACY_ENCRYPTION_KEYS.
_falhas_descriptografia = 0
_falhas_lock = Lock()

_MENSAGEM_CHAVE = (
    "Falha ao descriptografar dado sensível (%s). A ENCRYPTION_KEY atual não abre "
    "este registro. Volte a chave anterior ou inclua-a em LEGACY_ENCRYPTION_KEYS. "
    "NÃO apague registros: o dado continua intacto no banco. Falhas neste processo: %d"
)


def _registrar_falha_descriptografia(tipo: str) -> None:
    """Loga a falha sem nunca incluir o valor. Loga a 1ª, 10ª, 100ª... para não inundar o log."""
    global _falhas_descriptografia
    with _falhas_lock:
        _falhas_descriptografia += 1
        total = _falhas_descriptografia
    if total == 1 or total in (10, 100, 1000) or total % 10000 == 0:
        logger.error(_MENSAGEM_CHAVE, tipo, total)


def total_falhas_descriptografia() -> int:
    return _falhas_descriptografia


def _derive_fernet_key(raw_key: str) -> bytes:
    key_hash = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(key_hash)


def _build_fernet_suite() -> MultiFernet:
    """
    Cria um MultiFernet para rotação e compatibilidade segura de chaves:
    - O primeiro Fernet é a chave ativa atual (ENCRYPTION_KEY), usada para novas encriptações.
    - As chaves seguintes são legadas (SECRET_KEY e chaves históricas do banco),
      garantindo que qualquer dado antigo já gravado no PostgreSQL seja descriptografado
      com sucesso para visualização, sem quebrar o sistema.
    """
    if not settings.ENCRYPTION_KEY and settings.ENVIRONMENT != "development":
        logger.warning(
            "ENCRYPTION_KEY não definida: usando a SECRET_KEY para criptografar dados. "
            "Defina ENCRYPTION_KEY (diferente da SECRET_KEY) e mantenha-a fixa."
        )
    primary_raw = settings.ENCRYPTION_KEY or settings.SECRET_KEY
    primary_key = _derive_fernet_key(primary_raw)
    fernet_keys = [primary_key]

    # Candidatas legadas para decodificar registros anteriores caso configuradas
    # via variáveis de ambiente (nunca fixas no código fonte)
    legacy_candidates = []
    if settings.SECRET_KEY:
        legacy_candidates.append(settings.SECRET_KEY)
    if settings.LEGACY_ENCRYPTION_KEYS:
        legacy_candidates.extend([k.strip() for k in settings.LEGACY_ENCRYPTION_KEYS.split(",") if k.strip()])

    for candidate in legacy_candidates:
        if candidate:
            key_bytes = _derive_fernet_key(candidate)
            if key_bytes not in fernet_keys:
                fernet_keys.append(key_bytes)

    return MultiFernet([Fernet(k) for k in fernet_keys])


_fernet = _build_fernet_suite()


def encrypt_val(val: str) -> str:
    """
    Criptografa um dado sensível em formato texto plano usando AES-128/Fernet (Base64).
    """
    if not val or not isinstance(val, str):
        return val
    try:
        # Se o dado já for um token Fernet válido, retorna sem duplicar encriptação
        if val.startswith("gAAAAA"):
            return val
        return _fernet.encrypt(val.encode("utf-8")).decode("utf-8")
    except Exception as e:
        raise ValueError(f"Falha de segurança ao criptografar dado sensível: {e}") from e


def decrypt_val(val: str) -> str:
    """
    Descriptografa um token Fernet para o dado original em texto claro.

    Se nenhuma chave configurada abrir o token, devolve o próprio token (sem
    alteração) e registra o erro no log. Devolver o token é proposital: como
    encrypt_val não recriptografa valores "gAAAAA...", salvar o registro na tela
    preserva o dado original. Trocar por um texto de erro faria esse texto ser
    gravado por cima do dado real.
    """
    if not val or not isinstance(val, str):
        return val
    if not val.startswith("gAAAAA"):
        return val
    try:
        return _fernet.decrypt(val.encode("utf-8")).decode("utf-8")
    except Exception:
        _registrar_falha_descriptografia("texto")
        return val


def encrypt_bytes(val: bytes) -> bytes:
    """Criptografa arquivos sensíveis antes de salvá-los no banco."""
    if not val:
        return val
    return _fernet.encrypt(val)


def decrypt_bytes(val: bytes) -> bytes:
    """Descriptografa o arquivo para entrega somente ao usuário autenticado."""
    if not val:
        return val
    try:
        return _fernet.decrypt(val)
    except Exception:
        # Arquivos salvos antes da criptografia de anexos não são tokens Fernet
        # (começam com %PDF, \xff\xd8...). Só é falha de chave se for um token.
        if bytes(val[:6]) == b"gAAAAA":
            _registrar_falha_descriptografia("arquivo")
        return val


def verificar_chave_com_amostras(amostras: Iterable[str]) -> tuple[int, int]:
    """
    Tenta abrir tokens já gravados no banco com as chaves configuradas.
    Retorna (total_testado, total_que_falhou). Não altera nada.
    """
    testados = 0
    falhas = 0
    for token in amostras:
        if not token or not isinstance(token, str) or not token.startswith("gAAAAA"):
            continue
        testados += 1
        try:
            _fernet.decrypt(token.encode("utf-8"))
        except Exception:
            falhas += 1
    return testados, falhas


