import { useMemo, useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import {
  ShieldCheck,
  MessageCircle,
  ChevronLeft,
  BadgeCheck,
  HardDrive,
  Palette,
  Package,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, CATEGORIES } from "@contracts/types";
import { useShopSettings, waLink } from "@/lib/shop";

type Variant = ProductWithVariants["variants"][number];

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const s = useShopSettings();
  const query = trpc.shop.product.useQuery(
    { id: Number(id) },
    { enabled: !!id, staleTime: 1000 * 30 },
  );
  const product = query.data;

  const [version, setVersion] = useState("");
  const [storage, setStorage] = useState("");
  const [color, setColor] = useState("");
  const [showAllInstallments, setShowAllInstallments] = useState(false);

  // Seleção inicial: primeira combinação disponível
  useEffect(() => {
    if (!product) return;
    const first = product.variants.find((v) => v.available) ?? product.variants[0];
    if (first) {
      setVersion(first.version);
      setStorage(first.storage);
      setColor(first.color);
    }
  }, [product]);

  const derived = useMemo(() => {
    if (!product) return null;
    const vs = product.variants;

    const versions = [...new Set(vs.map((v) => v.version))];
    const byVersion = vs.filter((v) => v.version === version);
    const storages = [...new Set(byVersion.map((v) => v.storage))];
    const colors = [...new Set(vs.filter((v) => v.version === version).map((v) => v.color))];

    const storageAvailable = (st: string) =>
      byVersion.some((v) => v.storage === st && v.available);
    const colorAvailable = (c: string) =>
      vs.some(
        (v) =>
          v.version === version &&
          v.color === c &&
          (storage ? v.storage === storage : true) &&
          v.available,
      );
    const colorHex = (c: string) =>
      vs.find((v) => v.version === version && v.color === c)?.colorHex ?? "#111111";

    const selected: Variant | undefined = vs.find(
      (v) => v.version === version && v.storage === storage && v.color === color,
    );

    return { versions, storages, colors, storageAvailable, colorAvailable, colorHex, selected };
  }, [product, version, storage, color]);

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-2">
          <div className="aspect-square animate-pulse rounded-3xl bg-neutral-200" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded bg-neutral-200" />
            <div className="h-5 w-1/3 animate-pulse rounded bg-neutral-200" />
            <div className="h-24 animate-pulse rounded bg-neutral-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!product || !derived) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="font-display text-xl font-bold text-neutral-500">Produto não encontrado</p>
        <Link to="/catalogo" className="mt-4 inline-block font-semibold text-ink underline">
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  const selected = derived.selected;
  const isAvailable = !!selected?.available;
  const price = selected?.priceCash ?? null;
  const maxFee = s.fees[String(s.installmentsMax)] ?? 0;
  const installment =
    price != null && s.installmentsMax > 1
      ? installmentFromFees(price, s.installmentsMax, maxFee)
      : null;
  const categoryLabel =
    CATEGORIES.find((c) => c.value === product.category)?.label ?? product.category;

  const buyMessage = `Olá! Quero comprar o ${product.name}${
    version ? ` ${version}` : ""
  } ${storage} na cor ${color}${price != null ? ` (${formatBRL(price)} à vista)` : ""}. Está disponível?`;

  function pickStorage(st: string) {
    setStorage(st);
    // se a cor atual não combina com o novo armazenamento, escolhe a primeira disponível
    const ok = product!.variants.some(
      (v) => v.version === version && v.storage === st && v.color === color && v.available,
    );
    if (!ok) {
      const first = product!.variants.find(
        (v) => v.version === version && v.storage === st && v.available,
      );
      if (first) setColor(first.color);
    }
  }

  function pickVersion(ver: string) {
    setVersion(ver);
    const first = product!.variants.find((v) => v.version === ver && v.available);
    if (first) {
      setStorage(first.storage);
      setColor(first.color);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <Link
        to="/catalogo"
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar ao catálogo
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* Imagem */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-ink bg-neutral-100 shadow-[6px_6px_0_0_#141414]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="aspect-square w-full object-contain p-4" />
          ) : (
            <div className="flex aspect-square items-center justify-center text-neutral-300">Sem foto</div>
          )}
          <span
            className={`absolute left-4 top-4 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold uppercase tracking-wide ${
              product.condition === "seminovo" ? "bg-white text-ink" : "bg-brand text-ink"
            }`}
          >
            {product.condition === "seminovo" ? "Seminovo" : product.condition === "lacrado" ? "Lacrado" : "Novo"}
          </span>
        </div>

        {/* Detalhes */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
            <span>{product.brand}</span>•<span>{categoryLabel}</span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold text-ink">
            {product.name}
            {version ? <span className="text-neutral-400"> {version}</span> : null}
          </h1>

          {product.warranty && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand/40 px-3 py-1 text-xs font-bold text-ink">
              <ShieldCheck className="h-3.5 w-3.5" /> {product.warranty}
            </p>
          )}

          {/* Preço */}
          <div className="mt-5 rounded-2xl border-2 border-ink bg-white p-5 shadow-[4px_4px_0_0_#141414]">
            {price != null && isAvailable ? (
              <>
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">À vista (PIX ou dinheiro)</p>
                <p className="font-display text-4xl font-bold text-ink">{formatBRL(price)}</p>
                {installment != null && (
                  <p className="mt-1 text-sm font-semibold text-neutral-600">
                    ou em até {s.installmentsMax}x de {formatBRL(installment)} no cartão
                  </p>
                )}
                {s.installmentsMax > 1 && (
                  <button
                    type="button"
                    onClick={() => setShowAllInstallments((v) => !v)}
                    className="mt-2 text-xs font-bold text-ink underline decoration-brand decoration-2 underline-offset-2"
                  >
                    {showAllInstallments ? "Ocultar parcelas ▲" : "Ver todas as parcelas ▼"}
                  </button>
                )}
                {showAllInstallments && (
                  <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-t border-ink/10 pt-3 sm:grid-cols-3">
                    {Array.from({ length: s.installmentsMax }, (_, i) => i + 1).map((n) => {
                      const fee = s.fees[String(n)] ?? 0;
                      const value = installmentFromFees(price, n, fee);
                      return (
                        <p key={n} className="text-xs text-neutral-600">
                          <span className="font-bold text-ink">{n}x</span> de{" "}
                          <span className="font-semibold">{formatBRL(value)}</span>
                          {n === 1 ? " (crédito)" : ""}
                        </p>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="font-display text-xl font-bold text-neutral-400">
                Combinação indisponível no momento
              </p>
            )}
          </div>

          {/* Versões */}
          {derived.versions.filter(Boolean).length > 1 && (
            <OptionGroup icon={<Package className="h-4 w-4" />} label="Versão">
              <div className="flex flex-wrap gap-2">
                {derived.versions.map((ver) => {
                  const any = product.variants.some((v) => v.version === ver && v.available);
                  return (
                    <OptionButton
                      key={ver || "padrao"}
                      active={version === ver}
                      disabled={!any}
                      onClick={() => pickVersion(ver)}
                    >
                      {ver || "Padrão"}
                    </OptionButton>
                  );
                })}
              </div>
            </OptionGroup>
          )}

          {/* Armazenamento */}
          <OptionGroup icon={<HardDrive className="h-4 w-4" />} label="Armazenamento">
            <div className="flex flex-wrap gap-2">
              {derived.storages.map((st) => (
                <OptionButton
                  key={st}
                  active={storage === st}
                  disabled={!derived.storageAvailable(st)}
                  onClick={() => pickStorage(st)}
                >
                  {st}
                </OptionButton>
              ))}
            </div>
          </OptionGroup>

          {/* Cores */}
          <OptionGroup icon={<Palette className="h-4 w-4" />} label={`Cor — ${color || "selecione"}`}>
            <div className="flex flex-wrap gap-2">
              {derived.colors.map((c) => {
                const ok = derived.colorAvailable(c);
                return (
                  <button
                    key={c}
                    disabled={!ok}
                    onClick={() => ok && setColor(c)}
                    className={`flex items-center gap-2 rounded-full border-2 px-3 py-2 text-sm font-semibold transition ${
                      color === c
                        ? "border-ink bg-ink text-brand"
                        : ok
                          ? "border-ink/30 bg-white text-ink hover:border-ink"
                          : "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-300 line-through"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full border border-ink/40 ${ok ? "" : "opacity-40"}`}
                      style={{ backgroundColor: derived.colorHex(c) }}
                    />
                    {c}
                  </button>
                );
              })}
            </div>
          </OptionGroup>

          {/* Comprar */}
          <div className="mt-6 space-y-3">
            {isAvailable ? (
              <>
                <a
                  href={waLink(s.whatsappJardim, buyMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-[#25D366] px-6 py-4 font-display text-lg font-bold text-ink shadow-[4px_4px_0_0_#141414] transition hover:-translate-y-0.5"
                >
                  <MessageCircle className="h-5 w-5" /> Comprar — Loja Jardim
                </a>
                <a
                  href={waLink(s.whatsappGll, buyMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-[#25D366] px-6 py-4 font-display text-lg font-bold text-ink shadow-[4px_4px_0_0_#141414] transition hover:-translate-y-0.5"
                >
                  <MessageCircle className="h-5 w-5" /> Comprar — Loja Guia Lopes
                </a>
              </>
            ) : (
              <a
                href={waLink(
                  s.whatsappJardim,
                  `Olá! Tenho interesse no ${product.name} ${version} ${storage} ${color}. Avise quando chegar?`,
                )}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-ink px-6 py-4 font-display text-lg font-bold text-brand shadow-[4px_4px_0_0_#141414] transition hover:-translate-y-0.5"
              >
                <MessageCircle className="h-5 w-5" /> Avise-me quando chegar
              </a>
            )}
          </div>

          {/* Descrição */}
          {product.description && (
            <div className="mt-8">
              <h2 className="font-display text-lg font-bold text-ink">Sobre este aparelho</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-neutral-600">
                {product.description}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-neutral-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5">
              <BadgeCheck className="h-3.5 w-3.5" /> Aparelho testado
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Garantia da loja
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1.5">
              <Package className="h-3.5 w-3.5" /> Retirada na loja
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionGroup({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink">
        {icon} {label}
      </p>
      {children}
    </div>
  );
}

function OptionButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "border-ink bg-ink text-brand"
          : disabled
            ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-300 line-through"
            : "border-ink/30 bg-white text-ink hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
