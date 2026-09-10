import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X, MessageCircle } from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";

const NAV = [
  { to: "/#vitrine", label: "Vitrine" },
  { to: "/avaliacao", label: "Avaliar Aparelho" },
  { to: "/#servicos", label: "Assistência" },
  { to: "/#unidades", label: "Unidades" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";

  const handleNavClick = (to: string) => {
    setOpen(false);
    if (to.startsWith("/#") && location.pathname === "/") {
      const id = to.slice(2);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo & Nome */}
          <Link
            to="/"
            className="flex items-center gap-2.5 transition opacity-90 hover:opacity-100"
            onClick={() => setOpen(false)}
          >
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
          </Link>

          {/* Desktop Navigation & WhatsApp CTA */}
          <div className="hidden items-center gap-6 md:flex">
            <nav className="flex items-center gap-6">
              {NAV.map(item => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => handleNavClick(item.to)}
                  className="text-sm font-medium text-neutral-300 hover:text-white transition"
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <a
              href={waLink(whatsapp, "Olá! Vim pelo site da Lojinha do Celular.")}
              target="_blank"
              rel="noreferrer"
              className="bg-[#25D366] hover:bg-[#20ba59] text-white rounded-full px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp</span>
            </a>
          </div>

          {/* Mobile Actions: WhatsApp Pill & Menu Toggle */}
          <div className="flex items-center gap-2 md:hidden">
            <a
              href={waLink(whatsapp, "Olá! Vim pelo site da Lojinha do Celular.")}
              target="_blank"
              rel="noreferrer"
              className="bg-[#25D366] hover:bg-[#20ba59] text-white rounded-full px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
              aria-label="Falar no WhatsApp"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>WhatsApp</span>
            </a>

            <button
              type="button"
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-neutral-300 hover:bg-white/10 hover:text-white transition"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer / Dropdown */}
      {open && (
        <nav className="border-t border-white/10 bg-[#121212] px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV.map(item => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => handleNavClick(item.to)}
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-neutral-300 hover:bg-white/5 hover:text-white transition"
              >
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-3 border-t border-white/10 pt-3">
            <a
              href={waLink(whatsapp, "Olá! Vim pelo site da Lojinha do Celular.")}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#20ba59] active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Falar no WhatsApp</span>
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
