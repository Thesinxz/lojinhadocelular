import os
import sys
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    KeepTogether,
    PageBreak,
    HRFlowable,
    Preformatted,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_PDF = os.path.join(CURRENT_DIR, "relatorio-auditoria-seguranca.pdf")
IMG_DONUT = os.path.join(CURRENT_DIR, "chart_donut.png")
IMG_BARS = os.path.join(CURRENT_DIR, "chart_bars.png")

# Paleta oficial exigida
COLOR_CRITICA = "#B91C1C"
COLOR_ALTA = "#EA580C"
COLOR_MEDIA = "#D97706"
COLOR_BAIXA = "#2563EB"
COLOR_FORTE = "#059669"
COLOR_TEXT = "#1E293B"
COLOR_MUTED = "#64748B"
COLOR_BG_LIGHT = "#F8FAFC"
COLOR_BORDER = "#E2E8F0"

def generate_charts():
    # 1. Gráfico de Rosca por Severidade
    labels_donut = ["Crítica (2)", "Alta (2)", "Média (2)", "Baixa (2)"]
    sizes_donut = [2, 2, 2, 2]
    colors_donut = [COLOR_CRITICA, COLOR_ALTA, COLOR_MEDIA, COLOR_BAIXA]

    fig, ax = plt.subplots(figsize=(4.2, 3.2), dpi=200)
    wedges, texts, autotexts = ax.pie(
        sizes_donut,
        labels=labels_donut,
        colors=colors_donut,
        autopct="%1.0f%%",
        pctdistance=0.75,
        startangle=140,
        wedgeprops=dict(width=0.45, edgecolor="white", linewidth=2),
    )
    for text in texts:
        text.set_color(COLOR_TEXT)
        text.set_fontsize(8.5)
        text.set_weight("bold")
    for autotext in autotexts:
        autotext.set_color("white")
        autotext.set_fontsize(8.5)
        autotext.set_weight("bold")
    ax.set_title("Achados por Severidade", fontsize=11, fontweight="bold", color=COLOR_TEXT, pad=10)
    plt.tight_layout()
    plt.savefig(IMG_DONUT, transparent=True)
    plt.close()

    # 2. Gráfico de Barras por Categoria
    categories = [
        "1. Banco Sem Tranca",
        "2. Permissão Navegador",
        "3. IDOR / Objeto",
        "4. Chaves Expostas",
        "5. Inputs / XSS",
        "Pontos Fortes (Auditados)",
    ]
    counts = [2, 1, 1, 2, 1, 7]
    bar_colors = [
        COLOR_CRITICA,
        COLOR_ALTA,
        COLOR_MEDIA,
        COLOR_CRITICA,
        COLOR_ALTA,
        COLOR_FORTE,
    ]

    fig, ax = plt.subplots(figsize=(6.5, 3.2), dpi=200)
    bars = ax.barh(categories, counts, color=bar_colors, height=0.55, edgecolor="none")
    ax.set_xlim(0, 8.5)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.spines["left"].set_color(COLOR_BORDER)
    ax.spines["bottom"].set_color(COLOR_BORDER)
    ax.tick_params(axis="both", which="both", labelsize=8, colors=COLOR_TEXT)
    ax.set_xlabel("Quantidade de Verificações / Achados", fontsize=8.5, fontweight="bold", color=COLOR_MUTED)
    ax.set_title("Achados e Pontos Fortes por Categoria", fontsize=11, fontweight="bold", color=COLOR_TEXT, pad=10)
    ax.invert_yaxis()

    for bar in bars:
        width = bar.get_width()
        ax.text(
            width + 0.25,
            bar.get_y() + bar.get_height() / 2,
            f"{int(width)}",
            ha="left",
            va="center",
            fontsize=8.5,
            fontweight="bold",
            color=COLOR_TEXT,
        )

    plt.tight_layout()
    plt.savefig(IMG_BARS, transparent=True)
    plt.close()

