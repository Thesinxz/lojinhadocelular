import { Link } from "react-router";
import { MapPin, Phone, Clock, Instagram, MessageCircle } from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";

export default function Footer() {
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";

  return (
    <footer className="bg-[#050505] border-t border-white/10 text-neutral-400 py-12">
      <div className="mx-auto max-w-6xl px-4">
        {/* Grid de 4 colunas em estilo Apple */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coluna 1: Logo e propósito */}
          <div>
            <div className="flex items-center gap-2.5">
              <img
                src="/images/logo-icon.png"
                alt="Lojinha do Celular"
                className="h-10 w-auto object-contain"
              />
              <div className="leading-tight">
                <span className="block font-display text-lg font-bold tracking-tight text-white">
                  Lojinha
                </span>
                <span className="block -mt-1 font-display text-xs font-semibold text-neutral-400">
                  do Celular
                </span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-neutral-400">
              Especialistas em iPhones novos e seminovos importados dos EUA, com procedência rigorosa, garantia de 1 ano e assistência técnica especializada em Mato Grosso do Sul.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-neutral-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                🛡️ 1 Ano de Garantia
              </span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                🇺🇸 Procedência EUA
              </span>
            </div>
          </div>

          {/* Coluna 2: Unidade Jardim-MS */}
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
              Unidade Jardim-MS
            </h4>
            <ul className="mt-4 space-y-3 text-xs text-neutral-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                {s.mapsJardim ? (
                  <a
                    href={s.mapsJardim}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition"
                  >
                    {s.addressJardim || "Av. Duque de Caxias, 486 - Centro, Jardim/MS"}
                  </a>
                ) : (
                  <span>{s.addressJardim || "Av. Duque de Caxias, 486 - Centro, Jardim/MS"}</span>
                )}
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-neutral-300" />
                <a
                  href={waLink(s.whatsappJardim || "5567992086012", "Olá! Gostaria de falar com a Unidade Jardim.")}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition"
                >
                  (67) 99208-6012
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                <div>
                  <p>Segunda a Sexta: 07h30 às 18h</p>
                  <p className="text-neutral-500">Sábado: 07h30 às 12h</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Unidade Guia Lopes da Laguna */}
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
              Unidade Guia Lopes
            </h4>
            <ul className="mt-4 space-y-3 text-xs text-neutral-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                {s.mapsGll ? (
                  <a
                    href={s.mapsGll}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition"
                  >
                    {s.addressGll || "Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS"}
                  </a>
                ) : (
                  <span>{s.addressGll || "Rua Macias Barbosa, 2185 - Guia Lopes da Laguna/MS"}</span>
                )}
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-neutral-300" />
                <a
                  href={waLink(s.whatsappGll || "5567998206533", "Olá! Gostaria de falar com a Unidade Guia Lopes.")}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-white transition"
                >
                  (67) 99820-6533
                </a>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                <div>
                  <p>Segunda a Sexta: 07h30 às 18h</p>
                  <p className="text-neutral-500">Sábado: 07h30 às 12h</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Redes Sociais e Links Úteis */}
          <div>
            <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-white">
              Redes & Navegação
            </h4>
            <div className="mt-4 flex flex-col gap-2.5 text-xs">
              <a
                href="https://instagram.com/lojinhadocelular"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition"
              >
                <Instagram className="h-4 w-4 text-neutral-300" />
                <span>Instagram (@lojinhadocelular)</span>
              </a>
              <a
                href={waLink(whatsapp, "Olá! Vim pelo site da Lojinha do Celular.")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition"
              >
                <MessageCircle className="h-4 w-4 text-neutral-300" />
                <span>Atendimento no WhatsApp</span>
              </a>
              <Link
                to="/#vitrine"
                className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition"
              >
                <span>Vitrine de Aparelhos</span>
              </Link>
              <Link
                to="/avaliacao"
                className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition"
              >
                <span>Avaliar Aparelho (Troca)</span>
              </Link>
              <Link
                to="/#servicos"
                className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition"
              >
                <span>Assistência Técnica</span>
              </Link>
              <Link
                to="/#unidades"
                className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition"
              >
                <span>Nossas Lojas Físicas</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Rodapé inferior com copyright, CNPJ e nota de transparência */}
        <div className="mt-12 border-t border-white/10 pt-8 text-center text-xs text-neutral-500">
          <p className="font-medium text-neutral-400">
            © {new Date().getFullYear()} Lojinha do Celular — Reparos e Acessórios. Todos os direitos reservados. CNPJ: 43.120.914/0001-45.
          </p>
          <p className="mx-auto mt-2 max-w-3xl text-[11px] leading-relaxed text-neutral-500">
            Nota de transparência: A Lojinha do Celular é uma revenda e assistência técnica independente multimarca, sem vínculo societário ou representação oficial direta com a Apple Inc. Todos os aparelhos comercializados são originais com procedência garantida e possuem termo de garantia própria da nossa loja de até 1 ano.
          </p>
        </div>
      </div>
    </footer>
  );
}
