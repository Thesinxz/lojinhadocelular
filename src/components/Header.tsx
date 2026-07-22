import { useState } from "react";
import { Link, useLocation } from "react-router";
import { Menu, X, Smartphone } from "lucide-react";

const NAV = [
  { to: "/", label: "Início" },
  { to: "/catalogo", label: "Catálogo" },
  { to: "/#sobre", label: "Sobre" },
  { to: "/#unidades", label: "Unidades" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-brand border-b-4 border-ink">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <img src="/images/logo-icon.png" alt="Lojinha do Celular" className="h-12 w-auto object-contain" />
            <div className="leading-tight">
              <span className="block font-display text-lg font-bold text-ink">Lojinha</span>
              <span className="block -mt-1 font-display text-sm font-semibold text-ink/70">do Celular</span>
            </div>
          </Link>

          {/* Desktop */}
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`rounded-full px-4 py-2 text-sm font-semibold text-ink transition hover:bg-ink hover:text-brand ${
                  location.pathname === item.to ? "bg-ink text-brand" : ""
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button
            className="rounded-lg border-2 border-ink p-2 text-ink md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Abrir menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <nav className="border-t-2 border-ink bg-brand px-4 pb-4 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 border-b border-ink/10 py-3 font-semibold text-ink"
            >
              <Smartphone className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
