import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { CATEGORIES, BRANDS, CONDITIONS, type VariantInput } from "@contracts/types";

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
    { version: "", storage: "128GB", color: "Preto", colorHex: "#1d1d1f", priceReais: "", available: true },
  ],
};

export function detectColorHex(name: string): string | null {
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!n) return null;

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

export default function AdminProductEditor({
  productId,
  onClose,
}: {
  productId: number | null;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState("");

  const products = trpc.admin.products.useQuery();
  const upsert = trpc.admin.upsertProduct.useMutation({
    onSuccess: () => {
      utils.admin.products.invalidate();
      utils.shop.products.invalidate();
      utils.shop.featured.invalidate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  // Carrega produto para edição
  useEffect(() => {
    if (productId == null || !products.data) return;
    const p = products.data.find((x) => x.id === productId);
    if (!p) return;
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
        priceReais: (v.priceCash / 100).toFixed(2).replace(".", ","),
        available: v.available,
      })),
    });
  }, [productId, products.data]);

  function parsePrice(str: string): number {
    const n = Number(str.replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? 0 : Math.round(n * 100);
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
        priceCash: parsePrice(v.priceReais),
        available: v.available,
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

  return (
    <form onSubmit={submit} className="rounded-3xl border-2 border-ink bg-white p-6 shadow-[6px_6px_0_0_#141414]">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h2 className="mt-2 font-display text-2xl font-bold text-ink">
        {productId != null ? "Editar produto" : "Novo produto"}
      </h2>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field label="Nome do produto *">
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: iPhone 15"
            className={inputCls}
          />
        </Field>
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
            onChange={(e) => setForm({ ...form, category: e.target.value as FormState["category"] })}
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
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
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
                  { version: "", storage: "128GB", color: "", colorHex: "#1d1d1f", priceReais: "", available: true },
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

        <div className="mt-4 space-y-3">
          {form.variants.map((v, i) => (
            <div key={i} className="rounded-xl border-2 border-ink/20 bg-neutral-50 p-3">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <input
                  value={v.version}
                  onChange={(e) => setVariant(i, { version: e.target.value })}
                  placeholder="Versão (opcional)"
                  className={miniInputCls}
                />
                <input
                  value={v.storage}
                  onChange={(e) => setVariant(i, { storage: e.target.value })}
                  placeholder="128GB *"
                  required
                  className={miniInputCls}
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
                  }}
                  placeholder="Cor (ex: Natural Titanium, Preto...)"
                  required
                  className={miniInputCls}
                />
                <div className="flex gap-1">
                  <input
                    type="color"
                    value={v.colorHex ?? "#1d1d1f"}
                    onChange={(e) => setVariant(i, { colorHex: e.target.value })}
                    className="h-10 w-10 cursor-pointer rounded-lg border-2 border-ink/20"
                    title="Cor no site"
                  />
                  <input
                    value={v.priceReais}
                    onChange={(e) => setVariant(i, { priceReais: e.target.value })}
                    placeholder="4.899,00 *"
                    required
                    inputMode="decimal"
                    className={miniInputCls}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <input
                      type="checkbox"
                      checked={v.available}
                      onChange={(e) => setVariant(i, { available: e.target.checked })}
                      className="h-4 w-4 accent-[#141414]"
                    />
                    Disponível
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, variants: form.variants.filter((_, idx) => idx !== i) })
                    }
                    className="rounded-lg p-1.5 text-red-500 hover:bg-red-100"
                    aria-label="Remover variante"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
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
const miniInputCls =
  "w-full rounded-lg border-2 border-ink/20 px-3 py-2 text-sm font-medium outline-none focus:border-ink bg-white";

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
