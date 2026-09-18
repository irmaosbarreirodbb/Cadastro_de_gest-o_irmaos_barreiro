import base64
import hashlib
import warnings
from cryptography.fernet import Fernet, MultiFernet
from app.core.config import settings


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
    """
    if not val or not isinstance(val, str):
        return val
    try:
        if val.startswith("gAAAAA"):
            return _fernet.decrypt(val.encode("utf-8")).decode("utf-8")
        return val
    except Exception:
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
        # Compatibilidade com arquivos salvos antes da criptografia de anexos.
        return val


