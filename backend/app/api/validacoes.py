from fastapi import HTTPException, status

from app.core.encryption import token_ilegivel


def recusar_dado_ilegivel(valor, rotulo: str, valor_atual=None) -> None:
    """
    Impede que um dado criptografado ilegível ("gAAAAA..." que nenhuma chave abre)
    seja copiado para outro registro.

    Era assim que um PIX ilegível se espalhava: a tela recebia o código cifrado,
    reaproveitava (catálogo, "replicar equipe", recibo) e o backend gravava o
    código como veio.

    `valor_atual`: numa edição, se o valor recebido é o mesmo que já está gravado,
    não é uma cópia — o registro só está sendo salvo de novo (ex.: mudar a
    quantidade). Nesse caso passa, para não travar a edição.
    """
    if not token_ilegivel(valor):
        return
    if valor_atual is not None and valor == valor_atual:
        return
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=(
            f"O {rotulo} deste cadastro está ilegível (foi gravado com uma chave de "
            f"criptografia antiga). Informe o {rotulo} novamente."
        ),
    )
