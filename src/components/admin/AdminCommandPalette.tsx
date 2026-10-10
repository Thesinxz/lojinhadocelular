import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router";
import { Package, Search, Smartphone } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { EVALUATION_STATUS_LABELS } from "@contracts/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface PaletteLink {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface AdminCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  links: PaletteLink[];
  canSeeEvaluations: boolean;
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Busca global do painel (⌘K / Ctrl+K): telas, avaliações e produtos. */
export default function AdminCommandPalette({ open, onOpenChange, links, canSeeEvaluations }: AdminCommandPaletteProps) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [term]);

  useEffect(() => {
    if (!open) setTerm("");
  }, [open]);

  const evaluations = trpc.admin.evaluationsPage.useQuery(
    { page: 1, pageSize: 6, search: debounced, includePhotos: false },
    { enabled: open && canSeeEvaluations && debounced.length >= 2, staleTime: 15_000 },
  );
  const products = trpc.admin.products.useQuery(undefined, { enabled: open && debounced.length >= 2, staleTime: 60_000 });

  const query = normalize(debounced);
  const pageMatches = useMemo(
    () => links.filter((l) => !query || normalize(l.label).includes(query)),
    [links, query],
  );
  const productMatches = useMemo(() => {
    if (query.length < 2) return [];
    return (products.data ?? [])
      .filter((p) => normalize(p.name).includes(query))
      .slice(0, 6)
      .map((p) => {
        const isErp = (p as { source?: string }).source === "erp";
        const key = isErp ? (p as { externalId?: string }).externalId || String(p.id) : String(p.id);
        return { key, name: p.name };
      });
  }, [products.data, query]);

  function go(to: string) {
    onOpenChange(false);
    navigate(to);
  }

  const evaluationItems = evaluations.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader className="sr-only">
        <DialogTitle>Busca do painel</DialogTitle>
        <DialogDescription>Procure telas, avaliações e produtos.</DialogDescription>
      </DialogHeader>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg" showCloseButton={false}>
        <Command shouldFilter={false}>
          <CommandInput
            value={term}
            onValueChange={setTerm}
            placeholder="Buscar tela, cliente, aparelho ou produto…"
            aria-label="Buscar no painel"
          />
          <CommandList className="max-h-[60dvh]">
            <CommandEmpty>
              {evaluations.isFetching || products.isFetching ? "Buscando…" : "Nada encontrado."}
            </CommandEmpty>

            {pageMatches.length > 0 && (
              <CommandGroup heading="Telas">
                {pageMatches.map((l) => (
                  <CommandItem key={l.to} value={`tela-${l.to}`} onSelect={() => go(l.to)} className="min-h-11">
                    <l.icon /> {l.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {evaluationItems.length > 0 && (
              <CommandGroup heading="Avaliações">
                {evaluationItems.map((e) => (
                  <CommandItem key={e.id} value={`avaliacao-${e.id}`} onSelect={() => go(`/admin/avaliacoes/${e.id}`)} className="min-h-11">
                    <Smartphone />
                    <span className="min-w-0 flex-1 truncate">
                      {e.name} · {[e.model, e.storage].filter(Boolean).join(" ")}
                    </span>
                    <span className="shrink-0 text-xs text-[#86868b]">{EVALUATION_STATUS_LABELS[e.status]}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {productMatches.length > 0 && (
              <CommandGroup heading="Produtos">
                {productMatches.map((p) => (
                  <CommandItem
                    key={p.key}
                    value={`produto-${p.key}`}
                    onSelect={() => go(`/admin/produtos?editing=${encodeURIComponent(p.key)}`)}
                    className="min-h-11"
                  >
                    <Package /> <span className="truncate">{p.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-2 border-t px-3 py-2 text-[11px] text-[#86868b]">
            <Search className="h-3 w-3" /> Digite 2+ letras para buscar avaliações e produtos. Esc fecha.
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
