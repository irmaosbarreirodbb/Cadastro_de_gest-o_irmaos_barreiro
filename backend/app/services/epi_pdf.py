import io
from datetime import datetime
from typing import List, Optional
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas as pdfcanvas

from app.services.pdf_texto import texto_pdf


MESES_PT = {
    1: "Janeiro", 2: "Fevereiro", 3: "Março", 4: "Abril",
    5: "Maio", 6: "Junho", 7: "Julho", 8: "Agosto",
    9: "Setembro", 10: "Outubro", 11: "Novembro", 12: "Dezembro"
}

CODIGOS_PADRAO_EPIS = [
    ("1",  "Capacete de Segurança",              "11", "Bota couro c/ biqueira kadesh"),
    ("2",  "Suspensão para capacete",             "12", "Bota couro c/ biqueira kadesh cano curto / Escritório"),
    ("3",  "Óculos de Seg. lente escura",         "13", "Bota de borracha 7 léguas"),
    ("4",  "Óculos de Seg. lente incolor",        "14", "Corta Pipas"),
    ("5",  "Máscara de Solda",                    "15", "Joelheira (Motoqueiro)"),
    ("6",  "Protetor Auditivo Tipo Plug",         "16", "Cotoveleira (Motoqueiro)"),
    ("7",  "Protetor Auditivo Tipo Concha",       "17", "Mascara NR-95"),
    ("8",  "Luva tric Preta",                     "18", "Capa de Chuva"),
    ("9",  "Luva tric Maxgrip Verde",             "19", "Luva Motoqueiro"),
    ("10", "Cinta ergonômica - Protetor Lombar",  "20", "Avental de PVC / Outros"),
]


