from html import escape


def texto_pdf(valor) -> str:
    """
    Prepara um texto vindo do banco ou do usuário para entrar num Paragraph do ReportLab.

    O Paragraph interpreta marcações (<b>, <font>, <img src=...>). Sem escapar,
    um nome como 'JOAO <img src="http://...">' faz o servidor acessar a URL (SSRF)
    e um nome com '<' quebra a geração do PDF. Escapando, o texto aparece no PDF
    exatamente como foi digitado.
    """
    if valor is None:
        return ""
    return escape(str(valor), quote=False)
