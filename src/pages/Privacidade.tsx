import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  ShieldCheck,
  Lock,
  FileText,
  Cookie,
  Smartphone,
  CheckCircle2,
  HelpCircle,
  ChevronRight,
  ArrowLeft,
  Eye,
  UserCheck,
  Building2,
  Calendar,
} from "lucide-react";
import SEO from "@/components/SEO";
import { useShopSettings, waLink } from "@/lib/shop";
import { WhatsAppIcon } from "@/components/WhatsAppModal";

export default function Privacidade() {
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";
  const [activeSection, setActiveSection] = useState<string>("controlador");

  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "controlador",
        "principios",
        "dados-coletados",
        "trade-in",
        "cookies",
        "compartilhamento",
        "seguranca",
        "direitos",
        "dpo-contato",
      ];
      const scrollPosition = window.scrollY + 200;

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const navItems = [
    { id: "controlador", label: "1. Quem Somos & Controlador" },
    { id: "principios", label: "2. Compromisso com a LGPD" },
    { id: "dados-coletados", label: "3. Dados Coletados" },
    { id: "trade-in", label: "4. Avaliação de iPhone (Troca)" },
    { id: "cookies", label: "5. Política de Cookies" },
    { id: "compartilhamento", label: "6. Não Compartilhamento" },
    { id: "seguranca", label: "7. Segurança & Armazenamento" },
    { id: "direitos", label: "8. Seus Direitos (Art. 18 LGPD)" },
    { id: "dpo-contato", label: "9. Canal do Encarregado (DPO)" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200">
      <SEO
        title="Termos de Privacidade, LGPD & Cookies — Lojinha do Celular"
        description="Conheça nossos termos de uso, política de privacidade e proteção de dados em conformidade com a LGPD (Lei nº 13.709/2018) na Lojinha do Celular."
        url="https://lojinhadocelular.com/privacidade"
      />

      {/* Hero Header Institucional */}
      <div className="border-b border-white/10 bg-gradient-to-b from-[#141414] to-[#0a0a0a] pt-12 pb-16 px-4">
        <div className="mx-auto max-w-5xl">
          {/* Breadcrumb e retorno rápido */}
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-6">
            <Link to="/" className="hover:text-white transition flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Início
            </Link>
            <span>/</span>
            <span className="text-neutral-200">Termos & Privacidade</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> LGPD Compliant • Lei nº 13.709/2018
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-neutral-400">
              <Calendar className="h-3.5 w-3.5" /> Atualizado em Setembro de 2026
            </span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-white">
            Termos de Uso, Política de Privacidade e Cookies
          </h1>
          <p className="mt-4 max-w-3xl text-sm sm:text-base leading-relaxed text-neutral-400">
            A <b>Lojinha do Celular</b> tem o compromisso inegociável de proteger sua privacidade e
            garantir transparência total sobre como tratamos seus dados pessoais em nossas lojas
            físicas, no catálogo online e na ferramenta de avaliação de iPhones.
          </p>
        </div>
      </div>

      {/* Conteúdo Principal com Layout em 2 Colunas no Desktop */}
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 items-start">
          {/* Navegação Fixa Lateral (Table of Contents) */}
          <aside className="lg:col-span-4 sticky top-24 hidden lg:block">
            <div className="rounded-2xl border border-white/10 bg-[#141414]/80 p-5 backdrop-blur-md">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                Navegação Rápida
              </p>
              <nav className="space-y-1 text-xs">
                {navItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollTo(item.id)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left font-medium transition cursor-pointer ${
                      activeSection === item.id
                        ? "bg-white text-black font-semibold shadow-sm"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span>{item.label}</span>
                    <ChevronRight className="h-3 w-3 opacity-60" />
                  </button>
                ))}
              </nav>

              <div className="mt-6 border-t border-white/10 pt-4">
                <a
                  href={waLink(
                    whatsapp,
                    "Olá! Gostaria de tirar uma dúvida sobre privacidade e LGPD na Lojinha do Celular."
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 py-2.5 px-3 text-xs font-semibold text-[#25D366] hover:bg-[#25D366]/20 transition"
                >
                  <WhatsAppIcon className="h-4 w-4" /> Dúvidas com o DPO
                </a>
              </div>
            </div>
          </aside>

          {/* Artigos e Seções Legais */}
          <main className="lg:col-span-8 space-y-12 leading-relaxed text-neutral-300">
            {/* 1. QUEM SOMOS E CONTROLADOR */}
            <section id="controlador" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <Building2 className="h-5 w-5 text-neutral-400" />
                <h2>1. Quem Somos & Controlador dos Dados</h2>
              </div>
              <p className="text-sm">
                O presente documento regula os serviços prestados pela <b>Lojinha do Celular</b>, pessoa
                jurídica de direito privado, inscrita sob o CNPJ <b>43.120.914/0001-45</b>, com unidades
                físicas de atendimento situadas em:
              </p>
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
                  <span className="font-semibold text-white block">📍 Unidade Jardim / MS</span>
                  <p className="mt-1 text-neutral-400">
                    Av. Duque de Caxias, 486 - Centro, Jardim/MS - CEP 79240-000
                  </p>
                  <p className="mt-2 font-medium text-neutral-300">WhatsApp: (67) 99208-6012</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
                  <span className="font-semibold text-white block">📍 Unidade Guia Lopes / MS</span>
                  <p className="mt-1 text-neutral-400">
                    Rua Macias Barbosa, 2185 - Centro, Guia Lopes da Laguna/MS - CEP 79230-000
                  </p>
                  <p className="mt-2 font-medium text-neutral-300">WhatsApp: (67) 99820-6533</p>
                </div>
              </div>
              <p className="text-xs text-neutral-400">
                Para fins da Lei Geral de Proteção de Dados Pessoais (LGPD - Lei Federal nº 13.709/2018), a
                Lojinha do Celular atua como <b>Controladora</b> dos dados pessoais tratados no âmbito
                deste site e nos canais digitais de atendimento.
              </p>
            </section>

            {/* 2. PRINCÍPIOS E COMPROMISSO */}
            <section id="principios" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h2>2. Nossos Princípios sob a LGPD</h2>
              </div>
              <p className="text-sm">
                Tratamos seus dados com base na boa-fé e nos princípios fundamentais previstos no artigo
                6º da LGPD:
              </p>
              <ul className="grid sm:grid-cols-2 gap-3 text-xs">
                <li className="rounded-xl border border-white/10 bg-[#141414] p-3.5">
                  <b className="text-white block mb-1">🎯 Finalidade & Adequação</b>
                  Coletamos apenas dados estritamente compatíveis e necessários para avaliar seu iPhone,
                  atender seus pedidos e responder suas mensagens.
                </li>
                <li className="rounded-xl border border-white/10 bg-[#141414] p-3.5">
                  <b className="text-white block mb-1">🛡️ Segurança & Prevenção</b>
                  Adotamos medidas técnicas de segurança da informação (HTTPS/TLS, criptografia e
                  controle de acesso) para proteger seus dados contra acessos não autorizados.
                </li>
                <li className="rounded-xl border border-white/10 bg-[#141414] p-3.5">
                  <b className="text-white block mb-1">🚫 Não Discriminação</b>
                  Seus dados nunca serão utilizados para fins discriminatórios, abusivos ou repassados
                  a terceiros sem autorização prévia.
                </li>
                <li className="rounded-xl border border-white/10 bg-[#141414] p-3.5">
                  <b className="text-white block mb-1">🔍 Transparência & Livre Acesso</b>
                  Você pode a qualquer momento consultar quais dados mantemos, solicitar atualizações ou a
                  exclusão total de seu histórico.
                </li>
              </ul>
            </section>

            {/* 3. DADOS COLETADOS */}
            <section id="dados-coletados" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <FileText className="h-5 w-5 text-blue-400" />
                <h2>3. Quais Dados Coletamos e Para Quê?</h2>
              </div>
              <p className="text-sm">
                A coleta de dados em nossa plataforma é minimalista. Nós não exigimos cadastro complexo
                para que você navegue em nosso catálogo de iPhones:
              </p>
              <div className="space-y-3 text-xs">
                <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
                  <b className="text-white text-sm block">A. Ao navegar na vitrine e catálogo:</b>
                  <p className="mt-1 text-neutral-400">
                    Não coletamos dados de identificação pessoal. Armazenamos apenas preferências locais
                    (como produtos adicionados à sacola de compras e a sua unidade de preferência) no
                    seu próprio navegador via <code className="text-neutral-300">localStorage</code>.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
                  <b className="text-white text-sm block">B. Ao fechar pedido pelo WhatsApp:</b>
                  <p className="mt-1 text-neutral-400">
                    O site apenas gera uma mensagem pré-formatada com o modelo, capacidade, cor e valor
                    do produto para facilitar o seu contato direto com nossos consultores oficiais. Nós não
                    armazenamos dados de cartão de crédito no site.
                  </p>
                </div>
              </div>
            </section>

            {/* 4. AVALIAÇÃO DE IPHONE (TRADE-IN) */}
            <section id="trade-in" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <Smartphone className="h-5 w-5 text-amber-400" />
                <h2>4. Termos Específicos para Avaliação de iPhone (Troca Fácil)</h2>
              </div>
              <p className="text-sm">
                Ao utilizar nossa ferramenta de <b>Avaliação de iPhone</b> (acessível via{" "}
                <Link to="/avaliacao" className="text-blue-400 hover:underline">
                  /avaliacao
                </Link>{" "}
                ou no subdomínio de Troca Fácil), coletamos os seguintes dados com sua expressa ciência:
              </p>

              <div className="rounded-2xl border border-white/10 bg-[#141414] p-5 space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-white">Dados de Identificação e Contato:</b>
                    <p className="text-neutral-400">
                      Nome completo ou primeiro nome e número de telefone WhatsApp.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-white">Dados Técnicos do Dispositivo:</b>
                    <p className="text-neutral-400">
                      Modelo do iPhone, capacidade de armazenamento, saúde da porcentagem de bateria,
                      diagnóstico de componentes funcionais (Face ID, tela, câmeras, conector, etc.) e fotos
                      do aparelho enviadas voluntariamente.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-white">Finalidade Estrita:</b>
                    <p className="text-neutral-400">
                      Os dados são tratados com base no Art. 7º, inciso V da LGPD (execução de procedimentos
                      preliminares a pedido do titular) exclusivamente para estimar o valor comercial do seu
                      aparelho na troca por um novo e entrar em contato com você via WhatsApp para apresentar
                      a pré-avaliação.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-white">Caráter de Pré-avaliação:</b>
                    <p className="text-neutral-400">
                      O valor calculado pelo sistema online é uma estimativa preliminar. O valor definitivo
                      de compra ou troca só é formalizado presencialmente em nossa loja física após a
                      verificação minuciosa de autenticidade, checklist eletrônico e conferência física dos
                      itens.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. POLÍTICA DE COOKIES */}
            <section id="cookies" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <Cookie className="h-5 w-5 text-amber-500" />
                <h2>5. Política de Cookies e Armazenamento Local</h2>
              </div>
              <p className="text-sm">
                Cookies são pequenos arquivos ou fragmentos de texto enviados pelo servidor ou guardados no
                navegador para memorizar suas preferências. Nós prezamos pela sua privacidade e utilizamos
                apenas tecnologias essenciais:
              </p>

              {/* Tabela de Cookies */}
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-neutral-300">
                  <thead className="border-b border-white/10 bg-white/5 text-[11px] font-bold uppercase tracking-wider text-white">
                    <tr>
                      <th className="p-3">Nome / Chave</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">Finalidade</th>
                      <th className="p-3">Duração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-[#141414]">
                    <tr>
                      <td className="p-3 font-mono text-emerald-400">cookie_consent</td>
                      <td className="p-3">Essencial</td>
                      <td className="p-3">
                        Armazena sua confirmação de ciência da política de cookies e privacidade.
                      </td>
                      <td className="p-3 text-neutral-400">1 ano</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-emerald-400">lojinha_cart</td>
                      <td className="p-3">Essencial</td>
                      <td className="p-3">
                        Mantém os itens selecionados na sua sacola de compras durante sua sessão.
                      </td>
                      <td className="p-3 text-neutral-400">Persistente</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-emerald-400">preferred_unit</td>
                      <td className="p-3">Funcional</td>
                      <td className="p-3">
                        Lembra sua unidade de atendimento preferida (Jardim ou Guia Lopes).
                      </td>
                      <td className="p-3 text-neutral-400">Persistente</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono text-emerald-400">lojinha_evaluations_history</td>
                      <td className="p-3">Segurança</td>
                      <td className="p-3">
                        Guarda o comprovante das suas avaliações enviadas para sua própria conferência.
                      </td>
                      <td className="p-3 text-neutral-400">Local</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 text-xs text-emerald-300 flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                <span>
                  <b>Sem rastreadores invasivos de terceiros:</b> Não vendemos seus dados de navegação para
                  redes de publicidade invasiva, nem executamos rastreamento cross-site desproporcional.
                </span>
              </div>
            </section>

            {/* 6. NÃO COMPARTILHAMENTO */}
            <section id="compartilhamento" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <Lock className="h-5 w-5 text-purple-400" />
                <h2>6. Não Compartilhamento e Não Comercialização de Dados</h2>
              </div>
              <p className="text-sm">
                A <b>Lojinha do Celular não vende, não aluga e não compartilha</b> listas de contatos,
                números de telefone ou dados de clientes com empresas de telemarketing, birôs de dados ou
                terceiros estranhos à nossa operação.
              </p>
              <p className="text-xs text-neutral-400">
                Seus dados serão compartilhados única e exclusivamente quando estritamente exigido por lei
                ou por ordem fundamentada de autoridade judicial ou policial competente, nos exatos termos
                da legislação brasileira.
              </p>
            </section>

            {/* 7. SEGURANÇA E ARMAZENAMENTO */}
            <section id="seguranca" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <Eye className="h-5 w-5 text-cyan-400" />
                <h2>7. Armazenamento Seguro e Tempo de Guarda</h2>
              </div>
              <p className="text-sm">
                Implementamos padrões reconhecidos de segurança cibernética para garantir a confidencialidade
                dos seus dados:
              </p>
              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-white/10 bg-[#141414] p-4 text-center">
                  <span className="text-2xl block mb-2">🔒</span>
                  <b className="text-white block">Criptografia SSL/TLS</b>
                  <p className="mt-1 text-neutral-400">
                    Toda comunicação entre seu celular e nosso servidor trafega com HTTPS e certificado digital.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#141414] p-4 text-center">
                  <span className="text-2xl block mb-2">🛡️</span>
                  <b className="text-white block">Acesso Restrito</b>
                  <p className="mt-1 text-neutral-400">
                    Apenas os técnicos autorizados têm acesso às propostas de avaliação para resposta.
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#141414] p-4 text-center">
                  <span className="text-2xl block mb-2">⏱️</span>
                  <b className="text-white block">Descarte Seguro</b>
                  <p className="mt-1 text-neutral-400">
                    Avaliações não concretizadas são arquivadas e expurgadas periodicamente sem reuso.
                  </p>
                </div>
              </div>
            </section>

            {/* 8. DIREITOS DO TITULAR (ART. 18 LGPD) */}
            <section id="direitos" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <UserCheck className="h-5 w-5 text-emerald-400" />
                <h2>8. Seus Direitos como Titular de Dados (Art. 18 LGPD)</h2>
              </div>
              <p className="text-sm">
                Conforme o artigo 18 da Lei Federal nº 13.709/2018, você possui direitos assegurados que
                podem ser exercidos a qualquer momento mediante solicitação gratuita:
              </p>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#141414] p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    <b>Confirmação e Acesso:</b> Saber se tratamos dados seus e solicitar cópia integral
                    desses registros.
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#141414] p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    <b>Correção e Retificação:</b> Solicitar a correção imediata de dados incompletos,
                    inexatos ou desatualizados.
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#141414] p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    <b>Eliminação dos Dados:</b> Requerer a exclusão definitiva dos dados coletados sob seu
                    consentimento.
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#141414] p-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    <b>Revogação do Consentimento:</b> Desautorizar a continuidade do contato via WhatsApp a
                    qualquer tempo.
                  </span>
                </div>
              </div>
            </section>

            {/* 9. CANAL DO DPO / ENCARREGADO */}
            <section id="dpo-contato" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-2 text-white font-display text-xl font-bold">
                <HelpCircle className="h-5 w-5 text-[#25D366]" />
                <h2>9. Canal de Atendimento do Encarregado de Dados (DPO)</h2>
              </div>
              <p className="text-sm">
                Para exercer qualquer um dos seus direitos previstos na LGPD, esclarecer dúvidas ou
                solicitar o cancelamento de mensagens, entre em contato diretamente com nossa equipe de
                privacidade:
              </p>

              <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#141414] to-[#1c1c1f] p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#25D366]/20 text-[#25D366]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      Encarregado de Proteção de Dados (DPO)
                    </h3>
                    <p className="text-xs text-neutral-400">Lojinha do Celular • Gestão de Privacidade</p>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs pt-2">
                  <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                    <span className="text-neutral-400 block mb-1 font-medium">Canal Ágil via WhatsApp:</span>
                    <a
                      href={waLink(
                        whatsapp,
                        "Olá! Gostaria de falar com o Encarregado de Dados (DPO) sobre a minha privacidade na Lojinha do Celular."
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-bold text-[#25D366] hover:underline"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5" /> Chamar Encarregado LGPD
                    </a>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                    <span className="text-neutral-400 block mb-1 font-medium">Atendimento Presencial:</span>
                    <span className="text-white font-semibold">
                      Unidades Jardim e Guia Lopes da Laguna - MS
                    </span>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-neutral-400 pt-2 border-t border-white/10">
                  Todas as solicitações de titulares serão analisadas e respondidas com agilidade dentro dos
                  prazos estipulados pela Autoridade Nacional de Proteção de Dados (ANPD).
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
