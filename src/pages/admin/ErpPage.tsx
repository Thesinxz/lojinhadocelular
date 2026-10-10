import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, CheckCircle2, ChevronDown, Plug, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useAdminSession } from "@/lib/adminSession";
import { formatBRL } from "@contracts/types";
import { formatDateTime, timeAgo } from "@/components/admin/evaluations/evaluationUi";

const STATUS: Record<string, { label: string; className: string }> = {
  ok: { label: "Conectado", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  empty: { label: "Catálogo vazio", className: "border-slate-300 bg-slate-50 text-slate-700" },
  offline: { label: "Offline", className: "border-amber-300 bg-amber-50 text-amber-800" },
  config_error: { label: "Configuração pendente", className: "border-red-300 bg-red-50 text-red-800" },
  disabled: { label: "Desativado", className: "border-slate-300 bg-slate-50 text-slate-700" },
};

function Card({ title, description, action, children }: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#e5e5e7] bg-white shadow-2xs">
      <header className="flex items-start justify-between gap-3 border-b border-[#f0f0f2] px-4 py-3.5 sm:px-5">
        <div>
          <h3 className="font-display text-sm font-bold text-[#1d1d1f]">{title}</h3>
          {description && <p className="mt-0.5 text-[11px] text-[#86868b]">{description}</p>}
        </div>
        {action}
      </header>
      <div className="px-4 py-3 sm:px-5">{children}</div>
    </section>
  );
}

function productLink(id: string) {
  return `/admin/produtos?editing=${encodeURIComponent(id)}`;
}

