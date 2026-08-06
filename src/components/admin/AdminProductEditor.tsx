import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Plus, Trash2, Sparkles, RefreshCw, CheckCircle2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { CATEGORIES, BRANDS, CONDITIONS, type VariantInput } from "@contracts/types";
import { IPHONE_CATALOG } from "@/lib/iphoneCatalog";

type FormState = {
  name: string;
  brand: string;
  category: (typeof CATEGORIES)[number]["value"];
  condition: string;
  description: string;
  imageUrl: string;
  warranty: string;
  featured: boolean;
  active: boolean;
  variants: (Omit<VariantInput, "priceCash"> & { priceReais: string })[];
};

const EMPTY: FormState = {
  name: "",
  brand: "Apple",
  category: "iphone_lacrado",
  condition: "lacrado",
  description: "",
  imageUrl: "",
  warranty: "1 ano de garantia",
  featured: false,
  active: true,
  variants: [
    { version: "", storage: "128GB", color: "Preto", colorHex: "#1d1d1f", batteryHealth: "85%", warranty: "", notes: "", priceReais: "", available: true },
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

  const isHydrated = useRef(false);
  const [autoRestored, setAutoRestored] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const selectedModel = IPHONE_CATALOG.find(
    (m) => m.name.toLowerCase() === form.name.toLowerCase().trim(),
  );

  const matchedModels = form.name.trim()
    ? IPHONE_CATALOG.filter((m) =>
        m.name.toLowerCase().includes(form.name.toLowerCase().trim()),
      )
    : IPHONE_CATALOG;

  function selectModel(m: (typeof IPHONE_CATALOG)[number]) {
    const defaultStorage = m.capacities[0] || "128GB";
    const firstColor = m.colors[0] || { name: "Preto", hex: "#1d1d1f" };
    const isSeminovo = form.condition === "seminovo" || form.category === "iphone_seminovo";

    const initialVariant = {
      version: "",
      storage: defaultStorage,
      color: firstColor.name,
      colorHex: firstColor.hex,
      imageUrl: firstColor.imageUrl ?? "",
      batteryHealth: isSeminovo ? "85%" : "",
      warranty: "",
      notes: "",
      priceReais: "",
      quantity: 1,
      available: true,
    };

    setForm((f) => ({
      ...f,
      name: m.name,
      brand: "Apple",
      category: isSeminovo ? "iphone_seminovo" : "iphone_lacrado",
      condition: isSeminovo ? "seminovo" : "lacrado",
      warranty: isSeminovo ? "6 meses de garantia" : "1 ano de garantia",
      variants: [initialVariant],
    }));
    setShowNameDropdown(false);
  }

  function addAllModelColors(m: (typeof IPHONE_CATALOG)[number]) {
    const defaultStorage = m.capacities[0] || "128GB";
    const isSeminovo = form.condition === "seminovo" || form.category === "iphone_seminovo";
    const generatedVariants = m.colors.map((c) => ({
      version: "",
      storage: defaultStorage,
      color: c.name,
      colorHex: c.hex,
      imageUrl: c.imageUrl ?? "",
      batteryHealth: isSeminovo ? "85%" : "",
      warranty: "",
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
          warranty: p.warranty ?? "",
          featured: p.featured,
          active: p.active,
          variants: p.variants.map((v) => ({
            version: v.version,
            storage: v.storage,
            color: v.color,
            colorHex: v.colorHex ?? "#1d1d1f",
            imageUrl: v.imageUrl ?? "",
            batteryHealth: v.batteryHealth ?? "",
            warranty: v.warranty ?? "",
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
            parsed.form.variants?.some((v: any) => v.priceReais || v.color);
          if (hasContent) {
            const sanitizedVariants = (parsed.form.variants || []).map((v: any) => ({
              version: v.version ?? "",
              storage: v.storage ?? "128GB",
              color: v.color ?? "Preto",
              colorHex: v.colorHex ?? "#1d1d1f",
              imageUrl: v.imageUrl ?? "",
              batteryHealth: v.batteryHealth ?? "",
              warranty: v.warranty ?? "",
              notes: v.notes ?? "",
              priceReais: formatCurrencyInput(v.priceReais ?? ""),
              quantity: typeof v.quantity === "number" ? v.quantity : 1,
              available: v.available ?? true,
            }));

            setForm({
              ...parsed.form,
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

  // Salva rascunho no localStorage em tempo real ao editar
  useEffect(() => {
    if (!isHydrated.current) return;

    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ form, updatedAt: new Date().toISOString() })
      );
      setIsDirty(true);
    } catch {
      // ignore
    }
  }, [form, draftKey]);

  // Avisa antes de recarregar a página ou fechar a aba se houver edições não salvas
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
          warranty: p.warranty ?? "",
          featured: p.featured,
          active: p.active,
          variants: p.variants.map((v) => ({
            version: v.version,
            storage: v.storage,
            color: v.color,
            colorHex: v.colorHex ?? "#1d1d1f",
            imageUrl: v.imageUrl ?? "",
            batteryHealth: v.batteryHealth ?? "",
            warranty: v.warranty ?? "",
            notes: v.notes ?? "",
            priceReais: (v.priceCash / 100).toFixed(2).replace(".", ","),
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
    const variants = form.variants
      .filter((v) => v.storage.trim() && v.color.trim())
      .map((v) => ({
        version: v.version,
        storage: v.storage,
        color: v.color,
        colorHex: v.colorHex,
        imageUrl: v.imageUrl,
        batteryHealth: v.batteryHealth,
        warranty: v.warranty,
        notes: v.notes,
        priceCash: parsePrice(v.priceReais),
        quantity: typeof v.quantity === "number" ? Math.max(0, v.quantity) : 1,
        available: (v.quantity ?? 1) > 0 && v.available,
      }));
    if (variants.length === 0) {
      setError("Adicione pelo menos uma variante (armazenamento + cor).");
      return;
    }
    if (variants.some((v) => v.priceCash <= 0)) {
      setError("Todas as variantes precisam de preço maior que zero.");
      return;
    }
    upsert.mutate({
      ...(productId != null ? { id: productId } : {}),
      name: form.name,
      brand: form.brand,
      category: form.category,
      condition: form.condition,
      description: form.description,
      imageUrl: form.imageUrl,
      warranty: form.warranty,
      featured: form.featured,
      active: form.active,
      variants,
    });
  }

  function setVariant(i: number, patch: Partial<FormState["variants"][number]>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    }));
  }

  function handleBack() {
    if (isDirty) {
      const confirmLeave = window.confirm(
        "Suas alterações estão salvas com segurança. Deseja voltar para a lista de produtos?"
      );
      if (!confirmLeave) return;
    }
    onClose();
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[6px_6px_0_0_#141414]">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-ink transition"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        {isDirty && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Alterações salvas automaticamente
          </span>
        )}
      </div>

      {autoRestored && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-blue-400 bg-blue-50 p-4 text-blue-950 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-200 text-blue-900 font-bold text-lg">
              ✨
            </div>
            <div>
              <p className="text-sm font-bold">Dados restaurados automaticamente!</p>
              <p className="text-xs text-blue-800">
                Seus dados preenchidos anteriormente foram recuperados de onde você parou.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={discardDraft}
            className="inline-flex items-center gap-1 rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-xs font-bold text-blue-800 hover:bg-blue-100 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Recarregar Original
          </button>
        </div>
      )}

      <h2 className="mt-4 font-display text-2xl font-bold text-ink">
        {productId != null ? "Editar produto" : "Novo produto"}
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {/* NOME DO PRODUTO COM DROPDOWN INTELIGENTE */}
        <div className="relative">
          <Field label="Nome do produto *">
            <input
              required
              value={form.name}
              onFocus={() => setShowNameDropdown(true)}
              onBlur={() => setTimeout(() => setShowNameDropdown(false), 200)}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                setShowNameDropdown(true);
              }}
              placeholder="Digite ex: iPhone 16 Pro Max..."
              className={inputCls}
            />
          </Field>
          {showNameDropdown && matchedModels.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-2xl border-2 border-ink bg-white shadow-xl">
              <div className="bg-neutral-100 px-3 py-1.5 text-[11px] font-bold uppercase text-neutral-500">
                Modelos Apple Sugeridos (clique para preencher):
              </div>
              {matchedModels.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectModel(m);
                  }}
                  className="flex w-full items-center justify-between border-b border-neutral-100 px-4 py-2.5 text-left text-sm font-semibold text-ink transition hover:bg-brand/30"
                >
                  <span className="font-bold">📱 {m.name}</span>
                  <span className="truncate max-w-[200px] text-xs text-neutral-500">
                    {m.colors.map((c) => c.name).join(", ")}
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
        <Field label="Categoria *">
          <select
            value={form.category}
            onChange={(e) => {
              const cat = e.target.value as FormState["category"];
              const isSeminovo = cat === "iphone_seminovo";
              setForm((f) => ({
                ...f,
                category: cat,
                condition: isSeminovo ? "seminovo" : "lacrado",
                warranty: isSeminovo ? "6 meses de garantia" : "1 ano de garantia",
              }));
            }}
            className={inputCls}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Condição *">
          <select
            value={form.condition}
            onChange={(e) => {
              const cond = e.target.value;
              const isSeminovo = cond === "seminovo";
              setForm((f) => ({
                ...f,
                condition: cond,
                category: isSeminovo ? "iphone_seminovo" : "iphone_lacrado",
                warranty: isSeminovo ? "6 meses de garantia" : "1 ano de garantia",
              }));
            }}
            className={inputCls}
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </Field>
        <Field label="URL da imagem">
          <input
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
            className={inputCls}
          />
        </Field>
        <Field label="Garantia">
          <input
            value={form.warranty}
            onChange={(e) => setForm({ ...form, warranty: e.target.value })}
            placeholder="1 ano de garantia"
            className={inputCls}
          />
        </Field>
      </div>

      {form.imageUrl && (
        <img
          src={form.imageUrl}
          alt="Prévia"
          className="mt-4 h-32 w-32 rounded-xl border-2 border-ink object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      )}

      <Field label="Descrição" className="mt-4">
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          placeholder="Detalhes do aparelho, estado, bateria, acessórios inclusos..."
          className={inputCls}
        />
      </Field>

      <div className="mt-4 flex flex-wrap gap-6">
        <Toggle
          checked={form.active}
          onChange={(v) => setForm({ ...form, active: v })}
          label="Visível no site"
        />
        <Toggle
          checked={form.featured}
          onChange={(v) => setForm({ ...form, featured: v })}
          label="Destaque na página inicial"
        />
      </div>

      {/* VARIANTES */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">Variantes</h3>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                variants: [
                  ...form.variants,
                  { version: "", storage: selectedModel?.capacities[0] || "128GB", color: "", colorHex: "#1d1d1f", priceReais: "", available: true },
                ],
              })
            }
            className="inline-flex items-center gap-1 rounded-lg border-2 border-ink bg-brand px-3 py-1.5 text-xs font-bold text-ink"
          >
            <Plus className="h-3.5 w-3.5" /> Variante
          </button>
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Cada linha é uma combinação de versão + armazenamento + cor + preço. Desmarque
          "Disponível" para aparecer no site como opção esgotada (não clicável).
        </p>

        {/* CORES OFICIAIS DO MODELO */}
        <div className="mt-4 rounded-2xl border-2 border-ink bg-neutral-50 p-4">
          {selectedModel ? (
            <div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-ink">
                  🎨 Cores Oficiais do {selectedModel.name}:
                </p>
                <button
                  type="button"
                  onClick={() => addAllModelColors(selectedModel)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-ink underline hover:text-brand"
                >
                  <Sparkles className="h-3.5 w-3.5 text-brand" /> Preencher todas as cores do {selectedModel.name}
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-2">
                {selectedModel.colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        variants: [
                          ...f.variants,
                          {
                            version: "",
                            storage: f.variants[f.variants.length - 1]?.storage || selectedModel.capacities[0] || "128GB",
                            color: c.name,
                            colorHex: c.hex,
                            priceReais: "",
                            available: true,
                          },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-[2px_2px_0_0_#141414] transition hover:bg-brand"
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-ink/30"
                      style={{ backgroundColor: c.hex }}
                    />
                    + {c.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                💡 Clique para adicionar uma cor comum:
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[
                  { name: "Preto", hex: "#1d1d1f" },
                  { name: "Branco", hex: "#f7f7f7" },
                  { name: "Dourado", hex: "#fae7cf" },
                  { name: "Prateado", hex: "#e2e4e1" },
                  { name: "Grafite", hex: "#545351" },
                  { name: "Azul", hex: "#a7c1d9" },
                  { name: "Rosa", hex: "#faddd7" },
                  { name: "Verde", hex: "#475c4d" },
                  { name: "Roxo", hex: "#63587b" },
                ].map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        variants: [
                          ...f.variants,
                          {
                            version: "",
                            storage: f.variants[f.variants.length - 1]?.storage || "128GB",
                            color: c.name,
                            colorHex: c.hex,
                            priceReais: "",
                            available: true,
                          },
                        ],
                      }))
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-ink/30 bg-white px-2.5 py-1 text-xs font-semibold text-ink transition hover:border-ink hover:bg-brand/20"
                  >
                    <span
                      className="h-3 w-3 rounded-full border border-ink/30"
                      style={{ backgroundColor: c.hex }}
                    />
                    + {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DATALISTS PARA AUTOCOMPLETE */}
        <datalist id="storages_list">
          {(selectedModel ? selectedModel.capacities : ["64GB", "128GB", "256GB", "512GB", "1TB"]).map((cap) => (
            <option key={cap} value={cap} />
          ))}
        </datalist>

        <datalist id="colors_list">
          {(selectedModel
            ? selectedModel.colors
            : [
                { name: "Preto" },
                { name: "Branco" },
                { name: "Dourado" },
                { name: "Prateado" },
                { name: "Grafite" },
                { name: "Azul" },
                { name: "Rosa" },
                { name: "Verde" },
                { name: "Roxo" },
              ]
          ).map((c) => (
            <option key={c.name} value={c.name} />
          ))}
        </datalist>

        <div className="mt-4 space-y-4">
          {form.variants.map((v, i) => (
            <div
              key={i}
              className="rounded-2xl border-2 border-ink bg-white p-4 shadow-[4px_4px_0_0_#141414] transition"
            >
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-xs font-black text-ink">
                    {i + 1}
                  </span>
                  <span className="font-display text-sm font-bold text-ink">
                    Variante: {v.color || "Sem Cor"} — {v.storage || "Sem Armazenamento"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir variante
                </button>
              </div>

              {/* ESPECIFICAÇÕES PRINCIPAIS */}
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                <Field label="Armazenamento *">
                  <input
                    value={v.storage}
                    list="storages_list"
                    onChange={(e) => setVariant(i, { storage: e.target.value })}
                    placeholder="ex: 128GB, 256GB..."
                    required
                    className={inputCls}
                  />
                </Field>

                <Field label="Cor do Aparelho *">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={v.colorHex ?? "#1d1d1f"}
                      onChange={(e) => setVariant(i, { colorHex: e.target.value })}
                      className="h-10 w-12 cursor-pointer shrink-0 rounded-xl border-2 border-ink/30 bg-white"
                      title="Escolher tom da cor no site"
                    />
                    <input
                      value={v.color}
                      list="colors_list"
                      onChange={(e) => {
                        const newColor = e.target.value;
                        const autoHex = detectColorHex(newColor);
                        setVariant(i, {
                          color: newColor,
                          ...(autoHex ? { colorHex: autoHex } : {}),
                        });
                      }}
                      placeholder="ex: Titânio-deserto, Preto..."
                      required
                      className={inputCls}
                    />
                  </div>
                </Field>

                <Field label="Preço à Vista (R$) *">
                  <input
                    value={v.priceReais}
                    onChange={(e) => {
                      const masked = formatCurrencyInput(e.target.value);
                      setVariant(i, { priceReais: masked });
                    }}
                    placeholder="2.899,99"
                    required
                    inputMode="numeric"
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* ESTOQUE E BATERIA */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="📦 Quantidade em Estoque (Unidades) *">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newQ = Math.max(0, (v.quantity ?? 1) - 1);
                          setVariant(i, { quantity: newQ, available: newQ > 0 });
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-neutral-100 font-bold text-ink hover:bg-neutral-200"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        value={v.quantity ?? 1}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setVariant(i, { quantity: val, available: val > 0 });
                        }}
                        className="h-10 w-16 rounded-xl border-2 border-ink text-center text-sm font-bold outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const newQ = (v.quantity ?? 1) + 1;
                          setVariant(i, { quantity: newQ, available: true });
                        }}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-neutral-100 font-bold text-ink hover:bg-neutral-200"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {[0, 1, 2, 3, 5].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setVariant(i, { quantity: qty, available: qty > 0 })}
                          className={`rounded-lg border-2 px-2.5 py-1 text-xs font-bold ${
                            (v.quantity ?? 1) === qty
                              ? "border-ink bg-ink text-brand shadow-[1px_1px_0_0_#141414]"
                              : "border-neutral-300 bg-neutral-100 text-ink hover:bg-neutral-200"
                          }`}
                        >
                          {qty === 0 ? "0 (Esgotado)" : `${qty} un`}
                        </button>
                      ))}
                    </div>
                  </div>
                </Field>

                <Field label="🔋 Saúde da Bateria">
                  <input
                    value={v.batteryHealth ?? ""}
                    onChange={(e) => setVariant(i, { batteryHealth: e.target.value })}
                    placeholder="ex: 85%, 100%, Bateria Nova"
                    className={inputCls}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["100%", "95%", "90%", "88%", "85%", "82%", "Bateria Nova"].map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setVariant(i, { batteryHealth: b })}
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition ${
                          v.batteryHealth === b
                            ? "border-emerald-600 bg-emerald-500 text-white"
                            : "border-neutral-200 bg-neutral-100 text-ink hover:bg-neutral-200"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* GARANTIA E OBSERVAÇÕES INDIVIDUAIS */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="🛡️ Garantia desta Variante (opcional)">
                  <input
                    value={v.warranty ?? ""}
                    onChange={(e) => setVariant(i, { warranty: e.target.value })}
                    placeholder="ex: 3 meses de garantia, 1 ano, Garantia Apple Nov/2026"
                    className={inputCls}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["3 meses de garantia", "6 meses de garantia", "1 ano de garantia", "Garantia Apple"].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setVariant(i, { warranty: g })}
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition ${
                          v.warranty === g
                            ? "border-blue-600 bg-blue-500 text-white"
                            : "border-neutral-200 bg-neutral-100 text-ink hover:bg-neutral-200"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="📝 Observações / Detalhes desta Variante (opcional)">
                  <input
                    value={v.notes ?? ""}
                    onChange={(e) => setVariant(i, { notes: e.target.value })}
                    placeholder="ex: Sem marcas de uso, Com caixa e cabo, Tela trocada..."
                    className={inputCls}
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {["Sem marcas de uso", "Com caixa e cabo", "Bateria trocada", "Detalhe mínimo na carcaça"].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setVariant(i, { notes: n })}
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition ${
                          v.notes === n
                            ? "border-amber-600 bg-amber-500 text-white"
                            : "border-neutral-200 bg-neutral-100 text-ink hover:bg-neutral-200"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* FOTO EXCLUSIVA E VERSÃO */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="🖼️ Foto desta Cor (URL Opcional)">
                  <input
                    value={v.imageUrl ?? ""}
                    onChange={(e) => setVariant(i, { imageUrl: e.target.value })}
                    placeholder="https://i.ibb.co/..."
                    className={inputCls}
                  />
                </Field>

                <Field label="Versão (opcional)">
                  <input
                    value={v.version}
                    onChange={(e) => setVariant(i, { version: e.target.value })}
                    placeholder="ex: Pro, Pro Max..."
                    className={inputCls}
                  />
                </Field>
              </div>

              {/* MINIATURA DA FOTO DA COR */}
              {v.imageUrl && (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-2">
                  <img
                    src={v.imageUrl}
                    alt="Foto da cor"
                    className="h-12 w-12 rounded-lg border-2 border-ink bg-white object-contain p-0.5"
                    onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                  />
                  <div>
                    <p className="text-xs font-bold text-emerald-900">
                      ✓ Foto exclusiva cadastrada para a cor: {v.color || "esta variante"}!
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Quando o cliente selecionar essa cor no site, a foto vai trocar automaticamente.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-ink">
                  <input
                    type="checkbox"
                    checked={v.available && (v.quantity ?? 1) > 0}
                    onChange={(e) => {
                      const check = e.target.checked;
                      setVariant(i, { available: check, quantity: check ? (v.quantity || 1) : 0 });
                    }}
                    className="h-4 w-4 rounded accent-[#141414]"
                  />
                  Disponível para venda em estoque
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={upsert.isPending}
        className="mt-6 w-full rounded-xl border-2 border-ink bg-ink py-4 font-display text-lg font-bold text-brand shadow-[4px_4px_0_0_rgba(20,20,20,0.3)] transition hover:-translate-y-0.5 disabled:opacity-50"
      >
        {upsert.isPending ? "Salvando..." : productId != null ? "Salvar alterações" : "Cadastrar produto"}
      </button>
    </form>
  );
}

const inputCls =
  "w-full rounded-xl border-2 border-ink/30 px-4 py-2.5 text-sm font-medium outline-none focus:border-ink bg-white";

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
      <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-neutral-500">
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
      className="flex items-center gap-2"
    >
      <span
        className={`flex h-6 w-11 items-center rounded-full border-2 border-ink px-0.5 transition ${
          checked ? "justify-end bg-brand" : "justify-start bg-neutral-200"
        }`}
      >
        <span className="h-4 w-4 rounded-full bg-ink" />
      </span>
      <span className="text-sm font-semibold text-ink">{label}</span>
    </button>
  );
}
