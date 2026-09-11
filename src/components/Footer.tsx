import { Link } from "react-router";
import { MapPin, Phone, Clock, Instagram, MessageCircle } from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";

export default function Footer() {
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";

  return (
    <footer className="bg-white border-t border-neutral-200/70 text-neutral-600 py-14">
      <div className="mx-auto max-w-6xl px-4">
        {/* Grid de 4 colunas em estilo Apple Clean */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coluna 1: Logo e propósito */}
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/images/logo-icon.png"
                alt="Lojinha do Celular"
                className="h-9 w-auto object-contain"
              />
              <div className="leading-tight">
                <span className="block font-display text-base font-black tracking-tight text-neutral-950 uppercase">
                  Lojinha do Celular
                </span>
                <span className="block -mt-1 font-display text-[11px] font-semibold text-neutral-400">
                  iPhones & Acessórios
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-neutral-500">
              iPhones, Apple Watch, iPad e acessórios — Lacrados e Seminovos, com garantia e procedência verificada.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-neutral-700">
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                🛡️ Garantia & Procedência
              </span>
              <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1">
                🇺🇸 Importados EUA
              </span>
            </div>
          </div>

          {/* Coluna 2: Unidade Jardim-MS */}
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-neutral-900">
              Unidade Jardim / MS
            </h4>
            <ul className="mt-4 space-y-3 text-xs text-neutral-600">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                {s.mapsJardim ? (
                  <a
                    href={s.mapsJardim}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-black transition"
                  >
                    {s.addressJardim || "Av. Duque de Caxias, 486 - Centro, Jardim/MS"}
                  </a>
                ) : (
                  <span>{s.addressJardim || "Av. Duque de Caxias, 486 - Centro, Jardim/MS"}</span>
                )}
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                <a
                  href={waLink(s.whatsappJardim || "5567992086012", "Olá! Gostaria de falar com a Unidade Jardim.")}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-black transition font-medium"
                >
                  (67) 99208-6012
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div>
                  <p>Segunda a Sexta: 07h30 às 18h</p>
                  <p className="text-neutral-400">Sábado: 07h30 às 12h</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Unidade Guia Lopes da Laguna */}
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-neutral-900">
              Unidade Guia Lopes / MS
            </h4>
            <ul className="mt-4 space-y-3 text-xs text-neutral-600">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                {s.mapsGll ? (
                  <a
                    href={s.mapsGll}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-black transition"
                  >
                    {s.addressGll || "Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS"}
                  </a>
                ) : (
                  <span>{s.addressGll || "Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS"}</span>
                )}
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-neutral-400" />
                <a
                  href={waLink(s.whatsappGll || "5567998206533", "Olá! Gostaria de falar com a Unidade Guia Lopes.")}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-black transition font-medium"
                >
                  (67) 99820-6533
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div>
                  <p>Segunda a Sexta: 07h30 às 18h</p>
                  <p className="text-neutral-400">Sábado: 07h30 às 12h</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Redes Sociais e Links Úteis */}
          <div>
            <h4 className="font-display text-xs font-bold uppercase tracking-wider text-neutral-900">
              Sobre a Loja
            </h4>
            <div className="mt-4 flex flex-col gap-2.5 text-xs">
              <a
                href="https://instagram.com/lojinhadocelular"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition"
              >
                <Instagram className="h-4 w-4 text-neutral-400" />
                <span>Instagram (@lojinhadocelular)</span>
              </a>
              <a
                href={waLink(whatsapp, "Olá! Vim pelo site da Lojinha do Celular.")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition"
              >
                <MessageCircle className="h-4 w-4 text-neutral-400" />
                <span>Atendimento no WhatsApp</span>
              </a>
              <Link
                to="/#vitrine"
                className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition"
              >
                <span>Vitrine de Aparelhos</span>
              </Link>
              <a
                href="https://trocafacil.lojinhadocelular.com"
                className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition"
              >
                <span>Avaliar meu iPhone (Troca)</span>
              </a>
              <Link
                to="/#servicos"
                className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition"
              >
                <span>Assistência Técnica</span>
              </Link>
              <Link
                to="/privacidade"
                className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition"
              >
                <span>Privacidade & LGPD</span>
              </Link>
              <Link
                to="/privacidade#cookies"
                className="inline-flex items-center gap-2 text-neutral-600 hover:text-black transition"
              >
                <span>Política de Cookies</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Rodapé inferior com copyright, CNPJ, links de transparência e LGPD */}
        <div className="mt-12 border-t border-neutral-100 pt-8 text-center text-xs text-neutral-400">
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-neutral-500 mb-3">
            <Link
              to="/privacidade"
              className="hover:text-black transition underline-offset-4 hover:underline"
            >
              Termos de Privacidade & LGPD
            </Link>
            <span>•</span>
            <Link
              to="/privacidade#cookies"
              className="hover:text-black transition underline-offset-4 hover:underline"
            >
              Política de Cookies
            </Link>
            <span>•</span>
            <Link
              to="/avaliacao"
              className="hover:text-black transition underline-offset-4 hover:underline"
            >
              Avaliação de iPhone (Troca Fácil)
            </Link>
          </div>
          <p className="font-semibold text-neutral-700">
            © {new Date().getFullYear()} Lojinha do Celular. Todos os direitos reservados. CNPJ: 61.874.839/0001-43 • Telefone: (67) 99208-6012.
          </p>
          <p className="mx-auto mt-1 max-w-3xl text-[11px] leading-relaxed text-neutral-500">
            Garantia de até 1 ano e procedência verificada. Atendimento presencial em Jardim-MS e Guia Lopes da Laguna-MS.
          </p>

          {/* SEO Local & Marcas em Destaque para Ranqueamento no Google */}
          <div className="mx-auto mt-4 max-w-4xl border-t border-neutral-100/80 pt-4 text-[11px] leading-relaxed text-neutral-400">
            <p className="font-semibold text-neutral-600 mb-1">
              Loja de Celular, Loja de Conserto e Assistência Técnica Especializada em Jardim e Região
            </p>
            <p className="text-neutral-400">
              <b>Aparelhos:</b> iPhone Lacrado, iPhone Seminovo, Celulares Xiaomi, Redmi, POCO, Samsung Galaxy, Realme, iPad e Apple Watch.
              <br />
              <b>Loja de Conserto & Assistência Técnica:</b> Troca de tela na hora, troca de bateria, reparo em placa, conector de carga e manutenção de celulares.
              <br />
              <b>Acessórios de Celular:</b> Carregador original, cabos USB-C e Lightning homologados, películas 3D e capas de alta proteção.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