function IssueGroup({ title, hint, items }: { title: string; hint: string; items: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const ok = items.length === 0;
  return (
    <li className="py-2">
      <button
        type="button"
        onClick={() => !ok && setOpen((v) => !v)}
        aria-expanded={open}
        disabled={ok}
        className="flex min-h-11 w-full items-center gap-3 text-left"
      >
        {ok ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
        ) : (
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#1d1d1f]">{title}</span>
          <span className="block text-[11px] text-[#86868b]">{hint}</span>
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>
          {items.length}
        </span>
        {!ok && <ChevronDown className={`h-4 w-4 text-[#86868b] transition ${open ? "rotate-180" : ""}`} />}
      </button>
      {open && (
        <ul className="mb-1 ml-8 max-h-64 space-y-0.5 overflow-y-auto">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={productLink(item.id)} className="block rounded-lg px-2 py-1.5 text-sm text-[#0071e3] hover:bg-[#f5f5f7]">
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function StockList({ title, rows, field, empty }: { title: string; rows: { id: string; name: string; jardim: number; gll: number }[]; field: "jardim" | "gll"; empty: string }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-[#86868b]">
        {title} ({rows.length})
      </h4>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-[#86868b]">{empty}</p>
      ) : (
        <ul className="mt-2 max-h-72 divide-y divide-[#f0f0f2] overflow-y-auto">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={productLink(row.id)} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-[#fafafa]">
                <span className="min-w-0 truncate text-[#1d1d1f]">{row.name}</span>
                <span className="shrink-0 text-xs font-semibold text-[#6e6e73]">
                  {field === "jardim" ? `Jardim ${row.jardim} · Guia ${row.gll}` : `Guia ${row.gll} · Jardim ${row.jardim}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const CHANGE_LABEL: Record<string, string> = {
  price: "Preço",
  stock_jardim: "Estoque Jardim",
  stock_gll: "Estoque Guia Lopes",
  new: "Novo no catálogo",
  removed: "Saiu do catálogo",
};

function changeText(kind: string, oldValue: number | null, newValue: number | null): string {
  const fmt = (v: number | null) => (v === null ? "—" : kind === "price" || kind === "new" ? formatBRL(v) : String(v));
  if (kind === "new") return `${CHANGE_LABEL.new}${newValue !== null ? ` · ${fmt(newValue)}` : ""}`;
  if (kind === "removed") return CHANGE_LABEL.removed;
  return `${CHANGE_LABEL[kind] ?? kind}: ${fmt(oldValue)} → ${fmt(newValue)}`;
}

function ChangesCard() {
  const query = trpc.admin.catalogHistory.useQuery({ limit: 50 }, { staleTime: 30_000 });
  const changes = query.data ?? [];
  return (
    <Card title="Mudanças recentes" description="Preço e estoque detectados a cada sincronização (guardados por 90 dias).">
      {query.isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-[#f5f5f7]" />
      ) : changes.length === 0 ? (
        <p className="text-sm text-[#86868b]">Nenhuma mudança registrada ainda. O histórico começa na próxima alteração do ERP.</p>
      ) : (
        <ul className="max-h-96 divide-y divide-[#f0f0f2] overflow-y-auto">
          {changes.map((c) => (
            <li key={c.id}>
              <Link to={productLink(c.productId)} className="block py-2 hover:bg-[#fafafa]">
                <span className="block truncate text-sm font-medium text-[#1d1d1f]">{c.productName}</span>
                <span className="block text-xs text-[#6e6e73]">{changeText(c.kind, c.oldValue, c.newValue)}</span>
                <span className="block text-[11px] text-[#86868b]">{formatDateTime(c.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ServiceUserCard() {
  const query = trpc.admin.erpServiceStatus.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const data = query.data;
  return (
    <Card
      title="Conexão com o ERP (seminovos e fidelidade)"
      description="Credencial usada pelo botão “Dar entrada no ERP” e pela conferência do bônus de fidelidade."
      action={
        <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e5e5e7] bg-white px-3 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} /> Testar conexão
        </button>
      }
    >
      {query.isLoading ? (
        <div className="h-10 animate-pulse rounded-xl bg-[#f5f5f7]" />
      ) : !data?.configured ? (
        <p className="text-sm text-amber-800">
          Não configurado. Defina <code>ERP_API_TOKEN</code> no servidor (token criado no ERP, com os escopos “clientes:fidelidade” e “aquisicoes:criar”).
          Alternativa: <code>ERP_SERVICE_EMAIL</code> e <code>ERP_SERVICE_PASSWORD</code> de um usuário de serviço.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          <li className="text-[#6e6e73]">
            Autenticação: {data.mode === "token" ? "token de API (recomendado)" : "usuário e senha (considere migrar para token de API)"}.
          </li>
          <li className={data.connected ? "text-emerald-700" : "text-red-700"}>
            {data.connected
              ? data.mode === "token"
                ? "Token aceito pelo ERP."
                : "Login no ERP funcionando."
              : `Falha na conexão: ${data.error ?? "erro desconhecido"}`}
          </li>
          <li className={data.units.jardim ? "text-emerald-700" : "text-red-700"}>Unidade de Jardim {data.units.jardim ? "encontrada" : "não encontrada (defina ERP_UNIT_ID_JARDIM)"}.</li>
          <li className={data.units.gll ? "text-emerald-700" : "text-red-700"}>Unidade de Guia Lopes {data.units.gll ? "encontrada" : "não encontrada (defina ERP_UNIT_ID_GLL)"}.</li>
        </ul>
      )}
    </Card>
  );
}

function InterestCard() {
  const query = trpc.admin.productInterest.useQuery({ days: 30 }, { staleTime: 60_000 });
  const data = query.data;
  return (
    <Card title="Interesse dos clientes" description="Cliques em pedir pelo WhatsApp na página do produto, últimos 30 dias, cruzados com o estoque.">
      {query.isLoading ? (
        <div className="h-16 animate-pulse rounded-xl bg-[#f5f5f7]" />
      ) : !data || (data.wanted.length === 0 && data.stale.length === 0) ? (
        <p className="text-sm text-[#86868b]">Sem dados ainda. Os cliques passam a ser contados a partir de agora.</p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#86868b]">Mais procurados</h4>
            {data.wanted.length === 0 ? (
              <p className="mt-2 text-sm text-[#86868b]">Nenhum clique no período.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[#f0f0f2]">
                {data.wanted.map((p) => (
                  <li key={p.productId}>
                    <Link to={productLink(p.productId)} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-[#fafafa]">
                      <span className="min-w-0 truncate text-[#1d1d1f]">{p.name}</span>
                      <span className="shrink-0 text-xs font-semibold text-[#6e6e73]">
                        {p.clicks} cliques · estoque {p.jardim + p.gll}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#86868b]">Parados (com estoque, sem cliques)</h4>
            {data.stale.length === 0 ? (
              <p className="mt-2 text-sm text-[#86868b]">Todo produto com estoque teve interesse.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[#f0f0f2]">
                {data.stale.map((p) => (
                  <li key={p.productId}>
                    <Link to={productLink(p.productId)} className="flex items-center justify-between gap-3 py-2 text-sm hover:bg-[#fafafa]">
                      <span className="min-w-0 truncate text-[#1d1d1f]">{p.name}</span>
                      <span className="shrink-0 text-xs font-semibold text-[#6e6e73]">estoque {p.jardim + p.gll}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Integração com o Gestão Celular: saúde, divergências do catálogo e estoque por loja. */
export default function ErpPage() {
  const { can } = useAdminSession();
  const utils = trpc.useUtils();
  const query = trpc.admin.erpOverview.useQuery(undefined, { staleTime: 30_000 });
  const refresh = trpc.admin.refreshErpCatalog.useMutation({
    onSuccess: (res) => {
      toast.success(res.status === "ok" ? `ERP sincronizado: ${res.count} aparelhos` : res.message || "ERP consultado");
      utils.admin.erpOverview.invalidate();
      utils.admin.dashboard.invalidate();
      utils.admin.products.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  if (query.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-[#f5f5f7]" />;
  if (query.isError || !query.data) {
    return <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Não foi possível carregar a integração.</p>;
  }

  const { status, config, issues, stock } = query.data;
  const badge = STATUS[status.status] ?? STATUS.offline;
  const totalIssues = Object.values(issues).reduce((sum, list) => sum + list.length, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-[#1d1d1f]">
          <Plug className="h-6 w-6" /> Integração ERP
        </h2>
        <p className="mt-1 text-sm text-[#86868b]">Gestão Celular: sincronização, divergências e estoque por loja.</p>
      </div>

      <Card
        title="Saúde da sincronização"
        description="O catálogo é consultado a cada 45 segundos, somente leitura."
        action={
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#e5e5e7] bg-white px-3 text-xs font-semibold text-[#1d1d1f] hover:bg-[#f5f5f7] disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} />
            Sincronizar agora
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.className}`}>{badge.label}</span>
          <span className="text-sm font-semibold text-[#1d1d1f]">{status.count} aparelhos no catálogo</span>
          <span className="text-xs text-[#86868b]">
            {status.lastSyncAt ? `Última sincronização ${timeAgo(status.lastSyncAt)}` : "Sem sincronização recente"}
          </span>
        </div>
        {status.message && <p className="mt-2 text-xs text-red-600">{status.message}</p>}
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          <div>
            <dt className="font-semibold text-[#86868b]">Servidor</dt>
            <dd className="text-[#1d1d1f]">{config.host}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[#86868b]">Loja (slug)</dt>
            <dd className="break-all text-[#1d1d1f]">{config.storeSlug}</dd>
          </div>
          <div>
            <dt className="font-semibold text-[#86868b]">Categoria</dt>
            <dd className="text-[#1d1d1f]">{config.categorySlug}</dd>
          </div>
        </dl>
      </Card>

      <Card
        title="Divergências do catálogo"
        description={totalIssues === 0 ? "Tudo certo por aqui." : `${totalIssues} ponto(s) para corrigir. Toque para ver os produtos.`}
      >
        <ul className="divide-y divide-[#f0f0f2]">
          <IssueGroup title="Visíveis sem foto" hint="A vitrine mostra um espaço vazio." items={issues.noPhoto} />
          <IssueGroup title="Seminovos sem bateria" hint="Cliente pergunta a saúde da bateria." items={issues.noBattery} />
          <IssueGroup title="Esgotados ainda visíveis" hint="Escondem ou geram pedido sem estoque." items={issues.soldOutVisible} />
          <IssueGroup title="Disponíveis com preço zero" hint="Podem aparecer como grátis ou sem preço." items={issues.noPrice} />
          <IssueGroup title="Ocultos mas com estoque" hint="Têm aparelho na loja e não aparecem no site." items={issues.hiddenWithStock} />
        </ul>
      </Card>

      <Card
        title="Estoque por loja"
        description={`Visíveis: ${stock.totals.visible} de ${stock.totals.products} produtos · Jardim ${stock.totals.jardim} un. · Guia Lopes ${stock.totals.gll} un.`}
      >
        <div className="grid gap-6 md:grid-cols-2">
          <StockList title="Esgotados em Jardim (tem na Guia)" rows={stock.soldOutJardim} field="gll" empty="Nada esgotado só em Jardim." />
          <StockList title="Esgotados na Guia (tem em Jardim)" rows={stock.soldOutGll} field="jardim" empty="Nada esgotado só na Guia." />
          <StockList title={`Estoque baixo em Jardim (até ${stock.lowThreshold})`} rows={stock.lowJardim} field="jardim" empty="Nenhum com estoque baixo." />
          <StockList title={`Estoque baixo na Guia (até ${stock.lowThreshold})`} rows={stock.lowGll} field="gll" empty="Nenhum com estoque baixo." />
        </div>
      </Card>

      {can("settings.manage") && <ServiceUserCard />}

      <InterestCard />

      <ChangesCard />
    </div>
  );
}
