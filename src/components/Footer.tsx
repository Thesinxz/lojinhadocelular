import { useState } from "react";
import { Link } from "react-router";
import {
  MapPin,
  Phone,
  Clock,
  Instagram,
  MessageCircle,
  ShieldCheck,
  PackageCheck,
  CreditCard,
  ChevronDown,
  Lock,
} from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";

export default function Footer() {
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";
  const [isSeoOpen, setIsSeoOpen] = useState(false);

  return (
    <footer className="bg-white border-t border-neutral-200/80 text-neutral-600">
      {/* 1. Barra Superior de Benefícios e Confiança (Trust Bar) */}
      <div className="border-b border-neutral-100 bg-[#fafafc] px-4 py-7 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* Item 1 */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-800 shadow-2xs">
                <ShieldCheck className="h-5 w-5 text-neutral-800 stroke-[1.8]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 tracking-tight">
                  Garantia de até 1 Ano
                </h4>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  Procedência 100% testada e nota fiscal emitida.
                </p>
              </div>
            </div>

            {/* Item 2 */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-800 shadow-2xs">
                <PackageCheck className="h-5 w-5 text-neutral-800 stroke-[1.8]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 tracking-tight">
                  Pronta Entrega MS
                </h4>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  Jardim, Guia Lopes e envio segurado para o estado.
                </p>
              </div>
            </div>

            {/* Item 3 */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-800 shadow-2xs">
                <CreditCard className="h-5 w-5 text-neutral-800 stroke-[1.8]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 tracking-tight">
                  Até 12x no Cartão
                </h4>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  Ou desconto especial para pagamento à vista no Pix.
                </p>
              </div>
            </div>

            {/* Item 4 */}
            <div className="flex items-start gap-3.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-800 shadow-2xs">
                <MessageCircle className="h-5 w-5 text-neutral-800 stroke-[1.8]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-neutral-900 tracking-tight">
                  Suporte Humanizado
                </h4>
                <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                  Atendimento e consultoria direta no WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Grid Central Principal em 4 Colunas */}
      <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coluna 1: Identidade, autoridade e redes */}
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/images/logo-icon.png"
                alt="Lojinha do Celular"
                className="h-9 w-auto object-contain"
              />
              <div className="leading-tight">
                <span className="block font-display text-base font-black tracking-tight text-neutral-950 uppercase">
                  Lojinha do Celular
                </span>
                <span className="block font-display text-[11px] font-semibold text-neutral-400">
                  iPhones & Acessórios Premium
                </span>
              </div>
            </div>

            <p className="mt-4 text-xs leading-relaxed text-neutral-500">
              Referência em ecossistema Apple, smartphones Android de alta performance e assistência técnica especializada no Mato Grosso do Sul.
            </p>

            {/* Badges Vetoriais Refinadas */}
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200/70 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                <ShieldCheck className="h-3.5 w-3.5 text-neutral-600" />
                Procedência Garantida
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200/70 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                <PackageCheck className="h-3.5 w-3.5 text-neutral-600" />
                Importação Direta EUA
              </span>
            </div>

            {/* Redes Sociais */}
            <div className="mt-5 flex items-center gap-2 pt-2">
              <a
                href="https://instagram.com/lojinhadocelular"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50/70 px-3 py-1.5 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <Instagram className="h-3.5 w-3.5 text-neutral-500" />
                <span>Instagram</span>
              </a>
              <a
                href={waLink(whatsapp, "Olá! Vim pelo site da Lojinha do Celular.")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50/70 px-3 py-1.5 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <MessageCircle className="h-3.5 w-3.5 text-neutral-500" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Coluna 2: Unidade Jardim-MS */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-neutral-950">
                Unidade Jardim / MS
              </h4>
              <span className="flex h-2 w-2 relative" title="Loja física ativa">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>

            <ul className="space-y-3 text-xs text-neutral-600">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div>
                  <p className="text-neutral-700 font-medium">
                    {s.addressJardim || "Av. Duque de Caxias, 486 - Centro, Jardim/MS"}
                  </p>
                  {s.mapsJardim ? (
                    <a
                      href={s.mapsJardim}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0066cc] hover:underline"
                    >
                      Como chegar (Google Maps) →
                    </a>
                  ) : (
                    <a
                      href="https://maps.google.com/?q=Av.+Duque+de+Caxias,+486,+Jardim+-+MS"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0066cc] hover:underline"
                    >
                      Como chegar (Google Maps) →
                    </a>
                  )}
                </div>
              </li>

              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                <a
                  href={waLink(s.whatsappJardim || "5567992086012", "Olá! Gostaria de falar com a Unidade Jardim.")}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-neutral-950 hover:text-[#0066cc] transition text-xs sm:text-sm"
                >
                  (67) 99208-6012
                </a>
              </li>

              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div className="text-[11px] text-neutral-500 leading-snug">
                  <p>Segunda a Sexta: 07h30 às 18h</p>
                  <p>Sábado: 07h30 às 12h</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Unidade Guia Lopes da Laguna */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-neutral-950">
                Unidade Guia Lopes / MS
              </h4>
              <span className="flex h-2 w-2 relative" title="Loja física ativa">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </div>

            <ul className="space-y-3 text-xs text-neutral-600">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div>
                  <p className="text-neutral-700 font-medium">
                    {s.addressGll || "Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS"}
                  </p>
                  {s.mapsGll ? (
                    <a
                      href={s.mapsGll}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0066cc] hover:underline"
                    >
                      Como chegar (Google Maps) →
                    </a>
                  ) : (
                    <a
                      href="https://maps.google.com/?q=Rua+Macias+Barbosa,+2185,+Guia+Lopes+da+Laguna+-+MS"
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0066cc] hover:underline"
                    >
                      Como chegar (Google Maps) →
                    </a>
                  )}
                </div>
              </li>

              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                <a
                  href={waLink(s.whatsappGll || "5567998206533", "Olá! Gostaria de falar com a Unidade Guia Lopes.")}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-neutral-950 hover:text-[#0066cc] transition text-xs sm:text-sm"
                >
                  (67) 99820-6533
                </a>
              </li>

              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div className="text-[11px] text-neutral-500 leading-snug">
                  <p>Segunda a Sexta: 07h30 às 18h</p>
                  <p>Sábado: 07h30 às 12h</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Departamentos & Links Rápidos */}
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-neutral-950 mb-3">
              Departamentos
            </h4>
            <div className="flex flex-col gap-2.5 text-xs">
              <Link
                to="/#vitrine"
                className="text-neutral-600 hover:text-neutral-950 transition font-medium"
              >
                Vitrine de Aparelhos
              </Link>
              <a
                href="https://trocafacil.lojinhadocelular.com"
                className="inline-flex items-center gap-1.5 text-neutral-900 font-semibold hover:text-[#0066cc] transition"
              >
                <span>Avaliar meu iPhone</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                  Troca Fácil
                </span>
              </a>
              <Link
                to="/#servicos"
                className="text-neutral-600 hover:text-neutral-950 transition font-medium"
              >
                Assistência Especializada
              </Link>
              <Link
                to="/privacidade"
                className="text-neutral-500 hover:text-neutral-950 transition"
              >
                Garantia & Procedência
              </Link>
              <Link
                to="/privacidade"
                className="text-neutral-500 hover:text-neutral-950 transition"
              >
                Termos de Privacidade & LGPD
              </Link>
              <Link
                to="/privacidade#cookies"
                className="text-neutral-500 hover:text-neutral-950 transition"
              >
                Política de Cookies
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Barra de Pagamento e Segurança com Asset Oficial */}
      <div className="border-t border-neutral-100 bg-[#fafafc] px-4 py-5 sm:px-8">
        <div className="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Bandeiras de Pagamento */}
          <div className="flex flex-col sm:flex-row items-center gap-3.5 text-center sm:text-left">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
              Formas de Pagamento:
            </span>
            <img
              src="/images/payment-methods.png"
              alt="Bandeiras de pagamento aceitas: Visa, Mastercard, Elo, Hipercard, American Express, Diners Club e Pix"
              className="h-7 sm:h-8 w-auto object-contain opacity-95 hover:opacity-100 transition"
            />
          </div>

          {/* Selos de Segurança e CNPJ */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-neutral-500">
            <div className="inline-flex items-center gap-1.5 font-medium text-neutral-700">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              <span>Ambiente 100% Seguro (SSL)</span>
            </div>
            <span className="text-neutral-300 hidden sm:inline">•</span>
            <span className="font-medium text-neutral-700">
              CNPJ: 61.874.839/0001-43
            </span>
          </div>
        </div>
      </div>

      {/* 4. Gaveta Retrátil de SEO Local e Cidades Atendidas */}
      <div className="border-t border-neutral-100/80 bg-[#f9f9fb] px-4 py-3.5 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <p className="text-[11px] text-neutral-500">
              Atendimento presencial em Jardim-MS e Guia Lopes da Laguna • Entrega segurada para todo o Mato Grosso do Sul
            </p>
            <button
              type="button"
              onClick={() => setIsSeoOpen(!isSeoOpen)}
              className="cursor-pointer inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600 hover:text-neutral-950 transition"
              aria-expanded={isSeoOpen}
            >
              <span>{isSeoOpen ? "Ocultar categorias de busca" : "Ver cidades atendidas e categorias de busca"}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  isSeoOpen ? "rotate-180 text-neutral-900" : ""
                }`}
              />
            </button>
          </div>

          {/* Conteúdo Retrátil de SEO Organizado */}
          {isSeoOpen && (
            <div className="mt-4 pt-4 border-t border-neutral-200/60 text-[11px] leading-relaxed text-neutral-500 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <h5 className="font-bold text-neutral-800 mb-1">
                    Aparelhos & Marcas Homologadas
                  </h5>
                  <p className="text-neutral-500">
                    iPhone Lacrado na caixa, iPhone Seminovo com bateria verificada e garantia, Celulares Xiaomi, Redmi Note, POCO gamer, Samsung Galaxy, Realme, iPad e Apple Watch.
                  </p>
                </div>
                <div>
                  <h5 className="font-bold text-neutral-800 mb-1">
                    Assistência Técnica Especializada
                  </h5>
                  <p className="text-neutral-500">
                    Laboratório próprio com troca de tela na hora, troca de bateria, reparo em placa-mãe, desoxidação, conector de carga e manutenção preventiva de celulares.
                  </p>
                </div>
                <div>
                  <h5 className="font-bold text-neutral-800 mb-1">
                    Cidades Atendidas no Mato Grosso do Sul
                  </h5>
                  <p className="text-neutral-500">
                    Pronta entrega e suporte em Jardim, Guia Lopes da Laguna, Bonito, Nioaque, Bela Vista, Porto Murtinho, Caracol, Maracaju e envio seguro para todo o MS.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Sub-footer Inferior com Copyright Oficial */}
      <div className="border-t border-neutral-200/70 bg-white py-6 px-4 text-center text-xs text-neutral-400">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-neutral-500 mb-2.5">
            <Link
              to="/privacidade"
              className="hover:text-neutral-950 transition underline-offset-4 hover:underline"
            >
              Termos de Privacidade & LGPD
            </Link>
            <span>•</span>
            <Link
              to="/privacidade#cookies"
              className="hover:text-neutral-950 transition underline-offset-4 hover:underline"
            >
              Política de Cookies
            </Link>
            <span>•</span>
            <a
              href="https://trocafacil.lojinhadocelular.com"
              className="hover:text-neutral-950 transition underline-offset-4 hover:underline"
            >
              Avaliação de iPhone (Troca Fácil)
            </a>
          </div>

          <p className="font-semibold text-neutral-700 text-xs">
            © {new Date().getFullYear()} Lojinha do Celular. Todos os direitos reservados. CNPJ: 61.874.839/0001-43 • Telefone: (67) 99208-6012.
          </p>
          <p className="mx-auto mt-1 max-w-2xl text-[11px] text-neutral-400">
            Av. Duque de Caxias, 486 - Jardim/MS • Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS
          </p>
        </div>
      </div>
    </footer>
  );
}