class NumberedCanvas(canvas.Canvas):
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
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count):
        if self._pageNumber == 1:
            return  # Capa sem cabeçalho/rodapé

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor(COLOR_MUTED))

        # Cabeçalho
        self.drawString(2 * cm, 28.3 * cm, "Relatório de Auditoria de Segurança — Lojinha do Celular")
        self.drawRightString(19 * cm, 28.3 * cm, "Confidencial • Auditoria de Código")
        self.setStrokeColor(colors.HexColor(COLOR_BORDER))
        self.setLineWidth(0.5)
        self.line(2 * cm, 28.1 * cm, 19 * cm, 28.1 * cm)

        # Rodapé
        self.line(2 * cm, 1.8 * cm, 19 * cm, 1.8 * cm)
        self.drawString(2 * cm, 1.4 * cm, "Lojinha do Celular • Relatório Técnico de Segurança de Software")
        self.drawRightString(19 * cm, 1.4 * cm, f"Página {self._pageNumber} de {page_count}")
        self.restoreState()

def format_issue_md(md_text):
    escaped = md_text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    lines = []
    in_code = False
    for line in escaped.split("\n"):
        stripped = line.strip()
        if stripped.startswith("```"):
            in_code = not in_code
            lines.append(f"<b><font color='#475569'>{stripped}</font></b>")
        elif in_code:
            lines.append(f"<font color='#0F172A'>{line}</font>")
        elif stripped.startswith("### "):
            lines.append(f"<br/><b><font color='#0F172A'>{stripped[4:]}</font></b>")
        elif stripped.startswith("- [ ] "):
            lines.append(f"&nbsp;&nbsp;• [ ] {stripped[6:]}")
        elif stripped.startswith("- "):
            lines.append(f"&nbsp;&nbsp;• {stripped[2:]}")
        else:
            lines.append(line)
    return "<br/>".join(lines)

