import { Link } from "react-router";
import { MapPin, MessageCircle, Wrench } from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";

export default function Footer() {
  const s = useShopSettings();
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand">
                <img src="/images/logo-icon.png" alt="Lojinha do Celular" className="h-11 w-auto object-contain" />
              </span>
              <div className="leading-tight">
                <span className="block font-display text-lg font-bold text-white">Lojinha</span>
                <span className="block -mt-1 font-display text-sm font-semibold text-brand">do Celular</span>
              </div>
            </div>
            <p className="text-sm text-white/70">
              iPhones lacrados e seminovos importados dos EUA com 1 ano de garantia.
              Xiaomi, Realme, Tecno e assistência técnica especializada.
            </p>
          </div>

          <div>
            <h4 className="mb-3 font-display font-bold text-brand">Unidades</h4>
            <ul className="space-y-3 text-sm text-white/80">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <a href={s.mapsJardim} target="_blank" rel="noreferrer" className="hover:text-brand">
                  {s.addressJardim}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <a href={s.mapsGll} target="_blank" rel="noreferrer" className="hover:text-brand">
                  {s.addressGll}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 font-display font-bold text-brand">Fale com a gente</h4>
            <div className="space-y-2">
              <a
                href={waLink(s.whatsappJardim, "Olá! Vim pelo site e quero mais informações.")}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp — Jardim
              </a>
              <a
                href={waLink(s.whatsappGll, "Olá! Vim pelo site e quero mais informações.")}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-ink transition hover:brightness-110"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp — Guia Lopes
              </a>
              <Link
                to="/catalogo"
                className="flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:border-brand hover:text-brand"
              >
                <Wrench className="h-4 w-4" /> Ver catálogo completo
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-6 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Lojinha do Celular — Reparos e Acessórios. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