class NumberedCanvas(pdfcanvas.Canvas):
    """Canvas de duas passagens para imprimir 'Página X de Y' no rodapé."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 7)
        self.setFillColor(colors.HexColor("#475569"))
        texto = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(A4[0] - 1.0 * cm, 0.6 * cm, texto)
        self.restoreState()


def formatar_data_extenso(data_str: Optional[str] = None) -> str:
    """Formata data para estilo '14 de Agosto de 2025'."""
    try:
        if data_str:
            if "/" in data_str:
                partes = data_str.split("/")
                dt = datetime(int(partes[2]), int(partes[1]), int(partes[0]))
            elif "-" in data_str:
                partes = data_str.split("-")
                dt = datetime(int(partes[0]), int(partes[1]), int(partes[2]))
            else:
                dt = datetime.now()
        else:
            dt = datetime.now()
        return f"{dt.day} de {MESES_PT.get(dt.month, '')} de {dt.year}"
    except Exception:
        hoje = datetime.now()
        return f"{hoje.day} de {MESES_PT.get(hoje.month, '')} de {hoje.year}"


def _p(text, style):
    """Helper para criar Paragraph com segurança."""
    return Paragraph(str(text) if text else "", style)


def gerar_ficha_epi_pdf(
    colaborador: dict,
    entregas: List[dict],
    cidade: str = "CASCAVEL-CE"
) -> bytes:
    """
    Gera em PDF a Ficha Oficial de Controle de Distribuição de EPI,
    idêntica ao modelo físico (Imagem 3).
    """
    buffer = io.BytesIO()

    # Margens simétricas e compactas como no físico
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )

    PAGE_W = A4[0] - 3.0 * cm   # largura útil total

    styles = getSampleStyleSheet()

    # ── Estilos ──────────────────────────────────────────────────────────────

    S = lambda name, **kw: ParagraphStyle(name, parent=styles['Normal'], **kw)

    sLogo = S('Logo',
              fontName='Helvetica-Bold', fontSize=22, leading=24, alignment=TA_LEFT)

    sLogoSub = S('LogoSub',
                 fontName='Helvetica-Bold', fontSize=6.5, leading=8,
                 textColor=colors.HexColor("#dc2626"), alignment=TA_LEFT)

    sFichaTitle = S('FichaTitle',
                    fontName='Helvetica-Bold', fontSize=12, leading=14,
                    alignment=TA_CENTER, textColor=colors.HexColor("#0f172a"))

    sFichaSub = S('FichaSub',
                  fontName='Helvetica-Bold', fontSize=8, leading=10,
                  alignment=TA_CENTER, textColor=colors.HexColor("#475569"))

    sDadosHeader = S('DadosHeader',
                     fontName='Helvetica-Bold', fontSize=8.5, leading=11,
                     textColor=colors.HexColor("#0f172a"))

    sDadosCell = S('DadosCell',
                   fontName='Helvetica', fontSize=7.5, leading=9.5,
                   textColor=colors.HexColor("#1e293b"))

    sNR = S('NR',
            fontName='Helvetica', fontSize=6.2, leading=7.8,
            alignment=TA_JUSTIFY, textColor=colors.HexColor("#334155"))

    sTermoTitulo = S('TermoTitulo',
                     fontName='Helvetica-Bold', fontSize=7.5, leading=9.5,
                     textColor=colors.HexColor("#dc2626"))

    sTermoTexto = S('TermoTexto',
                    fontName='Helvetica', fontSize=6.2, leading=7.8,
                    alignment=TA_JUSTIFY, textColor=colors.HexColor("#1e293b"))

    sAssData = S('AssData',
                 fontName='Helvetica-Bold', fontSize=7.5, leading=9.5,
                 textColor=colors.HexColor("#0f172a"))

    sCodTitulo = S('CodTitulo',
                   fontName='Helvetica-Bold', fontSize=7.5, leading=9,
                   alignment=TA_CENTER, textColor=colors.HexColor("#0f172a"))

    sCodNum = S('CodNum',
                fontName='Helvetica-Bold', fontSize=6.5, leading=8,
                alignment=TA_CENTER, textColor=colors.HexColor("#0f172a"))

    sCodDesc = S('CodDesc',
                 fontName='Helvetica', fontSize=6.5, leading=8,
                 alignment=TA_LEFT, textColor=colors.HexColor("#1e293b"))

    sLegenda = S('Legenda',
                 fontName='Helvetica', fontSize=6.2, leading=8,
                 textColor=colors.HexColor("#1e293b"))

    sBlueHead = S('BlueHead',
                  fontName='Helvetica-Bold', fontSize=8, leading=10,
                  alignment=TA_CENTER, textColor=colors.white)

    sBlueSub = S('BlueSub',
                 fontName='Helvetica-Bold', fontSize=6.5, leading=8,
                 alignment=TA_CENTER, textColor=colors.white)

    sTCell = S('TCell',
               fontName='Helvetica', fontSize=6.5, leading=8,
               alignment=TA_CENTER, textColor=colors.HexColor("#0f172a"))

    sTCellSm = S('TCellSm',
                 fontName='Helvetica', fontSize=5.5, leading=7,
                 alignment=TA_CENTER, textColor=colors.HexColor("#374151"))

    # ─────────────────────────────────────────────────────────────────────────
    # Coleta dados do colaborador
    # ─────────────────────────────────────────────────────────────────────────
    # Valores vindos do banco são escapados: o Paragraph interpreta marcações.
    nome_colab    = texto_pdf((colaborador.get("nome") or "").upper())
    registro_colab = texto_pdf(colaborador.get("registro", colaborador.get("matricula", "373")))
    funcao_colab  = texto_pdf(colaborador.get("funcao", "Ajudante de Motorista"))
    setor_colab   = texto_pdf(colaborador.get("setor", "Distribuição"))
    local_colab   = texto_pdf(colaborador.get("local", "Cascavel"))

    story = []

    # =========================================================================
    # 1. CABEÇALHO: LOGO  |  BOX "FICHA DE CONTROLE DE EPI"
    # =========================================================================
    logo_cell = [
        _p("<font size='22' color='#18181b'><b><i>L</i></b></font>"
           "<font size='22' color='#dc2626'><b><i>O</i></b></font>"
           "<font size='22' color='#18181b'><b><i>G</i></b></font>",
           sLogo),
        _p("DISTRIBUIDORA IRMÃOS BARREIRO", sLogoSub),
    ]

    titulo_cell = [
        _p("FICHA DE CONTROLE DE EPI", sFichaTitle),
        _p("EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL", sFichaSub),
    ]

    t_cabecalho = Table(
        [[logo_cell, titulo_cell]],
        colWidths=[5.5 * cm, PAGE_W - 5.5 * cm],
    )
    t_cabecalho.setStyle(TableStyle([
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING',  (0, 0), (0, 0), 0),
        ('RIGHTPADDING', (0, 0), (0, 0), 4),
        # Box somente ao redor do título
        ('BOX',          (1, 0), (1, 0), 1.0, colors.HexColor("#1e293b")),
        ('TOPPADDING',   (1, 0), (1, 0), 6),
        ('BOTTOMPADDING',(1, 0), (1, 0), 6),
        ('LEFTPADDING',  (1, 0), (1, 0), 8),
        ('RIGHTPADDING', (1, 0), (1, 0), 8),
    ]))
    story.append(t_cabecalho)
    story.append(Spacer(1, 0.25 * cm))

    # =========================================================================
    # 2. DADOS DO FUNCIONÁRIO
    # =========================================================================
    # Layout físico: linha 1 = "DADOS DO FUNCIONÁRIO" (título com fundo cinza)
    #                linha 2 = NOME  |  REGISTRO  |  LOCAL
    #                linha 3 = SETOR |  FUNÇÃO    |
    C1 = PAGE_W * 0.50
    C2 = PAGE_W * 0.25
    C3 = PAGE_W * 0.25

    dados_rows = [
        [_p("<b>DADOS DO FUNCIONÁRIO</b>", sDadosHeader), "", ""],
        [
            _p(f"<b>NOME:</b> {nome_colab}", sDadosCell),
            _p(f"<b>REGISTRO:</b> {registro_colab}", sDadosCell),
            _p(f"<b>LOCAL:</b> {local_colab}", sDadosCell),
        ],
        [
            _p(f"<b>SETOR:</b> {setor_colab}", sDadosCell),
            _p(f"<b>FUNÇÃO:</b> {funcao_colab}", sDadosCell),
            "",
        ],
    ]

    t_dados = Table(dados_rows, colWidths=[C1, C2, C3])
    t_dados.setStyle(TableStyle([
        ('BOX',          (0, 0), (-1, -1), 1.0, colors.HexColor("#1e293b")),
        ('INNERGRID',    (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
        ('SPAN',         (0, 0), (2, 0)),
        ('BACKGROUND',   (0, 0), (2, 0), colors.HexColor("#e2e8f0")),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',   (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 3),
        ('LEFTPADDING',  (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_dados)
    story.append(Spacer(1, 0.18 * cm))

    # =========================================================================
    # 3. NR 6.1 + TERMOS DE RESPONSABILIDADE + ATO FALTOSO
    # =========================================================================
    nr_text = (
        "<b>NR 6.1</b> Para os fins de aplicação desta norma Regulamentadora - NR, considera-se "
        "Equipamento de Proteção Individual - EPI é todo dispositivo de uso individual, de fabricação "
        "nacional ou estrangeira, destinado a proteger a saúde e a integridade física do trabalhador."
    )
    story.append(_p(nr_text, sNR))
    story.append(Spacer(1, 0.12 * cm))

    story.append(_p("Termo de Responsabilidade", sTermoTitulo))
    story.append(Spacer(1, 0.04 * cm))
    termo_resp = (
        "Recebi da <b>Irmãos Barreiro Logística LTDA</b>, os EPI'S adequados abaixo, os quais desde já me "
        "comprometo sempre usar na execução de minhas tarefas, zelando pela sua perfeita guarda e "
        "conservação, uso e funcionamento de acordo com as orientações e treinamentos recebidos da RH, "
        "assumindo também o compromisso de devolvê-lo quando solicitado ou em ocasião de rescisão de meu "
        "contrato de trabalho.<br/>"
        "Estou ciente e de pleno acordo que o não cumprimento das condições estabelecidas, acarretará, "
        "além de aplicações de penas disciplinares, inclusive rescisão de meu contrato laboral, outras "
        "sanções previstas em lei, em especial nas constantes na NR06, portaria 3.214 de 08/06/97, do "
        "Ministério do Trabalho."
    )
    story.append(_p(termo_resp, sTermoTexto))
    story.append(Spacer(1, 0.1 * cm))

    story.append(_p("Ato Faltoso", sTermoTitulo))
    story.append(Spacer(1, 0.04 * cm))
    ato_faltoso = (
        "<i>\"Constitui-se ato faltoso do colaborador a recusa injustificada de uso e/ou conservação dos "
        "EPI'S - Equipamento de Proteção Individual fornecidos pela empresa\". (Conforme previsto na "
        "Legislação vigente em seu artigo 482 da CLT).</i><br/>"
        "No caso de perda, dano, extravio ou avaria, por negligência minha dos equipamentos de proteção, "
        "o respectivo valor será debitado de minha remuneração, o que desde já autorizo.<br/>"
        "E para constar, assino a presente para produção dos efeitos legais."
    )
    story.append(_p(ato_faltoso, sTermoTexto))
    story.append(Spacer(1, 0.18 * cm))

    # =========================================================================
    # 4. DATA DA CIDADE  |  ASSINATURA
    # =========================================================================
    primeira_data = entregas[0].get("data_entrega") if entregas else None
    data_fmt = formatar_data_extenso(primeira_data)

    t_ass = Table(
        [[
            _p(f"<b>{texto_pdf(cidade.upper())}, {texto_pdf(data_fmt.upper())}.</b>", sAssData),
            _p("<b>ASSINATURA</b> _____________________________________________", sAssData),
        ]],
        colWidths=[8.5 * cm, PAGE_W - 8.5 * cm],
    )
    t_ass.setStyle(TableStyle([
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',   (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 0),
        ('LEFTPADDING',  (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(t_ass)
    story.append(Spacer(1, 0.22 * cm))

    # =========================================================================
    # 5. TABELA CÓDIGO DOS EPI'S  (2 grupos lado a lado, 1-10 e 11-20)
    # =========================================================================
    # Largura das colunas: [num | descrição | num | descrição]
    W_NUM  = 0.7 * cm
    W_DESC = (PAGE_W / 2) - W_NUM
    col_w_cod = [W_NUM, W_DESC, W_NUM, W_DESC]

    cod_rows = [
        [_p("<b>CÓDIGO DOS EPI'S</b>", sCodTitulo), "", "", ""],
    ]
    for c1, d1, c2, d2 in CODIGOS_PADRAO_EPIS:
        cod_rows.append([
            _p(f"<b>{c1}</b>", sCodNum),
            _p(d1, sCodDesc),
            _p(f"<b>{c2}</b>", sCodNum),
            _p(d2, sCodDesc),
        ])

    t_cod = Table(cod_rows, colWidths=col_w_cod)
    t_cod.setStyle(TableStyle([
        ('BOX',          (0, 0), (-1, -1), 0.8, colors.HexColor("#1e293b")),
        ('INNERGRID',    (0, 0), (-1, -1), 0.35, colors.HexColor("#94a3b8")),
        ('SPAN',         (0, 0), (3, 0)),
        ('BACKGROUND',   (0, 0), (3, 0), colors.HexColor("#e2e8f0")),
        ('ALIGN',        (0, 0), (0, -1), 'CENTER'),
        ('ALIGN',        (2, 0), (2, -1), 'CENTER'),
        ('VALIGN',       (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING',   (0, 0), (-1, -1), 1.2),
        ('BOTTOMPADDING',(0, 0), (-1, -1), 1.2),
        ('LEFTPADDING',  (0, 0), (-1, -1), 3),
        ('RIGHTPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(t_cod)
    story.append(Spacer(1, 0.08 * cm))

    # ── Legenda ───────────────────────────────────────────────────────────────
    legenda_text = (
        "<b>LEGENDA: A</b>- Admissão &nbsp;&nbsp;•&nbsp;&nbsp; "
        "<b>P</b>- Perda &nbsp;&nbsp;•&nbsp;&nbsp; "
        "<b>TR</b>- Necessidade de Troca &nbsp;&nbsp;•&nbsp;&nbsp; "
        "<b>D</b>- Demissão &nbsp;&nbsp;•&nbsp;&nbsp; "
        "<b>F</b>- Furto &nbsp;&nbsp;•&nbsp;&nbsp; "
        "<b>DP</b>- Danos Provocados &nbsp;&nbsp;•&nbsp;&nbsp; "
        "<b>MU</b>- Mudança de função"
    )
    story.append(_p(legenda_text, sLegenda))
    story.append(Spacer(1, 0.18 * cm))

    # =========================================================================
    # 6. TABELA DE CONTROLE DE ENTREGA - AZUL (igual ao físico)
    # =========================================================================
    # Colunas: Qtde | Cod EPI'S/Uniformes | Tamanho/Nº | Motivo | CA | Data Recebimento | Assinatura do empregado
    # Proporções baseadas na imagem física:
    W_QTD   = 1.1 * cm
    W_COD   = 2.5 * cm
    W_TAM   = 2.2 * cm
    W_MOT   = 1.5 * cm
    W_CA    = 2.0 * cm
    W_DATA  = 2.5 * cm
    W_ASS   = PAGE_W - (W_QTD + W_COD + W_TAM + W_MOT + W_CA + W_DATA)
    col_w_ctrl = [W_QTD, W_COD, W_TAM, W_MOT, W_CA, W_DATA, W_ASS]

    AZUL_TITULO  = colors.HexColor("#1a3a6b")   # Azul marinho escuro (igual ao físico)
    AZUL_HEADER  = colors.HexColor("#1e3d8f")   # Azul das colunas
    GRID_COLOR   = colors.HexColor("#7090c8")   # Linha de grade

    ctrl_rows = [
        # Linha 1: Título
        [_p("CONTROLE DE EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL - EPI", sBlueHead),
         "", "", "", "", "", ""],
        # Linha 2: Cabeçalhos das colunas
        [
            _p("Qtde.", sBlueSub),
            _p("Cód. EPI'S /<br/>Uniformes", sBlueSub),
            _p("Tamanho/Nº", sBlueSub),
            _p("Motivo", sBlueSub),
            _p("CA", sBlueSub),
            _p("Data Recebimento", sBlueSub),
            _p("Assinatura do empregado", sBlueSub),
        ],
    ]

    # Preenche com os registros reais de entrega
    for item in entregas:
        qtd_v  = f"{float(item.get('quantidade', 1)):.0f}"
        cod_v  = texto_pdf(item.get("cod_epi", item.get("epi_id", "")))
        tam_v  = texto_pdf(item.get("tamanho", "") or "")
        mot_v  = texto_pdf(item.get("motivo", "A"))
        ca_v   = texto_pdf(item.get("numero_ca", item.get("ca", "")) or "")
        data_v = texto_pdf(item.get("data_entrega", item.get("data", "")) or "")

        ctrl_rows.append([
            _p(qtd_v,  sTCell),
            _p(cod_v,  sTCell),
            _p(tam_v,  sTCell),
            _p(mot_v,  sTCell),
            _p(ca_v,   sTCellSm),
            _p(data_v, sTCell),
            _p("", sTCell),   # espaço para assinatura manual
        ])

    # Linhas vazias para preencher página (no físico há ~10 linhas disponíveis)
    LINHAS_MIN = 10
    for _ in range(max(0, LINHAS_MIN - len(entregas))):
        ctrl_rows.append(["", "", "", "", "", "", ""])

    t_ctrl = Table(ctrl_rows, colWidths=col_w_ctrl, repeatRows=2)
    t_ctrl.setStyle(TableStyle([
        # Título azul marinho
        ('SPAN',          (0, 0), (6, 0)),
        ('BACKGROUND',    (0, 0), (6, 0), AZUL_TITULO),
        # Cabeçalho das colunas em azul mais claro
        ('BACKGROUND',    (0, 1), (6, 1), AZUL_HEADER),
        # Grade geral
        ('BOX',           (0, 0), (-1, -1), 1.0, colors.HexColor("#1e293b")),
        ('INNERGRID',     (0, 1), (-1, -1), 0.5, GRID_COLOR),
        # Alinhamentos
        ('ALIGN',         (0, 0), (-1, 1),  'CENTER'),
        ('ALIGN',         (0, 2), (-1, -1), 'CENTER'),
        ('VALIGN',        (0, 0), (-1, -1), 'MIDDLE'),
        # Padding
        ('TOPPADDING',    (0, 0), (-1, 1),  4),
        ('BOTTOMPADDING', (0, 0), (-1, 1),  4),
        ('TOPPADDING',    (0, 2), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 2), (-1, -1), 4),
        ('LEFTPADDING',   (0, 0), (-1, -1), 2),
        ('RIGHTPADDING',  (0, 0), (-1, -1), 2),
        # Linha de altura mínima nas linhas vazias para simular papel em branco
        ('ROWBACKGROUNDS',(0, 2), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
    ]))
    story.append(t_ctrl)

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
