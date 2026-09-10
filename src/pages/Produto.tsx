import { useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import {
  ShieldCheck,
  MessageCircle,
  ChevronLeft,
  BadgeCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, CATEGORIES } from "@contracts/types";
import { useShopSettings, waLink, optimizeImageUrl, getImageSrcSet } from "@/lib/shop";
import { DEMO_PRODUCTS } from "@/lib/catalogDemo";
import SEO from "@/components/SEO";

type Variant = ProductWithVariants["variants"][number];

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);

  const demoFallback = useMemo(() => {
    if (Number.isNaN(numericId)) return undefined;
    return (
      DEMO_PRODUCTS.find((p) => p.id === numericId) ||
      DEMO_PRODUCTS.find((p) => p.id === Math.abs(numericId)) ||
      (numericId < 0 ? DEMO_PRODUCTS[0] : undefined)
    );
  }, [numericId]);

  const isDemo = !!demoFallback;
  const isValidId = (!Number.isNaN(numericId) && numericId > 0) || isDemo;

  const s = useShopSettings();
  const query = trpc.shop.product.useQuery(
    { id: numericId > 0 ? numericId : 1 },
    {
      enabled: !Number.isNaN(numericId) && numericId > 0 && !isDemo,
      staleTime: 1000 * 30,
    },
  );

  const product = useMemo(() => {
    if (query.data) return query.data as ProductWithVariants;
    if (demoFallback) return demoFallback as unknown as ProductWithVariants;
    return null;
  }, [query.data, demoFallback]);

  // Gerenciamento de seleção sem useEffect (compatível com React 19)
  const [selectedProductId, setSelectedProductId] = useState<number>(numericId);
  const [userVersion, setUserVersion] = useState<string | null>(null);
  const [userStorage, setUserStorage] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<string | null>(null);
  const [userVariantId, setUserVariantId] = useState<number | null>(null);
  const [showAllInstallments, setShowAllInstallments] = useState(false);

  if (selectedProductId !== numericId) {
    setSelectedProductId(numericId);
    setUserVersion(null);
    setUserStorage(null);
    setUserColor(null);
    setUserVariantId(null);
    setShowAllInstallments(false);
  }

  const defaultVariant = useMemo(() => {
    if (!product || product.variants.length === 0) return null;
    return (
      product.variants.find((v) => v.available && (v.quantity ?? 1) > 0) ??
      product.variants[0]
    );
  }, [product]);

  const version = userVersion ?? defaultVariant?.version ?? "";
  const storage = userStorage ?? defaultVariant?.storage ?? "";
  const color = userColor ?? defaultVariant?.color ?? "";
  const selectedVariantId = userVariantId ?? defaultVariant?.id ?? null;

  const derived = useMemo(() => {
    if (!product) return null;
    const vs = product.variants;

    const versions = [...new Set(vs.map((v) => v.version))];
    const byVersion = vs.filter((v) => v.version === version);
    const storages = [...new Set(byVersion.map((v) => v.storage))];
    const colors = [...new Set(vs.filter((v) => v.version === version).map((v) => v.color))];

    const storageAvailable = (st: string) =>
      byVersion.some((v) => v.storage === st && v.available && (v.quantity ?? 1) > 0);
    const colorAvailable = (c: string) =>
      vs.some(
        (v) =>
          v.version === version &&
          v.color === c &&
          v.available &&
          (v.quantity ?? 1) > 0,
      );
    const colorHex = (c: string) =>
      vs.find((v) => v.version === version && v.color === c)?.colorHex ?? "#111111";

    const matchingVariants = vs.filter(
      (v) => v.version === version && v.storage === storage && v.color === cMatch(color, vs, version, storage),
    );

    const selected =
      matchingVariants.find((v) => v.id === selectedVariantId) ??
      matchingVariants.find((v) => v.available && (v.quantity ?? 1) > 0) ??
      matchingVariants[0] ??
      vs.find((v) => v.version === version && v.storage === storage && v.color === color) ??
      vs[0];

    return { versions, storages, colors, storageAvailable, colorAvailable, colorHex, matchingVariants, selected };
  }, [product, version, storage, color, selectedVariantId]);

  function cMatch(c: string, vs: Variant[], ver: string, st: string) {
    if (vs.some((v) => v.version === ver && v.storage === st && v.color === c)) return c;
    const first = vs.find((v) => v.version === ver && v.storage === st && v.available);
    return first ? first.color : c;
  }

  function pickStorage(st: string) {
    setUserStorage(st);
    if (!product) return;
    const match = product.variants.find(
      (v) =>
        v.version === version &&
        v.storage === st &&
        v.color === color &&
        v.available &&
        (v.quantity ?? 1) > 0,
    );
    if (match) {
      setUserVariantId(match.id ?? null);
    } else {
      const first = product.variants.find(
        (v) =>
          v.version === version &&
          v.storage === st &&
          v.available &&
          (v.quantity ?? 1) > 0,
      );
      if (first) {
        setUserColor(first.color);
        setUserVariantId(first.id ?? null);
      }
    }
  }

  function pickColor(c: string) {
    setUserColor(c);
    if (!product) return;
    const match = product.variants.find(
      (v) =>
        v.version === version &&
        v.storage === storage &&
        v.color === c &&
        v.available &&
        (v.quantity ?? 1) > 0,
    );
    if (match) {
      setUserVariantId(match.id ?? null);
    } else {
      const first = product.variants.find(
        (v) =>
          v.version === version &&
          v.color === c &&
          v.available &&
          (v.quantity ?? 1) > 0,
      );
      if (first) {
        setUserStorage(first.storage);
        setUserVariantId(first.id ?? null);
      }
    }
  }

  function pickVersion(ver: string) {
    setUserVersion(ver);
    if (!product) return;
    const first =
      product.variants.find((v) => v.version === ver && v.available && (v.quantity ?? 1) > 0) ??
      product.variants.find((v) => v.version === ver) ??
      product.variants[0];
    if (first) {
      setUserStorage(first.storage);
      setUserColor(first.color);
      setUserVariantId(first.id ?? null);
    }
  }

  const selected = derived?.selected;
  const isAvailable = !!selected?.available && (selected?.quantity ?? 1) > 0;
  const price = selected?.priceCash ?? null;
  const maxFee = s.fees[String(s.installmentsMax)] ?? 0;
  const fee12 = s.fees["12"] ?? maxFee;
  const installment12 = price != null ? installmentFromFees(price, 12, fee12) : null;

  const isLacrado =
    selected?.condition === "lacrado" || product?.condition === "lacrado";
  const isIphone =
    product?.brand.toLowerCase() === "apple" ||
    (product?.name.toLowerCase().includes("iphone") ?? false);
  const batteryHealthDisplay =
    selected?.batteryHealth ||
    (isLacrado && isIphone ? "100%" : !isLacrado && isIphone ? "85%+" : null);

  const categoryLabel = product
    ? (CATEGORIES.find((c) => c.value === product.category)?.label ?? product.category)
    : "";

  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";
  const conditionLabel = isLacrado ? "Lacrado" : "Seminovo";
  const formattedPrice = price != null ? formatBRL(price) : "";
  const buyMessage = product
    ? `Olá! Vi na vitrine da Lojinha do Celular o ${product.name}${
        storage && storage !== "Padrão" ? ` ${storage}` : ""
      }${color ? ` ${color}` : ""} (${conditionLabel}${
        formattedPrice ? ` - ${formattedPrice}` : ""
      }) e gostaria de fechar o pedido!`
    : "";

  const prodTitle = product
    ? `${product.name}${version && !product.name.includes(version) ? ` ${version}` : ""}${
        storage && storage !== "Padrão" ? ` ${storage}` : ""
      }${color ? ` ${color}` : ""}`
    : "";
  const prodDesc = product
    ? product.description ||
      `Compre ${product.name} na Lojinha do Celular com garantia e melhor preço em Jardim-MS e Guia Lopes da Laguna.`
    : "";
  const prodImage = selected?.imageUrl || product?.imageUrl || "/images/logo.png";
  const prodUrl = typeof window !== "undefined" ? window.location.href : "";

  const productJsonLd = useMemo(() => {
    if (!product) return undefined;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      name: prodTitle,
      image:
        prodImage.startsWith("/") && typeof window !== "undefined"
          ? `${window.location.origin}${prodImage}`
          : prodImage,
      description: prodDesc,
      brand: {
        "@type": "Brand",
        name: product.brand,
      },
      offers: {
        "@type": "Offer",
        priceCurrency: "BRL",
        price: price != null ? (price / 100).toFixed(2) : undefined,
        itemCondition: isLacrado
          ? "https://schema.org/NewCondition"
          : "https://schema.org/UsedCondition",
        availability: isAvailable
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    };
  }, [product, prodTitle, prodDesc, prodImage, price, isLacrado, isAvailable]);

  const isLoading = query.isLoading && !product;
  const isError = query.isError && !product;

  if (!isValidId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white pt-6 pb-16 px-4">
        <div className="mx-auto max-w-5xl text-center py-20">
          <p className="font-display text-xl font-bold text-neutral-400">
            Endereço de produto inválido
          </p>
          <Link
            to="/#vitrine"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition"
          >
            <ChevronLeft className="h-4 w-4" /> Loja
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white pt-6 pb-16 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="h-4 w-16 animate-pulse rounded bg-white/10 mb-6" />
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="aspect-square w-full rounded-3xl bg-white/5 border border-white/10 animate-pulse" />
            <div className="space-y-4">
              <div className="h-6 w-1/3 animate-pulse rounded-full bg-white/10" />
              <div className="h-10 w-3/4 animate-pulse rounded bg-white/10" />
              <div className="h-24 animate-pulse rounded-2xl bg-white/5 border border-white/10" />
              <div className="h-12 animate-pulse rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white pt-6 pb-16 px-4">
        <div className="mx-auto max-w-md text-center py-20">
          <div className="rounded-3xl border border-white/10 bg-[#141414] p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-white">
              Erro ao carregar detalhes do produto
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Não foi possível comunicar com o servidor. Tente novamente em instantes.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => query.refetch()}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-black hover:bg-neutral-200 transition cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" /> Recarregar
              </button>
              <Link
                to="/#vitrine"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition"
              >
                Voltar à loja
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product || !derived) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white pt-6 pb-16 px-4">
        <div className="mx-auto max-w-5xl text-center py-20">
          <p className="font-display text-xl font-bold text-neutral-400">
            Produto não encontrado
          </p>
          <Link
            to="/#vitrine"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition"
          >
            <ChevronLeft className="h-4 w-4" /> Loja
          </Link>
        </div>
      </div>
    );
  }

  const showStorages = derived.storages.filter(Boolean).length > 0;
  const showColors = derived.colors.filter(Boolean).length > 0;

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white pt-6 pb-16 px-4">
      <SEO
        title={prodTitle}
        description={prodDesc}
        image={prodImage}
        url={prodUrl}
        jsonLd={productJsonLd}
      />

      <div className="max-w-5xl mx-auto">
        {/* Botão de retorno discreto no topo: ← Loja */}
        <Link
          to="/#vitrine"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white transition"
        >
          <ChevronLeft className="h-4 w-4" /> Loja
        </Link>

        {/* Grid em 2 colunas no desktop */}
        <div className="grid md:grid-cols-2 gap-8 items-start max-w-5xl mx-auto mt-4">
          {/* Coluna da Esquerda (Foto) */}
          <div className="aspect-square w-full rounded-3xl bg-white p-6 sm:p-8 flex items-center justify-center shadow-xl overflow-hidden relative">
            {selected?.imageUrl || product.imageUrl ? (
              <img
                src={optimizeImageUrl(selected?.imageUrl || product.imageUrl!, 800, 85)}
                srcSet={getImageSrcSet(selected?.imageUrl || product.imageUrl!)}
                sizes="(max-width: 768px) 100vw, 500px"
                alt={product.name}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={(e) => {
                  const raw = selected?.imageUrl || product.imageUrl;
                  if (raw && e.currentTarget.src !== raw) {
                    e.currentTarget.src = raw;
                  }
                }}
                className="h-full w-full object-contain transition-all duration-300"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-medium text-neutral-400">
                Sem foto
              </div>
            )}
          </div>

          {/* Coluna da Direita (Configuração e Compra) */}
          <div className="flex flex-col">
            {/* Badges no topo */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Condição */}
              {isLacrado ? (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-white text-black">
                  ✨ Lacrado
                </span>
              ) : (
                <span className="rounded-full px-3 py-1 text-xs font-semibold border border-white/20 bg-white/10 text-white">
                  🔄 Seminovo
                </span>
              )}

              {/* Saúde da Bateria */}
              {batteryHealthDisplay && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  🔋 {batteryHealthDisplay}
                </span>
              )}

              {/* Garantia */}
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 text-xs font-medium text-amber-400">
                🛡️ {selected?.warranty || product.warranty || "1 Ano de Garantia"}
              </span>
            </div>

            {/* Categoria / Marca */}
            <div className="mt-2 text-xs font-medium uppercase tracking-wider text-neutral-400">
              {product.brand} {categoryLabel ? `• ${categoryLabel}` : ""}
            </div>

            {/* Título do Produto */}
            <h1 className="font-display text-2xl sm:text-4xl font-bold text-white mt-1">
              {product.name}
            </h1>

            {/* Bloco de Preço */}
            <div className="mt-4 rounded-2xl border border-white/10 bg-[#141414] p-5">
              {price != null && isAvailable ? (
                <>
                  {/* Selo de Pix */}
                  <div>
                    <span className="inline-block rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 mb-1">
                      10% OFF no Pix
                    </span>
                  </div>

                  {/* Preço à vista destacado */}
                  <p className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                    {formatBRL(price)}
                  </p>

                  {/* Subtítulo */}
                  <p className="text-sm text-neutral-400">
                    à vista no Pix ou dinheiro
                  </p>

                  {/* Parcelamento no cartão */}
                  <p className="text-sm text-neutral-300 mt-2">
                    ou até 12x de {formatBRL(installment12 ?? 0)} no cartão
                  </p>

                  {/* Botão retrátil para ver tabela completa de parcelas */}
                  {s.installmentsMax > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllInstallments((v) => !v)}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-neutral-400 hover:text-white underline decoration-white/30 underline-offset-4 transition cursor-pointer"
                    >
                      {showAllInstallments
                        ? "Ocultar tabela de parcelas ▲"
                        : "Ver parcelas de 1x a 12x no cartão ▼"}
                    </button>
                  )}

                  {showAllInstallments && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-xl border border-white/10 bg-[#18181b] p-3 text-xs">
                      {Array.from(
                        { length: Math.min(s.installmentsMax, 12) },
                        (_, i) => i + 1,
                      ).map((n) => {
                        const fee = s.fees[String(n)] ?? 0;
                        const val = installmentFromFees(price, n, fee);
                        return (
                          <div
                            key={n}
                            className="flex items-center justify-between gap-1 text-neutral-400"
                          >
                            <span className="font-semibold text-white">{n}x</span>
                            <span className="text-neutral-200">{formatBRL(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <p className="font-display text-lg font-semibold text-neutral-400">
                  Combinação indisponível no momento
                </p>
              )}
            </div>

            {/* Seletores */}
            {/* Versão (se houver mais de uma versão) */}
            {derived.versions.filter(Boolean).length > 1 && (
              <div className="mt-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                  Versão
                </label>
                <div className="flex flex-wrap gap-2">
                  {derived.versions.map((ver) => {
                    const isSelected = version === ver;
                    const any = product.variants.some((v) => v.version === ver && v.available);
                    return (
                      <button
                        key={ver || "padrao"}
                        type="button"
                        disabled={!any}
                        onClick={() => pickVersion(ver)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                          isSelected
                            ? "bg-white text-black font-semibold"
                            : "bg-[#18181b] border border-white/10 text-neutral-300 hover:border-white/20"
                        } ${!any ? "opacity-40 cursor-not-allowed" : ""}`}
                      >
                        {ver || "Padrão"}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Armazenamento */}
            {showStorages && (
              <div className="mt-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                  Capacidade
                </label>
                <div className="flex flex-wrap gap-2">
                  {derived.storages.map((st) => {
                    const isSelected = storage === st;
                    const ok = derived.storageAvailable(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => pickStorage(st)}
                        className={`rounded-full px-4 py-2 text-sm transition cursor-pointer ${
                          isSelected
                            ? "bg-white text-black font-semibold"
                            : "bg-[#18181b] border border-white/10 text-neutral-300 hover:border-white/20"
                        } ${!ok ? "opacity-50" : ""}`}
                      >
                        {st}
                        {!ok && (
                          <span className="ml-1 text-[10px] text-neutral-400">(esgotado)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Cores */}
            {showColors && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Cor
                  </label>
                  <span className="text-xs text-neutral-300 font-medium">{color}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {derived.colors.map((c) => {
                    const isSelected = color === c;
                    const hex = derived.colorHex(c);
                    const ok = derived.colorAvailable(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => pickColor(c)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition cursor-pointer ${
                          isSelected
                            ? "bg-white text-black font-semibold"
                            : "bg-[#18181b] border border-white/10 text-neutral-300 hover:border-white/20"
                        } ${!ok ? "opacity-50" : ""}`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/20 shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                        <span>{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Seletor de Unidades Específicas se houver */}
            {derived.matchingVariants.length > 1 && (
              <div className="mt-5">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                  Selecione o Aparelho Específico
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {derived.matchingVariants.map((v, idx) => {
                    const isSelectedUnit = selected?.id === v.id;
                    return (
                      <button
                        key={v.id ?? idx}
                        type="button"
                        onClick={() => setUserVariantId(v.id ?? null)}
                        className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition cursor-pointer ${
                          isSelectedUnit
                            ? "border-white bg-white/10 text-white"
                            : "border-white/10 bg-[#18181b] text-neutral-300 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-white">
                            Unidade #{idx + 1} {v.batteryHealth ? `• Bat. ${v.batteryHealth}` : ""}
                          </span>
                          <span className="font-bold text-white">
                            {formatBRL(v.priceCash)}
                          </span>
                        </div>
                        {v.notes && (
                          <p className="text-[11px] text-neutral-400 line-clamp-1">{v.notes}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botões de Ação */}
            <div className="mt-6 flex flex-col gap-3">
              {/* Botão de Compra no WhatsApp */}
              {isAvailable ? (
                <a
                  href={waLink(whatsapp, buyMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white py-3.5 px-6 font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98] shadow-lg text-base"
                >
                  <MessageCircle className="h-5 w-5" />
                  Comprar no WhatsApp
                </a>
              ) : (
                <a
                  href={waLink(
                    whatsapp,
                    `Olá! Vi na vitrine da Lojinha do Celular o ${product.name}${
                      storage && storage !== "Padrão" ? ` ${storage}` : ""
                    }${color ? ` ${color}` : ""}. Podem me avisar quando estiver disponível?`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-full border border-white/20 bg-white/10 hover:bg-white/15 text-white py-3.5 px-6 font-semibold flex items-center justify-center gap-2 transition active:scale-[0.98]"
                >
                  <MessageCircle className="h-5 w-5" />
                  Avise-me no WhatsApp quando chegar
                </a>
              )}

              {/* Botão Secundário de Trade-In */}
              <Link
                to="/avaliacao"
                className="w-full rounded-full border border-white/20 bg-white/5 hover:bg-white/10 text-white py-3 px-6 font-medium text-sm flex items-center justify-center gap-2 transition"
              >
                Avaliar meu aparelho na troca
              </Link>
            </div>

            {/* Informações complementares / Sobre este aparelho */}
            <div className="mt-6 rounded-2xl border border-white/10 bg-[#141414] p-5">
              <h2 className="font-display text-base font-bold text-white">Sobre este aparelho</h2>
              {selected?.notes && (
                <p className="mt-2 text-xs text-amber-300/90 bg-amber-950/30 border border-amber-500/20 rounded-lg p-2.5 leading-relaxed">
                  📝 <span className="font-semibold text-amber-200">Nota da Unidade:</span> {selected.notes}
                </p>
              )}
              {product.description && (
                <p className="mt-3 text-xs leading-relaxed text-neutral-400">
                  {product.description}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-neutral-300">
                <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>{selected?.warranty || product.warranty || "1 Ano de Garantia"}</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <BadgeCheck className="h-4 w-4 text-blue-400 shrink-0" />
                  <span>100% Original & Testado</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
