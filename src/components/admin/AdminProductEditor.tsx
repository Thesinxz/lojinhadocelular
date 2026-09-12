import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Video,
  Copy,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { CATEGORIES, BRANDS } from "@contracts/types";
import { IPHONE_CATALOG, detectIphoneModel, getIphoneModelColorImage } from "@/lib/iphoneCatalog";

export type FormVariant = {
  version: string;
  storage: string;
  color: string;
  colorHex?: string;
  imageUrl?: string;
  videoUrl?: string;
  sku?: string;
  batteryHealth?: string;
  warranty?: string;
  condition: "lacrado" | "seminovo";
  notes?: string;
  priceReais: string;
  quantity?: number;
  available: boolean;
};

export type FormState = {
  name: string;
  brand: string;
  category: (typeof CATEGORIES)[number]["value"];
  condition: string;
  description: string;
  imageUrl: string;
  videoUrl: string;
  warranty: string;
  featured: boolean;
  active: boolean;
  variants: FormVariant[];
};

const EMPTY: FormState = {
  name: "",
  brand: "Apple",
  category: "iphone_lacrado",
  condition: "lacrado",
  description: "",
  imageUrl: "",
  videoUrl: "",
  warranty: "1 ano de garantia",
  featured: false,
  active: true,
  variants: [
    {
      version: "",
      storage: "128GB",
      color: "Preto",
      colorHex: "#1d1d1f",
      imageUrl: "",
      videoUrl: "",
      sku: "",
      batteryHealth: "",
      warranty: "1 ano de garantia",
      condition: "lacrado",
      notes: "",
      priceReais: "",
      quantity: 1,
      available: true,
    },
  ],
};

export function detectColorHex(name: string): string | null {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!n) return null;

  // Busca no catálogo oficial Apple
  for (const model of IPHONE_CATALOG) {
    for (const c of model.colors) {
      const cNorm = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (cNorm === n || n.includes(cNorm) || cNorm.includes(n)) {
        return c.hex;
      }
    }
  }

  // Titânios do iPhone
  if (n.includes("natural titanium") || n.includes("titanio natural")) return "#bebaa7";
  if (n.includes("desert titanium") || n.includes("titanio deserto") || n.includes("deserto")) return "#c6aa91";
  if (n.includes("white titanium") || n.includes("titanio branco")) return "#f2f1ed";
  if (n.includes("black titanium") || n.includes("titanio preto")) return "#3c3b37";
  if (n.includes("blue titanium") || n.includes("titanio azul")) return "#3b4453";

  // Cores comuns e da Apple
  if (n.includes("dourado") || n.includes("gold")) return "#fae7cf";
  if (n.includes("prateado") || n.includes("silver") || n.includes("prata")) return "#e2e4e1";
  if (n.includes("grafite") || n.includes("graphite")) return "#545351";
  if (n.includes("espaco") || n.includes("space gray") || n.includes("cinza espacial")) return "#4b4a4e";
  if (n.includes("space black") || n.includes("preto espacial")) return "#2e2c2e";
  if (n.includes("midnight") || n.includes("meia-noite") || n.includes("meia noite")) return "#1b242d";
  if (n.includes("starlight") || n.includes("estelar")) return "#f0e9d7";
  if (n.includes("red") || n.includes("vermelho")) return "#e30016";
  if (n.includes("rosa") || n.includes("pink") || n.includes("rose")) return "#faddd7";
  if (n.includes("azul") || n.includes("blue") || n.includes("sierra")) return "#a7c1d9";
  if (n.includes("verde") || n.includes("green") || n.includes("alpine")) return "#475c4d";
  if (n.includes("roxo") || n.includes("purple") || n.includes("violeta")) return "#63587b";
  if (n.includes("amarelo") || n.includes("yellow")) return "#f3e08c";
  if (n.includes("laranja") || n.includes("orange")) return "#ff8c00";
  if (n.includes("preto") || n.includes("black") || n.includes("dark")) return "#1d1d1f";
  if (n.includes("branco") || n.includes("white")) return "#f7f7f7";
  if (n.includes("cinza") || n.includes("gray") || n.includes("grey")) return "#8e8e93";

  return null;
}

export function formatCurrencyInput(val: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "");
  if (!digits) return "";
  const cents = parseInt(digits, 10);
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

import { getVideoEmbed } from "@/lib/videoEmbed";
export { getVideoEmbed };