def build_pdf():
    generate_charts()

    doc = SimpleDocTemplate(
        OUTPUT_PDF,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2.2 * cm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CoverTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=28,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=12,
    )
    subtitle_style = ParagraphStyle(
        "CoverSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor(COLOR_MUTED),
        spaceAfter=20,
    )
    h1 = ParagraphStyle(
        "Heading1_Custom",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=14,
        spaceAfter=8,
        keepWithNext=True,
    )
    h2 = ParagraphStyle(
        "Heading2_Custom",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#1E293B"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )
    body = ParagraphStyle(
        "Body_Custom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor(COLOR_TEXT),
        spaceAfter=6,
    )
    body_bold = ParagraphStyle(
        "Body_Bold",
        parent=body,
        fontName="Helvetica-Bold",
    )
    code_snippet = ParagraphStyle(
        "CodeSnippet",
        parent=styles["Normal"],
        fontName="Courier",
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#334155"),
        spaceBefore=4,
        spaceAfter=6,
    )

    story = []

    # =========================================================================
    # CAPA
    # =========================================================================
    story.append(Spacer(1, 1.5 * cm))
    badge_cover = Paragraph(
        "<font color='#B91C1C'><b>AUDITORIA TÉCNICA DE SEGURANÇA DA INFORMAÇÃO</b></font>",
        ParagraphStyle("CoverBadge", parent=body, fontSize=9, leading=12, spaceAfter=8)
    )
    story.append(badge_cover)
    story.append(Paragraph("Relatório de Auditoria de Segurança", title_style))
    story.append(Paragraph("<b>Projeto:</b> Lojinha do Celular (lojinhadocelular.com)<br/><b>Data da Avaliação:</b> 10 de Setembro de 2026<br/><b>Escopo Auditado:</b> Código-fonte completo (Frontend React + Backend Hono/tRPC + Drizzle ORM + Infra Dockerfile)", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor(COLOR_CRITICA), spaceAfter=20))

    meta_intro = """
    <b>Nota Metodológica e Mapeamento da Stack:</b><br/>
    A auditoria foi executada com metodologia estrita de análise estática de código (SAST) orientada a evidências comprovadas no repositório. A stack tecnológica detectada foi:
    <br/>• <b>Linguagem & Runtime:</b> TypeScript 5.9 / Node.js 22 (LTS)
    <br/>• <b>Backend Framework:</b> Hono v4.8 com roteamento tRPC v11 (@trpc/server)
    <br/>• <b>Banco de Dados & ORM:</b> MySQL 8.x com Drizzle ORM v0.45 (Single-Tenant E-commerce)
    <br/>• <b>Mecanismo de Autenticação:</b> Tokens customizados HMAC-SHA256 (Base64url) + Hashing com scryptSync
    <br/>• <b>Frontend:</b> React 19 SPA com Vite 7, Tailwind CSS e TanStack Query v5
    <br/>• <b>Deploy & Orquestração:</b> Dockerfile Multi-stage (node:22-alpine), Coolify e Traefik
    <br/><br/>
    Cada uma das 5 categorias obrigatórias foi adaptada à arquitetura do projeto:
    <br/><b>1. Banco sem Tranca:</b> Avaliação de isolamento entre público e administrador, exposição de dados na API pública e proteção da tabela <i>evaluations</i> (MySQL não possui RLS nativo do Postgres).
    <br/><b>2. Permissão no Navegador:</b> Confronto entre gates de interface em React e validação de sessão <i>requireAdmin</i> nos procedimentos tRPC.
    <br/><b>3. IDOR:</b> Inspeção exaustiva de todos os parâmetros identificadores (IDs inteiros e chaves externas) nas rotas de mutação/deleção.
    <br/><b>4. Chaves Expostas:</b> Verificação de credenciais embutidas, senhas mestras de fallback, segredos de assinatura e Dockerfile.
    <br/><b>5. Inputs sem Tratamento (XSS):</b> Rastreamento de URLs dinâmicas em <i>href</i>/<i>src</i> (vetor <i>javascript:</i>), sanitizadores e interpolações HTML em SSR.
    """
    story.append(Paragraph(meta_intro, body))
    story.append(PageBreak())

    # =========================================================================
    # RESUMO EXECUTIVO E GRÁFICOS
    # =========================================================================
    story.append(Paragraph("1. Resumo Executivo", h1))
    story.append(Paragraph(
        "A auditoria identificou um total de <b>8 achados de segurança</b> e confirmou <b>7 pontos fortes técnicos</b> implementados com excelência. "
        "Dentre os achados, <b>2 são de severidade Crítica</b> e exigem remediação emergencial imediata, pois viabilizam o comprometimento total do painel de administração da loja sem necessidade de credenciais válidas.",
        body
    ))
    story.append(Spacer(1, 6))

    # Tabela de Métricas Rápidas
    metrics_data = [
        [
            Paragraph("<b>Total de Achados</b>", body_bold),
            Paragraph("<b>Crítica</b>", body_bold),
            Paragraph("<b>Alta</b>", body_bold),
            Paragraph("<b>Média</b>", body_bold),
            Paragraph("<b>Baixa</b>", body_bold),
            Paragraph("<b>Pontos Fortes</b>", body_bold),
        ],
        [
            Paragraph("<font size=12><b>8</b></font>", body),
            Paragraph("<font size=12 color='#B91C1C'><b>2</b></font>", body),
            Paragraph("<font size=12 color='#EA580C'><b>2</b></font>", body),
            Paragraph("<font size=12 color='#D97706'><b>2</b></font>", body),
            Paragraph("<font size=12 color='#2563EB'><b>2</b></font>", body),
            Paragraph("<font size=12 color='#059669'><b>7</b></font>", body),
        ]
    ]
    t_metrics = Table(metrics_data, colWidths=[2.8*cm, 2.8*cm, 2.8*cm, 2.8*cm, 2.8*cm, 3.0*cm])
    t_metrics.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(COLOR_BG_LIGHT)),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor(COLOR_TEXT)),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(COLOR_BORDER)),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_metrics)
    story.append(Spacer(1, 12))

    # Gráficos em duas colunas
    charts_table = Table([
        [Image(IMG_DONUT, width=7.2*cm, height=5.5*cm), Image(IMG_BARS, width=9.8*cm, height=5.5*cm)]
    ], colWidths=[7.5*cm, 10.0*cm])
    charts_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(charts_table)
    story.append(Spacer(1, 10))

    # =========================================================================
    # PONTOS FORTES E PONTOS FRACOS
    # =========================================================================
    story.append(Paragraph("2. Pontos Fortes e Pontos Fracos Centrais", h1))

    fortes_text = """
    <b>Principais Pontos Fortes Verificados (Evidências de Conformidade):</b>
    <br/>• <b>Criptografia Robusta de Senhas (api/auth.ts:15-39):</b> O algoritmo utilizado para armazenar senhas legítimas é o <code>scryptSync</code> com 16 bytes de salt aleatório criptográfico e comparação em tempo constante (<code>timingSafeEqual</code>), prevenindo ataques de dicionário e de temporização (timing attacks).
    <br/>• <b>Defesa em Profundidade nos Handlers Privilegiados (api/admin.ts):</b> Todos os 14 procedimentos administrativos invocam explicitamente a função <code>requireAdmin(ctx.req)</code> antes de qualquer operação em banco ou arquivo.
    <br/>• <b>Proteção Contra Injeção SQL:</b> O uso sistemático do Drizzle ORM garante parametrização nativa e impede injeções SQL clássicas.
    <br/>• <b>Headers de Segurança HTTP (api/boot.ts:14-22):</b> O middleware <code>secureHeaders</code> configura HSTS de 1 ano, bloqueio de MIME sniffing (<code>nosniff</code>) e proteção anti-clickjacking (<code>SAMEORIGIN</code>).
    <br/>• <b>Sanitização de Meta Tags no SSR (api/lib/vite.ts:13-20):</b> Todas as variáveis dinâmicas injetadas no HTML de SEO passam por codificação segura via <code>escapeHtml</code>.
    <br/>• <b>Validação Estrita de Dados de Entrada:</b> Esquemas Zod restringem tipos, formatos e comprimentos máximos em todas as mutações e queries.
    <br/>• <b>Rate Limiting no Login (api/boot.ts:59-99):</b> Bloqueio automático de tentativas repetidas de autenticação após 5 falhas no período de 15 minutos.
    """
    story.append(Paragraph(fortes_text, body))
    story.append(Spacer(1, 6))

    fracos_text = """
    <b>Principais Riscos e Pontos Fracos Centrais:</b>
    <br/>• <b>Bypass de Autenticação por Senha Mestra (api/auth.ts:58-61):</b> Presença de código deliberado que aceita as senhas <code>"lojinha123"</code> e <code>"admin"</code> incondicionalmente, mesmo após a troca de senha pelo operador.
    <br/>• <b>Assinatura de Tokens Forjável (api/auth.ts:7-13):</b> Fallback de chave secreta pública e hardcoded, viabilizando geração de tokens administrativos válidos sem credenciais.
    <br/>• <b>Vulnerabilidade de XSS por Esquema <i>javascript:</i> (src/lib/videoEmbed.ts:16):</b> URLs arbitrárias de vídeos são repassadas sem sanitização para links navegáveis no cliente e no painel admin.
    <br/>• <b>CORS Permissivo com Credenciais (api/boot.ts:24-33):</b> Refletor automático de qualquer origem de requisição com <code>credentials: true</code>.
    """
    story.append(Paragraph(fracos_text, body))
    story.append(PageBreak())

    # =========================================================================
    # TABELA DE ACHADOS DETALHADOS
    # =========================================================================
    story.append(Paragraph("3. Tabela de Achados Detalhados por Categoria", h1))
    story.append(Paragraph("Abaixo estão listados todos os achados com suas respectivas localizações exatas de código, gravidade e descrição técnica do risco.", body))
    story.append(Spacer(1, 8))

    findings_table_data = [
        [
            Paragraph("<b>Sev.</b>", body_bold),
            Paragraph("<b>Categoria</b>", body_bold),
            Paragraph("<b>Arquivo : Linha(s)</b>", body_bold),
            Paragraph("<b>Descrição Resumida & Risco</b>", body_bold),
        ],
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body),
            Paragraph("4. Chaves Expostas", body),
            Paragraph("<code>api/auth.ts:58-61</code>", code_snippet),
            Paragraph("<b>Backdoor de Senha Mestra:</b> O método <code>checkPassword</code> aceita <i>'lojinha123'</i> ou <i>'admin'</i> incondicionalmente, ignorando qualquer senha alterada no banco.", body),
        ],
        [
            Paragraph("<font color='#B91C1C'><b>CRÍTICA</b></font>", body),
            Paragraph("4. Chaves Expostas", body),
            Paragraph("<code>api/auth.ts:7-13</code><br/><code>api/lib/env.ts:53-55</code>", code_snippet),
            Paragraph("<b>Segredo HMAC Hardcoded:</b> Fallback público permite que qualquer atacante forje tokens administrativos válidos por 7 dias sem autenticação.", body),
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body),
            Paragraph("5. Inputs / XSS", body),
            Paragraph("<code>src/lib/videoEmbed.ts:16</code><br/><code>src/pages/Produto.tsx:451</code><br/><code>AdminProductEditor:743</code>", code_snippet),
            Paragraph("<b>XSS via Protocolo javascript:</b> Links de vídeos externos não são sanitizados contra esquemas executáveis, permitindo XSS armazenado no clique do usuário/admin.", body),
        ],
        [
            Paragraph("<font color='#EA580C'><b>ALTA</b></font>", body),
            Paragraph("2. Permissão Navegador", body),
            Paragraph("<code>api/boot.ts:24-33</code>", code_snippet),
            Paragraph("<b>CORS Excessivamente Permissivo com Credenciais:</b> <code>origin => origin || '*'</code> com <code>credentials: true</code> permite que sites de terceiros leiam dados autenticados.", body),
        ],
        [
            Paragraph("<font color='#D97706'><b>MÉDIA</b></font>", body),
            Paragraph("1. Banco Sem Tranca", body),
            Paragraph("<code>api/shop.ts:171-174</code><br/><code>db/schema.ts:57</code>", code_snippet),
            Paragraph("<b>Vazamento de Notas Internas de Estoque:</b> Query pública <code>with: { variants: true }</code> expõe o campo <code>notes</code> (detalhes privados) a visitantes anônimos.", body),
        ],
        [
            Paragraph("<font color='#D97706'><b>MÉDIA</b></font>", body),
            Paragraph("3. IDOR / Objeto", body),
            Paragraph("<code>api/erp/overrides.ts:80-87</code>", code_snippet),
            Paragraph("<b>Risco de Prototype Pollution:</b> Atribuição direta <code>all[externalId]</code> sem filtro de chaves especiais (<i>__proto__</i>, <i>constructor</i>) em overrides de produtos.", body),
        ],
        [
            Paragraph("<font color='#2563EB'><b>BAIXA</b></font>", body),
            Paragraph("1. Banco Sem Tranca", body),
            Paragraph("<code>api/boot.ts:102-121</code>", code_snippet),
            Paragraph("<b>Exposição de Metadados em /api/health:</b> Endpoint público expõe slug do ERP, status da API integrada e configuração do banco a usuários não autenticados.", body),
        ],
        [
            Paragraph("<font color='#2563EB'><b>BAIXA</b></font>", body),
            Paragraph("1. Banco Sem Tranca", body),
            Paragraph("<code>api/shop.ts:258-315</code><br/><code>api/boot.ts:64</code>", code_snippet),
            Paragraph("<b>Ausência de Rate Limiting em Avaliações:</b> A rota <code>shop.submitEvaluation</code> não possui limitação de taxa por IP, permitindo flood/DoS de registros no banco.", body),
        ],
    ]

    t_findings = Table(findings_table_data, colWidths=[2.2*cm, 3.3*cm, 3.8*cm, 7.7*cm])
    t_findings.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(COLOR_BG_LIGHT)),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor(COLOR_BORDER)),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
    ]))
    story.append(t_findings)
    story.append(PageBreak())

    # =========================================================================
    # RECOMENDAÇÕES PRIORIZADAS
    # =========================================================================
    story.append(Paragraph("4. Plano de Ação e Recomendações Priorizadas", h1))

    recs = """
    <b>[P1 - EMERGÊNCIA IMEDIATA] Eliminar Backdoor e Forçar APP_SECRET em Produção:</b>
    <br/>1. Remover as linhas 58 a 61 de <code>api/auth.ts</code> que validam estaticamente as senhas <code>"lojinha123"</code> e <code>"admin"</code>.
    <br/>2. Modificar <code>api/auth.ts</code> e <code>api/lib/env.ts</code> para que o servidor <b>aborte a inicialização imediatamente</b> com erro caso <code>process.env.APP_SECRET</code> não esteja configurado no ambiente de produção com no mínimo 32 caracteres.
    <br/><br/>
    <b>[P2 - ALTA PRIORIDADE] Neutralização de XSS e Ajuste de CORS:</b>
    <br/>3. Criar uma função utilitária de sanitização de links (ex: <code>isSafeUrl</code>) que rejeite explicitamente qualquer URL que não utilize estritamente os protocolos <code>https:</code> ou <code>http:</code> em <code>src/lib/videoEmbed.ts</code>, <code>src/pages/Produto.tsx</code> e <code>src/components/admin/AdminProductEditor.tsx</code>.
    <br/>4. Ajustar o middleware CORS em <code>api/boot.ts</code> para restringir a origem aos domínios autorizados da loja (<code>lojinhadocelular.com</code>, <code>trocafacil.lojinhadocelular.com</code>) ou desativar <code>credentials: true</code> para origens dinâmicas abertas.
    <br/><br/>
    <b>[P3 - MÉDIA PRIORIDADE] Proteção de Dados de Estoque e Prototype Pollution:</b>
    <br/>5. Modificar a query em <code>api/shop.ts</code> para selecionar apenas colunas públicas de <code>variants</code>, omitindo <code>notes</code> da visualização de clientes anônimos.
    <br/>6. Em <code>api/erp/overrides.ts</code>, adicionar validação de segurança que impeça que <code>externalId</code> coincida com <code>__proto__</code>, <code>constructor</code> ou <code>prototype</code>.
    <br/><br/>
    <b>[P4 - BAIXA PRIORIDADE] Endurecimento Operacional:</b>
    <br/>7. Proteger o endpoint <code>/api/health</code> ou filtrar dados de infraestrutura (slug do ERP).
    <br/>8. Adicionar rate limiter ao endpoint <code>shop.submitEvaluation</code> (ex: máximo de 5 envios por hora por IP).
    """
    story.append(Paragraph(recs, body))
    story.append(PageBreak())

    # =========================================================================
    # ISSUES PARA O GITHUB
    # =========================================================================
    story.append(Paragraph("5. Issues Acionáveis para o GitHub", h1))
    story.append(Paragraph(
        "Copie e cole os blocos formatados abaixo diretamente no GitHub Issues do repositório para distribuir as tarefas de correção com critérios de aceite verificáveis.",
        body
    ))
    story.append(Spacer(1, 8))

    issues_data = [
        ("ISSUE 1", "[Segurança] Remoção de backdoor de senha mestra e imposição de APP_SECRET em produção", "security, bug, p1-critica", """
### Descrição do Problema
O backend contém duas vulnerabilidades críticas encadeadas no mecanismo de autenticação:
1. Em `api/auth.ts` (linhas 58-61), o método `checkPassword` aceita as senhas fixas `"lojinha123"` ou `"admin"` incondicionalmente, mesmo se o administrador já tiver alterado a senha no painel.
2. Em `api/auth.ts` (linhas 7-13) e `api/lib/env.ts` (linhas 53-55), a chave de assinatura dos tokens HMAC possui fallback para strings públicas hardcoded no código. Sem `APP_SECRET` no `.env`, qualquer usuário pode forjar tokens de admin.

### Evidência
```ts
// api/auth.ts (linhas 58-61)
if (inputStr === "lojinha123" || inputStr === "admin") {
  return true;
}

// api/auth.ts (linhas 7-13)
return s || "lojinha-secret-key-32-chars-min-prod-safe";
```

### Impacto
Comprometimento total do painel de administração sem necessidade de autenticação válida. Invasores podem alterar preços, estoque, ler avaliações de clientes e modificar configurações da loja.

### Sugestão de Correção
- Excluir a verificação estática de `"lojinha123"` e `"admin"` em `api/auth.ts`.
- Lançar exceção no boot se `NODE_ENV === "production"` e `APP_SECRET` estiver vazio ou for menor que 32 caracteres.

### Critérios de Aceite
- [ ] Tentativa de login com "admin" ou "lojinha123" falha com 401 se a senha do banco for diferente.
- [ ] O servidor recusa iniciar em produção sem `APP_SECRET` configurado.
- [ ] Testes automatizados cobrem a rejeição de senhas incorretas e validação de `APP_SECRET`.
"""),
        ("ISSUE 2", "[Segurança] Sanitização de URLs de vídeo externo contra XSS (javascript:)", "security, bug, p2-alta", """
### Descrição do Problema
A função `getVideoEmbed` (`src/lib/videoEmbed.ts`) aceita qualquer URL sem validar o protocolo. URLs com esquema `javascript:` são renderizadas em tags `<a>` no frontend do cliente (`src/pages/Produto.tsx:451`) e no painel administrativo (`src/components/admin/AdminProductEditor.tsx:743`).

### Evidência
```tsx
// src/pages/Produto.tsx (linha 451)
<a href={videoEmbed.src} target="_blank" rel="noreferrer">
  Assistir vídeo externo
</a>
```

### Impacto
Execução de scripts maliciosos no navegador de visitantes ou administradores ao clicarem no botão de vídeo.

### Sugestão de Correção
- Validar se a URL inicia estritamente com `https://` ou `http://`.
- Caso contrário, retornar `null` ou desativar o link.

### Critérios de Aceite
- [ ] URLs com prefixo `javascript:`, `data:` ou outros esquemas perigosos são bloqueadas.
- [ ] O botão de vídeo externo só é renderizado para URLs HTTP/HTTPS válidas.
"""),
        ("ISSUE 3", "[Segurança] Restrição de política de CORS em /api/*", "security, p2-alta", """
### Descrição do Problema
O middleware de CORS em `api/boot.ts` (linhas 24-33) reflete qualquer origem recebida na requisição (`origin => origin || "*"`) e habilita `credentials: true`.

### Evidência
```ts
// api/boot.ts (linhas 27-32)
cors({
  origin: origin => origin || "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
})
```

### Impacto
Sites de terceiros podem induzir o navegador de um administrador autenticado a realizar requisições cross-origin para a API e ler respostas sensíveis.

### Sugestão de Correção
Restringir as origens permitidas a uma lista explícita dos domínios da loja (`lojinhadocelular.com`, `trocafacil.lojinhadocelular.com` e `localhost` em desenvolvimento).

### Critérios de Aceite
- [ ] Requisições com cabeçalho `Origin` não autorizado recebem bloqueio de CORS.
- [ ] Requisições do domínio oficial continuam operando normalmente.
"""),
        ("ISSUE 4", "[Segurança] Ocultação de notas internas de estoque e proteção contra Prototype Pollution", "security, p3-media", """
### Descrição do Problema
1. Em `api/shop.ts`, a consulta pública de produtos busca `with: { variants: true }`, vazando a coluna `notes` da tabela `variants` (observações internas de avarias ou custo).
2. Em `api/erp/overrides.ts`, a função `saveErpOverride` indexa o objeto global com `externalId` sem filtrar chaves reservadas como `__proto__`.

### Evidência
```ts
// api/shop.ts (linha 173)
with: { variants: true }

// api/erp/overrides.ts (linha 83)
all[externalId] = { ...current, ...data };
```

### Impacto
Vazamento de dados operacionais e risco de poluição de protótipo no runtime do Node.js.

### Sugestão de Correção
- Definir projection explícita nas variantes em `api/shop.ts` (omitindo `notes`).
- Validar `externalId` em `saveErpOverride` rejeitando `__proto__`, `constructor` e `prototype`.

### Critérios de Aceite
- [ ] O campo `notes` não aparece no JSON público de `/api/trpc/shop.products`.
- [ ] Chamada com `externalId: "__proto__"` é rejeitada com erro de validação.
""")
    ]

    for tag, title, labels, md_content in issues_data:
        p_tag = Paragraph(f"<b>--- {tag} ---</b>", ParagraphStyle("IssueTag", parent=body, textColor=colors.HexColor(COLOR_CRITICA), fontName="Helvetica-Bold", fontSize=9))
        p_title = Paragraph(f"<b>Título:</b> {title}", body_bold)
        p_labels = Paragraph(f"<b>Labels:</b> <code>{labels}</code>", body)
        
        formatted_html = format_issue_md(md_content.strip())
        p_issue_box = Table(
            [[Paragraph(f"<font size=7.5>{formatted_html}</font>", ParagraphStyle("IssueP", fontName="Courier", fontSize=7.5, leading=10, textColor=colors.HexColor("#1E293B")))]],
            colWidths=[17.0 * cm]
        )
        p_issue_box.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(COLOR_BG_LIGHT)),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor(COLOR_BORDER)),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ]))
        p_end = Paragraph(f"<b>--- FIM {tag} ---</b>", ParagraphStyle("IssueEnd", parent=body, textColor=colors.HexColor(COLOR_MUTED), fontSize=8, spaceAfter=10))

        story.append(KeepTogether([
            p_tag,
            p_title,
            p_labels,
            Spacer(1, 4),
            p_issue_box,
            Spacer(1, 4),
            p_end,
            Spacer(1, 8),
        ]))

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Relatório PDF gerado com sucesso em: {OUTPUT_PDF}")

if __name__ == "__main__":
    build_pdf()
