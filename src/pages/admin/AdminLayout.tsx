import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router";
import {
  History,
  BarChart3,
  Bell,
  BellOff,
  BellRing,
  Eye,
  Home,
  LogOut,
  Plug,
  Menu,
  Package,
  Search,
  Settings,
  Smartphone,
  Tv,
  UserCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import AdminCommandPalette from "@/components/admin/AdminCommandPalette";
import { useNewEvaluationAlert } from "@/hooks/useNewEvaluationAlert";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { useAdminSession, useAdminUnit } from "@/lib/adminSession";
import type { UnitFilter } from "@/lib/adminSession";
import { ADMIN_ROLES, STORE_UNITS } from "@contracts/permissions";
import type { Capability } from "@contracts/permissions";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  cap?: Capability;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/admin", label: "Início", icon: Home, end: true },
  { to: "/admin/avaliacoes", label: "Avaliações", icon: Smartphone },
  { to: "/admin/produtos", label: "Produtos", icon: Package },
  { to: "/admin/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/admin/acessos", label: "Acessos", icon: Eye, cap: "settings.manage" },
  { to: "/admin/erp", label: "Integração ERP", icon: Plug, cap: "products.editMedia" },
  { to: "/admin/atividade", label: "Atividade", icon: History },
  { to: "/admin/usuarios", label: "Usuários", icon: Users, cap: "users.manage" },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings, cap: "settings.manage" },
];

const PAGE_TITLES: { prefix: string; title: string }[] = [
  { prefix: "/admin/avaliacoes", title: "Avaliações" },
  { prefix: "/admin/produtos", title: "Produtos" },
  { prefix: "/admin/relatorios", title: "Relatórios" },
  { prefix: "/admin/acessos", title: "Acessos ao site" },
  { prefix: "/admin/erp", title: "Integração ERP" },
  { prefix: "/admin/atividade", title: "Atividade" },
  { prefix: "/admin/usuarios", title: "Usuários" },
  { prefix: "/admin/configuracoes", title: "Configurações" },
  { prefix: "/admin/conta", title: "Minha conta" },
];

const UNIT_OPTIONS: { value: UnitFilter; label: string; short: string }[] = [
  { value: "todas", label: "Todas as unidades", short: "Todas" },
  { value: "jardim", label: "Jardim", short: "Jardim" },
  { value: "gll", label: "Guia Lopes da Laguna", short: "Guia Lopes" },
];

function usePageTitle(): string {
  const { pathname } = useLocation();
  return PAGE_TITLES.find((p) => pathname.startsWith(p.prefix))?.title ?? "Início";
}

function PendingBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function UnitSelect({ compact = false }: { compact?: boolean }) {
  const { unit, setUnit } = useAdminUnit();
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Filtrar por unidade</span>
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as UnitFilter)}
        className={`appearance-none rounded-xl border border-[#e5e5e7] bg-white pr-8 font-semibold text-[#1d1d1f] shadow-2xs outline-none transition hover:bg-[#f5f5f7] focus:border-[#1d1d1f] ${
          compact ? "h-10 pl-3 text-xs" : "h-10 pl-3.5 text-sm"
        }`}
      >
        {UNIT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {compact ? o.short : o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 text-[10px] text-[#86868b]">▼</span>
    </label>
  );
}

export default function AdminLayout() {
  const { user, can, logout } = useAdminSession();
  const title = usePageTitle();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { unit } = useAdminUnit();
  const summary = trpc.admin.evaluationSummary.useQuery(unit === "todas" ? undefined : { unit }, {
    enabled: !!user && can("evaluations.manage"),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
  const pending = summary.data?.pending ?? 0;
  const navigate = useNavigate();
  const browserNotifications = useBrowserNotifications(() => navigate("/admin/avaliacoes"));
  const { soundOn, toggleSound } = useNewEvaluationAlert(summary.data?.pending, (added) => {
    toast.info(added === 1 ? "Chegou uma nova avaliação!" : `Chegaram ${added} novas avaliações!`);
    browserNotifications.notifyNewEvaluations(added);
  });

  async function toggleBrowserNotifications() {
    const result = await browserNotifications.toggle();
    if (result === "denied") {
      toast.error("Avisos bloqueados neste navegador. Libere as notificações do site nas configurações (cadeado ao lado do endereço).");
    } else if (result === "on") {
      toast.success("Avisos do navegador ligados.");
    } else if (result === "off") {
      toast.info("Avisos do navegador desligados.");
    }
  }

  const items = NAV_ITEMS.filter((item) => !item.cap || can(item.cap));
  const roleLabel = ADMIN_ROLES.find((r) => r.value === user?.role)?.label ?? "";
  const unitLabel = STORE_UNITS.find((u) => u.value === user?.unit)?.label ?? "Todas as unidades";

  const sidebarLink = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${
      isActive ? "bg-[#1d1d1f] text-white shadow-xs" : "text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
    }`;

  const bottomItems = items.filter((i) => ["/admin", "/admin/avaliacoes", "/admin/produtos"].includes(i.to));
  const moreItems = items.filter((i) => !bottomItems.includes(i));
  const moreActive = moreItems.some((i) => location.pathname.startsWith(i.to)) || location.pathname.startsWith("/admin/conta");

  return (
    <div className="min-h-[100dvh] bg-[#fbfbfd] font-sans text-[#1d1d1f] antialiased">
      {/* Menu lateral (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[#e5e5e7] bg-white lg:flex">
        <Link to="/admin" className="flex items-center gap-3 px-5 py-5">
          <img src="/images/logo-icon.png" alt="" className="h-9 w-9 rounded-xl object-contain" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight">Lojinha do Celular</p>
            <p className="text-[11px] font-medium text-[#86868b]">Painel da loja</p>
          </div>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Menu do painel">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={sidebarLink}>
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
              {item.to === "/admin/avaliacoes" && <PendingBadge count={pending} />}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-1 border-t border-[#e5e5e7] p-3">
          <NavLink to="/admin/conta" className={sidebarLink}>
            <UserCircle className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate">{user?.name}</span>
              <span className="block truncate text-[11px] font-medium opacity-70">
                {roleLabel} • {unitLabel}
              </span>
            </span>
          </NavLink>
          <a
            href="/tv"
            target="_blank"
            rel="noreferrer"
            className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#6e6e73] transition hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          >
            <Tv className="h-4 w-4" /> Modo TV
          </a>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#6e6e73] transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Barra superior */}
        <header className="sticky top-0 z-20 border-b border-[#e5e5e7] bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 lg:h-16 lg:px-8">
            <h1 className="truncate font-display text-lg font-bold tracking-tight lg:text-xl">{title}</h1>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Buscar (⌘K / Ctrl+K)"
              className="ml-auto flex h-11 items-center gap-2 rounded-xl border border-[#e5e5e7] px-3 text-sm font-medium text-[#6e6e73] hover:bg-[#f5f5f7]"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Buscar</span>
              <kbd className="hidden rounded border border-[#e5e5e7] bg-[#f5f5f7] px-1.5 text-[10px] font-semibold lg:inline">⌘K</kbd>
            </button>
            {browserNotifications.supported && (
              <button
                type="button"
                onClick={toggleBrowserNotifications}
                aria-pressed={browserNotifications.active}
                title={
                  browserNotifications.permission === "denied"
                    ? "Avisos bloqueados no navegador"
                    : browserNotifications.active
                      ? "Avisos do navegador ligados"
                      : "Ativar avisos do navegador"
                }
                className={`flex h-11 w-11 items-center justify-center rounded-xl border hover:bg-[#f5f5f7] ${
                  browserNotifications.active
                    ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3]"
                    : "border-[#e5e5e7] text-[#6e6e73]"
                }`}
              >
                <BellRing className="h-4 w-4" />
                <span className="sr-only">
                  {browserNotifications.active ? "Desligar avisos do navegador" : "Ativar avisos do navegador"}
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={toggleSound}
              aria-pressed={soundOn}
              title={soundOn ? "Som de nova avaliação ligado" : "Som de nova avaliação desligado"}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e5e5e7] text-[#6e6e73] hover:bg-[#f5f5f7]"
            >
              {soundOn ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
              <span className="sr-only">{soundOn ? "Desligar som de nova avaliação" : "Ligar som de nova avaliação"}</span>
            </button>
            <div className="hidden lg:block">
              <UnitSelect />
            </div>
            <div className="lg:hidden">
              <UnitSelect compact />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-5 lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>

      <AdminCommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        links={items.map((i) => ({ to: i.to, label: i.label, icon: i.icon }))}
        canSeeEvaluations={can("evaluations.manage")}
      />

      {/* Barra inferior (celular) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e5e7] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Menu do painel"
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
                  isActive ? "text-[#1d1d1f]" : "text-[#86868b]"
                }`
              }
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.to === "/admin/avaliacoes" && pending > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 min-w-4 rounded-full bg-amber-500 px-1 text-center text-[9px] font-bold leading-4 text-white">
                    {pending > 99 ? "99+" : pending}
                  </span>
                )}
              </span>
              {item.label}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition ${
              moreActive ? "text-[#1d1d1f]" : "text-[#86868b]"
            }`}
          >
            <Menu className="h-5 w-5" />
            Mais
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-[#e5e5e7] bg-white pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="pb-0">
            <SheetTitle className="font-display text-base">{user?.name}</SheetTitle>
            <SheetDescription className="text-xs text-[#86868b]">
              {roleLabel} • {unitLabel}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-1 px-3">
            {moreItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={sidebarLink} onClick={() => setMoreOpen(false)}>
                <item.icon className="h-4 w-4" /> {item.label}
              </NavLink>
            ))}
            <NavLink to="/admin/conta" className={sidebarLink} onClick={() => setMoreOpen(false)}>
              <UserCircle className="h-4 w-4" /> Minha conta
            </NavLink>
            <a
              href="/tv"
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[#6e6e73] transition hover:bg-[#f5f5f7]"
            >
              <Tv className="h-4 w-4" /> Modo TV
            </a>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                logout();
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