export default function AdminProductEditor({
  productId,
  onClose,
}: {
  productId: number | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const draftKey = `admin_product_draft_${productId ?? "novo"}`;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [highlightMissing, setHighlightMissing] = useState<Record<string, boolean>>({});

  const isHydrated = useRef(false);
  const [autoRestored, setAutoRestored] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const selectedModel = detectIphoneModel(form.name);

  const matchedModels = form.name.trim()
    ? IPHONE_CATALOG.filter((m) =>
        m.name.toLowerCase().includes(form.name.toLowerCase().trim()),
      )
    : IPHONE_CATALOG.slice(0, 15);

  function selectModel(m: (typeof IPHONE_CATALOG)[number]) {
    const defaultStorage = m.capacities[0] || "128GB";
    const firstColor = m.colors[0] || { name: "Preto", hex: "#1d1d1f" };
    const autoImage = getIphoneModelColorImage(m, firstColor.name);

    setForm((f) => ({
      ...f,
      name: m.name,
      brand: "Apple",
      category: f.category === "iphone_seminovo" ? "iphone_seminovo" : "iphone_lacrado",
      condition: f.category === "iphone_seminovo" ? "seminovo" : "lacrado",
      warranty: f.category === "iphone_seminovo" ? "6 meses de garantia" : "1 ano de garantia",
      imageUrl: f.imageUrl || autoImage || "",
      variants: f.variants.length > 0
        ? f.variants.map((v, idx) =>
            idx === 0
              ? {
                  ...v,
                  storage: defaultStorage,
                  color: firstColor.name,
                  colorHex: firstColor.hex,
                  imageUrl: autoImage || v.imageUrl,
                }
              : v,
          )
        : [
            {
              version: "",
              storage: defaultStorage,
              color: firstColor.name,
              colorHex: firstColor.hex,
              imageUrl: autoImage || "",
              videoUrl: "",
              sku: "",
              batteryHealth: f.category === "iphone_seminovo" ? "85%" : "",
              warranty: f.category === "iphone_seminovo" ? "6 meses de garantia" : "1 ano de garantia",
              condition: f.category === "iphone_seminovo" ? "seminovo" : "lacrado",
              notes: "",
              priceReais: "",
              quantity: 1,
              available: true,
            },
          ],
    }));
    setShowNameDropdown(false);
    setHighlightMissing({});
  }

  function addAllModelColors(m: (typeof IPHONE_CATALOG)[number]) {
    const defaultStorage = m.capacities[0] || "128GB";
    const baseCondition = form.category === "iphone_seminovo" ? "seminovo" : "lacrado";
    const baseWarranty = baseCondition === "lacrado" ? "1 ano de garantia" : "6 meses de garantia";

    const generatedVariants: FormVariant[] = m.colors.map((c) => ({
      version: "",
      storage: defaultStorage,
      color: c.name,
      colorHex: c.hex,
      imageUrl: getIphoneModelColorImage(m, c.name) || "",
      videoUrl: "",
      sku: "",
      batteryHealth: baseCondition === "seminovo" ? "85%" : "",
      warranty: baseWarranty,
      condition: baseCondition,
      notes: "",
      priceReais: "",
      quantity: 1,
      available: true,
    }));

    setForm((f) => ({
      ...f,
      variants: generatedVariants,
    }));
  }

  const products = trpc.admin.products.useQuery();
  const upsert = trpc.admin.upsertProduct.useMutation({
    onSuccess: () => {
      utils.admin.products.invalidate();
      try {
        localStorage.removeItem(draftKey);
      } catch {
        // ignore
      }
      onClose();
    },
    onError: (err) => {
      setError(err.message || "Erro ao salvar produto");
    },
  });

  // Preenche dados se estiver editando ou restaura rascunho salvo
  useEffect(() => {
    let baseForm = EMPTY;
    if (productId != null && products.data) {
      const p = products.data.find((x) => x.id === productId);
      if (p) {
        baseForm = {
          name: p.name,
          brand: p.brand,
          category: p.category,
          condition: p.condition,
          description: p.description ?? "",
          imageUrl: p.imageUrl ?? "",
          videoUrl: (p as unknown as { videoUrl?: string }).videoUrl ?? "",
          warranty: p.warranty ?? "",
          featured: p.featured,
          active: p.active,
          variants: p.variants.map((v) => ({
            version: v.version,
            storage: v.storage,
            color: v.color,
            colorHex: v.colorHex ?? "#1d1d1f",
            imageUrl: v.imageUrl ?? "",
            videoUrl: (v as unknown as { videoUrl?: string }).videoUrl ?? "",
            sku: (v as unknown as { sku?: string }).sku ?? "",
            batteryHealth: v.batteryHealth ?? "",
            warranty: v.warranty ?? "",
            condition: (v.condition === "lacrado" ? "lacrado" : "seminovo") as "lacrado" | "seminovo",
            notes: v.notes ?? "",
            priceReais: formatCurrencyInput(String(v.priceCash)),
            quantity: typeof v.quantity === "number" ? v.quantity : 1,
            available: v.available,
          })),
        };
      }
    }

    let restoredFromDraft = false;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.form) {
          const hasContent =
            parsed.form.name ||
            parsed.form.description ||
            parsed.form.variants?.some((v: Record<string, unknown>) => v.priceReais || v.color);
          if (hasContent) {
            const sanitizedVariants = (parsed.form.variants || []).map((v: Record<string, unknown>) => ({
              version: String(v.version ?? ""),
              storage: String(v.storage ?? "128GB"),
              color: String(v.color ?? "Preto"),
              colorHex: String(v.colorHex ?? "#1d1d1f"),
              imageUrl: String(v.imageUrl ?? ""),
              videoUrl: String(v.videoUrl ?? ""),
              sku: String(v.sku ?? ""),
              batteryHealth: String(v.batteryHealth ?? ""),
              warranty: String(v.warranty ?? ""),
              condition: (v.condition === "lacrado" ? "lacrado" : "seminovo") as "lacrado" | "seminovo",
              notes: String(v.notes ?? ""),
              priceReais: formatCurrencyInput(String(v.priceReais ?? "")),
              quantity: typeof v.quantity === "number" ? v.quantity : 1,
              available: v.available ?? true,
            }));

            setForm({
              ...parsed.form,
              videoUrl: parsed.form.videoUrl || "",
              variants: sanitizedVariants.length > 0 ? sanitizedVariants : EMPTY.variants,
            });
            restoredFromDraft = true;
            setAutoRestored(true);
            setIsDirty(true);
          }
        }
      }
    } catch {
      // ignore
    }

    if (!restoredFromDraft) {
      setForm(baseForm);
    }

    const t = setTimeout(() => {
      isHydrated.current = true;
    }, 100);
    return () => clearTimeout(t);
  }, [productId, products.data, draftKey]);

  // Salva rascunho no localStorage
  useEffect(() => {
    if (!isHydrated.current) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ form, updatedAt: new Date().toISOString() }),
      );
      setIsDirty(true);
    } catch {
      // ignore
    }
  }, [form, draftKey]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function discardDraft() {
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignore
    }
    setAutoRestored(false);
    setIsDirty(false);
    if (productId != null && products.data) {
      const p = products.data.find((x) => x.id === productId);
      if (p) {
        setForm({
          name: p.name,
          brand: p.brand,
          category: p.category,
          condition: p.condition,
          description: p.description ?? "",
          imageUrl: p.imageUrl ?? "",
          videoUrl: (p as unknown as { videoUrl?: string }).videoUrl ?? "",
          warranty: p.warranty ?? "",
          featured: p.featured,
          active: p.active,
          variants: p.variants.map((v) => ({
            version: v.version,
            storage: v.storage,
            color: v.color,
            colorHex: v.colorHex ?? "#1d1d1f",
            imageUrl: v.imageUrl ?? "",
            videoUrl: (v as unknown as { videoUrl?: string }).videoUrl ?? "",
            sku: (v as unknown as { sku?: string }).sku ?? "",
            batteryHealth: v.batteryHealth ?? "",
            warranty: v.warranty ?? "",
            condition: (v.condition === "lacrado" ? "lacrado" : "seminovo") as "lacrado" | "seminovo",
            notes: v.notes ?? "",
            priceReais: formatCurrencyInput(String(v.priceCash)),
            quantity: typeof v.quantity === "number" ? v.quantity : 1,
            available: v.available,
          })),
        });
        return;
      }
    }
    setForm(EMPTY);
  }

  function parsePrice(str: string): number {
    if (!str) return 0;
    const digits = str.replace(/\D/g, "");
    return parseInt(digits, 10) || 0;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setHighlightMissing({});

    // Validações com feedback direto em React (SEM popup nativo "Preencha este campo.")
    if (!form.name.trim()) {
      setError("Por favor, informe o nome do produto (ex: iPhone 16 Pro Max).");
      setHighlightMissing({ name: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (form.variants.length === 0) {
      setError("Adicione pelo menos uma unidade/variante para o produto.");
      return;
    }

    // Valida cada variante
    for (let i = 0; i < form.variants.length; i++) {
      const v = form.variants[i];
      if (!v.storage.trim()) {
        setError(`A unidade #${i + 1} está sem a capacidade/armazenamento informada (ex: 128GB).`);
        setHighlightMissing({ [`variant_${i}_storage`]: true });
        return;
      }
      if (!v.color.trim()) {
        setError(`A unidade #${i + 1} está sem a cor informada.`);
        setHighlightMissing({ [`variant_${i}_color`]: true });
        return;
      }
      const priceVal = parsePrice(v.priceReais);
      if (priceVal <= 0) {
        setError(`A unidade #${i + 1} precisa ter um preço à vista válido maior que R$ 0,00.`);
        setHighlightMissing({ [`variant_${i}_price`]: true });
        return;
      }
    }

    const cleanedVariants = form.variants.map((v) => ({
      version: v.version || "",
      storage: v.storage.trim(),
      color: v.color.trim(),
      colorHex: v.colorHex || "#1d1d1f",
      imageUrl: v.imageUrl?.trim() || undefined,
      videoUrl: v.videoUrl?.trim() || undefined,
      sku: v.sku?.trim() || "",
      batteryHealth: v.condition === "lacrado" ? "" : (v.batteryHealth?.trim() || ""),
      warranty: v.warranty?.trim() || (v.condition === "lacrado" ? "1 ano de garantia" : "6 meses de garantia"),
      condition: v.condition,
      notes: v.notes?.trim() || "",
      priceCash: parsePrice(v.priceReais),
      quantity: typeof v.quantity === "number" ? Math.max(0, v.quantity) : 1,
      available: (v.quantity ?? 1) > 0 && v.available,
    }));

    // Determina a condição principal pelo mix das variantes
    const mainCondition = cleanedVariants.every((v) => v.condition === "lacrado")
      ? "lacrado"
      : cleanedVariants.every((v) => v.condition === "seminovo")
        ? "seminovo"
        : "hibrido";

    upsert.mutate({
      ...(productId != null ? { id: productId } : {}),
      name: form.name.trim(),
      brand: form.brand.trim(),
      category: form.category,
      condition: mainCondition,
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || cleanedVariants[0]?.imageUrl || undefined,
      videoUrl: form.videoUrl.trim() || undefined,
      warranty: cleanedVariants[0]?.warranty || form.warranty,
      featured: form.featured,
      active: form.active,
      variants: cleanedVariants,
    });
  }

  function setVariant(i: number, patch: Partial<FormVariant>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    }));
  }

  function handleBack() {
    if (isDirty) {
      const confirmLeave = window.confirm(
        "Você tem alterações neste formulário. Deseja sair?",
      );
      if (!confirmLeave) return;
    }
    onClose();
  }

  const mainVideoEmbed = getVideoEmbed(form.videoUrl);

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-3xl border border-[#e5e5e7] bg-white p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.07)]"
    >
      {/* HEADER DO EDITOR */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-5">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#86868b] hover:text-[#1d1d1f] transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar à lista
        </button>
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Rascunho salvo automaticamente
          </span>
        )}
      </div>

      {autoRestored && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-blue-950 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-200 text-blue-900 font-bold text-lg">
              ✨
            </div>
            <div>
              <p className="text-sm font-bold">Dados restaurados do rascunho!</p>
              <p className="text-xs text-blue-800">
                Recuperamos o que você estava preenchendo anteriormente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={discardDraft}
            className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-white px-3.5 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Descartar rascunho
          </button>
        </div>
      )}

      {/* TÍTULO PRINCIPAL */}
      <div className="mt-6">
        <h2 className="font-display text-2xl font-bold tracking-tight text-[#1d1d1f]">
          {productId != null ? "Editar produto" : "Cadastrar novo produto"}
        </h2>
        <p className="mt-1 text-xs text-[#86868b]">
          Preencha as informações principais do modelo e configure as variantes (lacrado, seminovo, bateria, código e preço).
        </p>
      </div>

      {/* ERRO NO TOPO SE HOUVER */}
      {error && (
        <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* SEÇÃO 1: DADOS PRINCIPAIS DO APARELHO */}
      {/* ============================================================ */}
      <div className="mt-6 rounded-2xl border border-neutral-200/80 bg-[#fbfbfd] p-5 sm:p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#1d1d1f] flex items-center gap-2 mb-4">
          <span>📱</span> 1. Dados Principais do Modelo
        </h3>

        <div className="grid gap-4 md:grid-cols-2">
          {/* NOME DO PRODUTO COM DROPDOWN INTELIGENTE */}
          <div className="relative">
            <Field label="Nome do produto *">
              <input
                value={form.name}
                onFocus={() => setShowNameDropdown(true)}
                onBlur={() => setTimeout(() => setShowNameDropdown(false), 250)}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setShowNameDropdown(true);
                  if (highlightMissing.name) setHighlightMissing((h) => ({ ...h, name: false }));
                }}
                placeholder="Ex: iPhone 16 Pro Max, iPhone 15, Redmi Note 13..."
                className={`${inputCls} ${
                  highlightMissing.name ? "border-red-500 bg-red-50/50 ring-2 ring-red-200" : ""
                }`}
              />
            </Field>

            {showNameDropdown && matchedModels.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-[#e5e5e7] bg-white shadow-2xl animate-in fade-in-50">
                <div className="bg-[#f5f5f7] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                  Sugestões da Apple (clique para autocompletar):
                </div>
                {matchedModels.map((m) => (
                  <button
                    key={m.name}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectModel(m);
                    }}
                    className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-left text-sm font-medium text-neutral-800 hover:bg-[#f0f0f2] transition"
                  >
                    <span className="font-bold text-[#1d1d1f]">📱 {m.name}</span>
                    <span className="truncate max-w-[200px] text-xs text-neutral-500">
                      {m.capacities.join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Field label="Marca *">
            <select
              value={form.brand}
              onChange={(e) => setForm({ ...form, brand: e.target.value })}
              className={inputCls}
            >
              {BRANDS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </Field>

          <Field label="Categoria no Catálogo *">
            <select
              value={form.category}
              onChange={(e) => {
                const cat = e.target.value as FormState["category"];
                setForm((f) => ({ ...f, category: cat }));
              }}
              className={inputCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </Field>

          {/* FOTO PRINCIPAL */}
          <Field label="Foto Principal do Aparelho (URL)">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value.trim() })}
                  placeholder="https://... (link da foto ImgBB, Unsplash ou CDN)"
                  className={inputCls}
                />
              </div>
              {form.imageUrl && (
                <div className="h-10 w-10 shrink-0 rounded-xl border border-neutral-200 bg-white p-1 flex items-center justify-center overflow-hidden">
                  <img
                    src={form.imageUrl}
                    alt="Preview"
                    className="h-full w-full object-contain"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                </div>
              )}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              💡 Fotos com fundo branco ou transparente ficam perfeitas no estilo Apple.
            </p>
          </Field>

          {/* VÍDEO DO PRODUTO (NOVO REQUISITO) */}
          <div className="md:col-span-2">
            <Field label="Vídeo de Apresentação / Demonstração (URL Opcional)">
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <Video className="h-5 w-5" />
                </span>
                <input
                  value={form.videoUrl}
                  onChange={(e) => setForm({ ...form, videoUrl: e.target.value.trim() })}
                  placeholder="Cole o link do YouTube (ex: youtu.be/...), link direto MP4 ou Reels"
                  className={inputCls}
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                🎬 Mostre o aparelho em detalhes na página do produto! Suporta YouTube, Shorts, links diretos .mp4 e Reels.
              </p>
            </Field>

            {/* PREVIEW DO VÍDEO SE HOUVER */}
            {mainVideoEmbed && (
              <div className="mt-3 rounded-2xl border border-purple-200 bg-purple-50/50 p-3 max-w-md">
                <p className="text-xs font-bold text-purple-900 mb-2 flex items-center gap-1.5">
                  <Video className="h-3.5 w-3.5" /> Prévia do Vídeo Cadastrado:
                </p>
                {mainVideoEmbed.type === "youtube" ? (
                  <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                    <iframe
                      src={mainVideoEmbed.src}
                      title="Vídeo do produto"
                      className="h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : mainVideoEmbed.type === "video" ? (
                  <video
                    src={mainVideoEmbed.src}
                    controls
                    muted
                    playsInline
                    className="aspect-video w-full rounded-xl bg-black object-contain"
                  />
                ) : (
                  <div className="flex items-center gap-2 text-xs text-neutral-600">
                    <span>Link externo de vídeo:</span>
                    <a
                      href={mainVideoEmbed.src}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline font-medium inline-flex items-center gap-1"
                    >
                      Abrir link <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DESCRIÇÃO OPCIONAL */}
          <div className="md:col-span-2">
            <Field label="Descrição / Informações Adicionais (Opcional)">
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="Detalhes sobre a procedência, acessórios inclusos, estado geral..."
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* TOGGLES */}
        <div className="mt-4 flex flex-wrap gap-6 border-t border-neutral-200/60 pt-4">
          <Toggle
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
            label="Visível no site"
          />
          <Toggle
            checked={form.featured}
            onChange={(v) => setForm({ ...form, featured: v })}
            label="🔥 Produto em Promoção / Destaque"
          />
        </div>
      </div>

      {/* ============================================================ */}
      {/* SEÇÃO 2: VARIANTES E UNIDADES EM ESTOQUE */}
      {/* ============================================================ */}
      <div className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold text-[#1d1d1f]">
              2. Variações & Unidades em Estoque
            </h3>
            <p className="text-xs text-[#86868b]">
              Configure cada unidade individualmente: Lacrado ou Seminovo, bateria, cor, garantia, código e valor.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              const last = form.variants[form.variants.length - 1];
              setForm({
                ...form,
                variants: [
                  ...form.variants,
                  {
                    version: "",
                    storage: last?.storage || selectedModel?.capacities[0] || "128GB",
                    color: "",
                    colorHex: "#1d1d1f",
                    imageUrl: "",
                    videoUrl: "",
                    sku: "",
                    batteryHealth: last?.condition === "seminovo" ? "85%" : "",
                    warranty: last?.warranty || "1 ano de garantia",
                    condition: last?.condition || "lacrado",
                    notes: "",
                    priceReais: last?.priceReais || "",
                    quantity: 1,
                    available: true,
                  },
                ],
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1d1d1f] hover:bg-black px-4 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Adicionar Variante
          </button>
        </div>

        {/* CORES OFICIAIS DO MODELO SE FOR IPHONE */}
        {selectedModel && (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-[#fbfbfd] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                🎨 Cores Oficiais do {selectedModel.name}:
              </p>
              <button
                type="button"
                onClick={() => addAllModelColors(selectedModel)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#0071e3] hover:underline cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" /> Adicionar todas as cores do {selectedModel.name}
              </button>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-2">
              {selectedModel.colors.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    const last = form.variants[form.variants.length - 1];
                    const autoImg = getIphoneModelColorImage(selectedModel, c.name);
                    setForm((f) => ({
                      ...f,
                      variants: [
                        ...f.variants,
                        {
                          version: "",
                          storage: last?.storage || selectedModel.capacities[0] || "128GB",
                          color: c.name,
                          colorHex: c.hex,
                          imageUrl: autoImg || "",
                          videoUrl: "",
                          sku: "",
                          batteryHealth: last?.condition === "seminovo" ? "85%" : "",
                          warranty: last?.warranty || "1 ano de garantia",
                          condition: last?.condition || "lacrado",
                          notes: "",
                          priceReais: last?.priceReais || "",
                          quantity: 1,
                          available: true,
                        },
                      ],
                    }));
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-[#1d1d1f] hover:border-neutral-400 hover:bg-[#f5f5f7] transition cursor-pointer"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/15 shadow-2xs"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>+ {c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* LISTA DE VARIANTES */}
        <div className="mt-4 space-y-4">
          {form.variants.map((v, i) => {
            const isSecSeminovo = v.condition === "seminovo";
            const variantVideoEmbed = getVideoEmbed(v.videoUrl || "");

            return (
              <div
                key={i}
                className="rounded-2xl border border-[#e5e5e7] bg-white p-5 shadow-xs transition hover:border-neutral-300"
              >
                {/* CABEÇALHO DO CARD DA VARIANTE */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1d1d1f] text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="font-display text-sm font-bold text-[#1d1d1f]">
                      Unidade #{i + 1}: {v.color || "Sem cor"} · {v.storage || "Sem armazenamento"}
                    </span>

                    {/* SELO DE CONDIÇÃO */}
                    {isSecSeminovo ? (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                        🔄 Seminovo {v.batteryHealth ? `(${v.batteryHealth})` : ""}
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#1d1d1f] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        ✨ Lacrado
                      </span>
                    )}

                    {v.sku && (
                      <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-[11px] text-neutral-600">
                        CÓD. {v.sku}
                      </span>
                    )}

                    {v.priceReais && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                        R$ {v.priceReais}
                      </span>
                    )}
                  </div>

                  {/* AÇÕES DA VARIANTE */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const dup: FormVariant = {
                          ...v,
                          sku: "", // limpa o SKU para a nova unidade
                          notes: v.notes ? `${v.notes} (Unidade duplicada)` : "",
                        };
                        const newVars = [...form.variants];
                        newVars.splice(i + 1, 0, dup);
                        setForm({ ...form, variants: newVars });
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                      title="Duplicar esta unidade (ideal para adicionar outra com bateria ou cor diferente)"
                    >
                      <Copy className="h-3.5 w-3.5" /> Duplicar
                    </button>

                    {form.variants.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            variants: form.variants.filter((_, idx) => idx !== i),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    )}
                  </div>
                </div>

                {/* ====================================================== */}
                {/* LINHA 1: TOGGLE DE CONDIÇÃO (LACRADO OU SEMINOVO) */}
                {/* ====================================================== */}
                <div className="mb-4">
                  <span className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">
                    Condição desta Unidade:
                  </span>
                  <div className="inline-flex rounded-xl border border-neutral-200 p-1 bg-neutral-100">
                    <button
                      type="button"
                      onClick={() =>
                        setVariant(i, {
                          condition: "lacrado",
                          warranty: "1 ano de garantia",
                          batteryHealth: "",
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                        !isSecSeminovo
                          ? "bg-[#1d1d1f] text-white shadow-xs"
                          : "text-neutral-600 hover:text-black"
                      }`}
                    >
                      <span>✨</span> Lacrado Novo
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setVariant(i, {
                          condition: "seminovo",
                          warranty: v.warranty?.includes("EUA")
                            ? v.warranty
                            : "6 meses de garantia",
                          batteryHealth: v.batteryHealth || "85%",
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                        isSecSeminovo
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-neutral-600 hover:text-black"
                      }`}
                    >
                      <span>🔄</span> Seminovo
                    </button>
                  </div>
                </div>

                {/* ====================================================== */}
                {/* LINHA 2: ARMAZENAMENTO & COR */}
                {/* ====================================================== */}
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {/* ARMAZENAMENTO */}
                  <div>
                    <Field label="Armazenamento *">
                      <input
                        value={v.storage}
                        onChange={(e) => {
                          setVariant(i, { storage: e.target.value });
                          if (highlightMissing[`variant_${i}_storage`]) {
                            setHighlightMissing((h) => ({ ...h, [`variant_${i}_storage`]: false }));
                          }
                        }}
                        placeholder="Ex: 128GB, 256GB..."
                        className={`${inputCls} ${
                          highlightMissing[`variant_${i}_storage`]
                            ? "border-red-500 bg-red-50/50 ring-2 ring-red-200"
                            : ""
                        }`}
                      />
                    </Field>
                    {/* CHIPS RÁPIDOS DE ARMAZENAMENTO */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(selectedModel?.capacities || ["128GB", "256GB", "512GB", "1TB"]).map((cap) => (
                        <button
                          key={cap}
                          type="button"
                          onClick={() => setVariant(i, { storage: cap })}
                          className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                            v.storage === cap
                              ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                              : "border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                          }`}
                        >
                          {cap}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* COR DO APARELHO */}
                  <div>
                    <Field label="Cor do Aparelho *">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={v.colorHex ?? "#1d1d1f"}
                          onChange={(e) => setVariant(i, { colorHex: e.target.value })}
                          className="h-10 w-11 cursor-pointer shrink-0 rounded-xl border border-neutral-200 bg-neutral-100 p-0.5"
                          title="Clique para escolher o tom da cor"
                        />
                        <input
                          value={v.color}
                          onChange={(e) => {
                            const newColor = e.target.value;
                            const autoHex = detectColorHex(newColor);
                            setVariant(i, {
                              color: newColor,
                              ...(autoHex ? { colorHex: autoHex } : {}),
                            });
                            if (highlightMissing[`variant_${i}_color`]) {
                              setHighlightMissing((h) => ({ ...h, [`variant_${i}_color`]: false }));
                            }
                          }}
                          placeholder="Ex: Titânio-deserto, Preto..."
                          className={`${inputCls} ${
                            highlightMissing[`variant_${i}_color`]
                              ? "border-red-500 bg-red-50/50 ring-2 ring-red-200"
                              : ""
                          }`}
                        />
                      </div>
                    </Field>
                    {/* CHIPS RÁPIDOS DE COR */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(selectedModel?.colors || [
                        { name: "Preto", hex: "#1d1d1f" },
                        { name: "Branco", hex: "#f7f7f7" },
                        { name: "Titânio Natural", hex: "#bebaa7" },
                        { name: "Titânio Deserto", hex: "#c6aa91" },
                        { name: "Dourado", hex: "#fae7cf" },
                        { name: "Azul", hex: "#a7c1d9" },
                      ]).slice(0, 5).map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            const autoImg = selectedModel
                              ? getIphoneModelColorImage(selectedModel, c.name)
                              : null;
                            setVariant(i, {
                              color: c.name,
                              colorHex: c.hex,
                              ...(autoImg ? { imageUrl: autoImg } : {}),
                            });
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-medium transition cursor-pointer ${
                            v.color === c.name
                              ? "border-black bg-[#1d1d1f] text-white"
                              : "border-neutral-200 bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full border border-black/20"
                            style={{ backgroundColor: c.hex }}
                          />
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* PREÇO À VISTA (R$) */}
                  <div>
                    <Field label="Preço à Vista no Pix (R$) *">
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-xs font-bold text-neutral-400">
                          R$
                        </span>
                        <input
                          value={v.priceReais}
                          onChange={(e) => {
                            const masked = formatCurrencyInput(e.target.value);
                            setVariant(i, { priceReais: masked });
                            if (highlightMissing[`variant_${i}_price`]) {
                              setHighlightMissing((h) => ({ ...h, [`variant_${i}_price`]: false }));
                            }
                          }}
                          placeholder="5.690,00"
                          inputMode="numeric"
                          className={`${inputCls} pl-10 font-bold ${
                            highlightMissing[`variant_${i}_price`]
                              ? "border-red-500 bg-red-50/50 ring-2 ring-red-200"
                              : ""
                          }`}
                        />
                      </div>
                    </Field>
                    <p className="mt-1.5 text-[11px] text-neutral-500">
                      As parcelas no cartão são calculadas automaticamente conforme as taxas da maquininha.
                    </p>
                  </div>
                </div>

                {/* ====================================================== */}
                {/* LINHA 3: CONDIÇÕES ESPECÍFICAS (BATERIA, GARANTIA, SKU) */}
                {/* ====================================================== */}
                <div className="mt-4 rounded-xl border border-neutral-200/70 bg-[#fbfbfd] p-4">
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                    {/* SAÚDE DA BATERIA (DESTAQUE PARA SEMINOVO) */}
                    <div>
                      <Field
                        label={
                          isSecSeminovo
                            ? "🔋 Saúde da Bateria (Seminovo) *"
                            : "🔋 Saúde da Bateria (Lacrado)"
                        }
                      >
                        {isSecSeminovo ? (
                          <>
                            <input
                              value={v.batteryHealth ?? ""}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val.endsWith("%")) {
                                  setVariant(i, { batteryHealth: val });
                                  return;
                                }
                                const digits = val.replace(/\D/g, "");
                                if (digits.length === 2 && parseInt(digits, 10) >= 50) {
                                  setVariant(i, { batteryHealth: `${digits}%` });
                                  return;
                                }
                                if (digits === "100") {
                                  setVariant(i, { batteryHealth: "100%" });
                                  return;
                                }
                                setVariant(i, { batteryHealth: val });
                              }}
                              onBlur={() => {
                                const val = v.batteryHealth?.trim() || "";
                                if (val && !val.includes("%")) {
                                  const num = parseInt(val.replace(/\D/g, ""), 10);
                                  if (!isNaN(num) && num > 0 && num <= 100) {
                                    setVariant(i, { batteryHealth: `${num}%` });
                                  }
                                }
                              }}
                              placeholder="Ex: 85%, 100%, Bateria Nova"
                              className={inputCls}
                            />
                            {/* CHIPS RÁPIDOS DE BATERIA */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {["100%", "98%", "95%", "93%", "90%", "88%", "85%", "82%", "80%", "Bateria Nova"].map((b) => {
                                const isSelected =
                                  v.batteryHealth === b ||
                                  (b.endsWith("%") &&
                                    Boolean(v.batteryHealth) &&
                                    v.batteryHealth?.replace(/\D/g, "") === b.replace(/\D/g, ""));
                                return (
                                  <button
                                    key={b}
                                    type="button"
                                    onClick={() => setVariant(i, { batteryHealth: b })}
                                    className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                                      isSelected
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                                    }`}
                                  >
                                    {b}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className="flex h-10 items-center rounded-xl border border-neutral-200 bg-neutral-100 px-3 text-xs text-neutral-600 font-medium">
                            <span className="text-emerald-700 font-bold mr-1.5">✓ 100%</span> (Aparelho novo lacrado de fábrica)
                          </div>
                        )}
                      </Field>
                    </div>

                    {/* GARANTIA */}
                    <div>
                      <Field label="🛡️ Garantia desta Unidade">
                        <input
                          value={v.warranty ?? ""}
                          onChange={(e) => setVariant(i, { warranty: e.target.value })}
                          placeholder="Ex: 1 ano de garantia, 6 meses..."
                          className={inputCls}
                        />
                        <div className="mt-2 flex flex-wrap gap-1">
                          {[
                            "1 ano de garantia",
                            "1 ano (Importado EUA 🇺🇸)",
                            "6 meses de garantia",
                            "3 meses de garantia",
                            "Apple Oficial 🍎",
                          ].map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setVariant(i, { warranty: g })}
                              className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                                v.warranty === g
                                  ? "border-blue-600 bg-blue-600 text-white"
                                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100"
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </div>

                    {/* CÓDIGO DO APARELHO / SKU (CONFORME ETIQUETA DA FOTO DO USUÁRIO) */}
                    <div>
                      <Field label="🏷️ Código do Aparelho (SKU / Etiqueta)">
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-xs font-mono text-neutral-400">
                            #
                          </span>
                          <input
                            value={v.sku ?? ""}
                            onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })}
                            placeholder="Ex: 19046F05 ou B2676"
                            className={`${inputCls} pl-8 font-mono text-xs uppercase`}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-neutral-500">
                          Código de controle interno ou etiqueta colada no aparelho.
                        </p>
                      </Field>
                    </div>
                  </div>
                </div>

                {/* ====================================================== */}
                {/* LINHA 4: MÍDIA ESPECÍFICA DA UNIDADE (VÍDEO / FOTO) */}
                {/* ====================================================== */}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="🎬 Vídeo Desta Unidade Real (URL Opcional)">
                    <input
                      value={v.videoUrl ?? ""}
                      onChange={(e) => setVariant(i, { videoUrl: e.target.value.trim() })}
                      placeholder="YouTube, Shorts ou link direto MP4 mostrando este aparelho real..."
                      className={inputCls}
                    />
                    {v.videoUrl && (
                      <p className="mt-1 text-[11px] text-purple-700 font-medium">
                        ✓ Vídeo exclusivo configurado para esta variante!
                      </p>
                    )}
                  </Field>

                  <Field label="🖼️ Foto Desta Cor (URL Opcional)">
                    <input
                      value={v.imageUrl ?? ""}
                      onChange={(e) => setVariant(i, { imageUrl: e.target.value.trim() })}
                      placeholder="https://... (Foto específica desta cor/unidade)"
                      className={inputCls}
                    />
                    {v.imageUrl && (
                      <p className="mt-1 text-[11px] text-emerald-700 font-medium">
                        ✓ Foto exclusiva configurada para esta cor!
                      </p>
                    )}
                  </Field>
                </div>

                {/* MINIATURAS SE HOUVER */}
                {(v.imageUrl || variantVideoEmbed) && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5">
                    {v.imageUrl && (
                      <div className="flex items-center gap-2">
                        <img
                          src={v.imageUrl}
                          alt="Foto da cor"
                          className="h-10 w-10 rounded-lg border border-neutral-200 bg-white object-contain p-0.5"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                        <span className="text-xs text-neutral-600">Foto vinculada</span>
                      </div>
                    )}
                    {variantVideoEmbed && (
                      <div className="flex items-center gap-1.5 text-xs text-purple-700 font-semibold">
                        <Video className="h-4 w-4" />
                        <span>Vídeo vinculado ({variantVideoEmbed.type})</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ====================================================== */}
                {/* LINHA 5: ESTOQUE E DISPONIBILIDADE */}
                {/* ====================================================== */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-neutral-600">Estoque:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newQ = Math.max(0, (v.quantity ?? 1) - 1);
                          setVariant(i, { quantity: newQ, available: newQ > 0 });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 font-bold text-neutral-700 hover:bg-neutral-200 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={v.quantity ?? 1}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          setVariant(i, { quantity: val, available: val > 0 });
                        }}
                        className="h-8 w-14 rounded-lg border border-neutral-200 bg-white text-center text-xs font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newQ = (v.quantity ?? 1) + 1;
                          setVariant(i, { quantity: newQ, available: true });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 font-bold text-neutral-700 hover:bg-neutral-200 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {[0, 1, 2, 3].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setVariant(i, { quantity: qty, available: qty > 0 })}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-bold transition cursor-pointer ${
                            (v.quantity ?? 1) === qty
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100"
                          }`}
                        >
                          {qty === 0 ? "Esgotado (0)" : `${qty} un`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-neutral-800">
                    <input
                      type="checkbox"
                      checked={v.available && (v.quantity ?? 1) > 0}
                      onChange={(e) => {
                        const check = e.target.checked;
                        setVariant(i, {
                          available: check,
                          quantity: check ? (v.quantity || 1) : 0,
                        });
                      }}
                      className="h-4 w-4 rounded accent-[#141414] cursor-pointer"
                    />
                    Disponível para venda no site
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ERRO NO FINAL SE HOUVER */}
      {error && (
        <div className="mt-6 flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* BOTÃO DE SALVAR */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-neutral-100 pt-5">
        <button
          type="button"
          onClick={handleBack}
          className="w-full sm:w-auto rounded-xl border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
        >
          Cancelar
        </button>

        <button
          type="submit"
          disabled={upsert.isPending}
          className="w-full sm:w-auto min-w-[200px] flex h-12 items-center justify-center rounded-xl bg-[#1d1d1f] hover:bg-black font-display text-base font-bold text-white shadow-md transition active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {upsert.isPending
            ? "Salvando..."
            : productId != null
              ? "Salvar alterações"
              : "Cadastrar produto"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border border-[#e5e5e7] bg-white px-3.5 py-2.5 text-sm font-medium text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:ring-4 focus:ring-[#0071e3]/15 transition-all";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 cursor-pointer"
    >
      <span
        className={`flex h-6 w-11 items-center rounded-full transition-colors duration-200 p-0.5 ${
          checked ? "justify-end bg-[#0071e3]" : "justify-start bg-neutral-300"
        }`}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow-xs transition-transform" />
      </span>
      <span className="text-sm font-medium text-[#1d1d1f]">{label}</span>
    </button>
  );
}
