import { useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import {
  ShieldCheck,
  MessageCircle,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  Plus,
  RefreshCcw,
  Gift,
  Video,
  Flame,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, CATEGORIES } from "@contracts/types";
import { useShopSettings, waLink, optimizeImageUrl, getImageSrcSet } from "@/lib/shop";
import { DEMO_PRODUCTS } from "@/lib/catalogDemo";
import { resolveProductImage } from "@/lib/iphoneCatalog";
import { getVideoEmbed } from "@/components/admin/AdminProductEditor";
import { useCart } from "@/lib/cart";
import { WhatsAppIcon } from "@/components/WhatsAppModal";
import {
  formatCommercialProductName,
  formatCommercialSku,
} from "@/lib/commercialFormatting";
import SEO from "@/components/SEO";

type Variant = ProductWithVariants["variants"][number];

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const idStr = id ? String(id).trim() : "";
  const isUuidOrString = typeof id === "string" && (id.includes("-") || Number.isNaN(Number(id)));
  const numericId = Number(id);

  const demoFallback = useMemo(() => {
    if (isUuidOrString) return undefined;
    if (Number.isNaN(numericId)) return undefined;
    return (
      DEMO_PRODUCTS.find((p) => p.id === numericId) ||
      DEMO_PRODUCTS.find((p) => p.id === Math.abs(numericId)) ||
      (numericId < 0 ? DEMO_PRODUCTS[0] : undefined)
    );
  }, [isUuidOrString, numericId]);

  const isDemo = !!demoFallback;
  const isValidId = isUuidOrString ? !!idStr : (!Number.isNaN(numericId) && numericId > 0) || isDemo;

  const s = useShopSettings();
  const query = trpc.shop.product.useQuery(
    { id: isUuidOrString ? idStr : numericId > 0 ? numericId : 1 },
    {
      enabled: (isUuidOrString ? !!idStr : (!Number.isNaN(numericId) && numericId > 0)) && !isDemo,
      staleTime: 1000 * 30,
    },
  );

  const product = useMemo(() => {
    if (query.data) return query.data as ProductWithVariants;
    if (demoFallback) return demoFallback as unknown as ProductWithVariants;
    return null;
  }, [query.data, demoFallback]);

  // Gerenciamento de seleção compatível com React 19
  const [selectedProductId, setSelectedProductId] = useState<string | number>(idStr || numericId);
  const [userVersion, setUserVersion] = useState<string | null>(null);
  const [userStorage, setUserStorage] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<string | null>(null);
  const [userVariantId, setUserVariantId] = useState<string | number | null>(null);
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  const [mediaTab, setMediaTab] = useState<"photo" | "video">("photo");

  const currentIdKey = isUuidOrString ? idStr : numericId;
  if (selectedProductId !== currentIdKey) {
    setSelectedProductId(currentIdKey);
    setUserVersion(null);
    setUserStorage(null);
    setUserColor(null);
    setUserVariantId(null);
    setShowAllInstallments(false);
    setMediaTab("photo");
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
    (isLacrado && isIphone ? null : !isLacrado && isIphone ? "93%" : null);

  const categoryLabel = product
    ? (CATEGORIES.find((c) => c.value === product.category)?.label ?? product.category)
    : "";

  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";
  const conditionLabel = isLacrado ? "Lacrado" : "Seminovo";
  const formattedPrice = price != null ? formatBRL(price) : "";

  const { addItem } = useCart();

  const productCode =
    typeof product?.id === "number"
      ? `B${product.id + 1600}`
      : `B${String(product?.id || "1000").slice(0, 8).toUpperCase()}`;
  const displaySku = formatCommercialSku(selected?.sku || productCode);
  const cleanTitle = formatCommercialProductName(product?.name || "", color, storage);

  const buyMessage =
    product && price != null
      ? `*Olá, Lojinha do Celular!* 📱\nQuero fechar este pedido pelo site:\n\n1. *${cleanTitle}* (${conditionLabel}) — cód. ${displaySku}\nPix: ${formattedPrice}\n\n*Total no Pix: ${formattedPrice}*\n${
          installment12
            ? `ou até 12x de ${formatBRL(installment12)} no cartão\n\n`
            : "\n"
        }📍 Unidade: Jardim - MS\n\nPode confirmar disponibilidade e a entrega? 📦`
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
  const prodImage = resolveProductImage(
    product?.name ?? "",
    selected?.imageUrl || product?.imageUrl,
    color,
  );
  const prodUrl = typeof window !== "undefined" ? window.location.href : "";

  const handleAddToCart = () => {
    if (!product || price == null) return;
    const cartItemId = `${product.id}-${selectedVariantId || color || "default"}-${storage || "default"}`;
    addItem({
      id: cartItemId,
      productId: product.id,
      variantId: selectedVariantId ?? undefined,
      name: product.name,
      color: color || "",
      storage: storage || "",
      condition: conditionLabel,
      sku: displaySku,
      price: price,
      imageUrl: prodImage || product.imageUrl || "",
    });
  };

  const warrantyDisplay =
    selected?.warranty ||
    product?.warranty ||
    (isLacrado ? "1 ano de garantia" : "6 meses de garantia");

  const videoUrl =
    selected?.videoUrl ||
    (product as unknown as { videoUrl?: string })?.videoUrl ||
    "";
  const videoEmbed = videoUrl ? getVideoEmbed(videoUrl) : null;

  if (!isValidId) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 pt-6 pb-16 px-4">
        <div className="mx-auto max-w-5xl text-center py-20">
          <p className="font-display text-xl font-bold text-neutral-700">
            Endereço de produto inválido
          </p>
          <Link
            to="/#vitrine"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-black transition"
          >
            <ChevronLeft className="h-4 w-4" /> Loja
          </Link>
        </div>
      </div>
    );
  }

  if (query.isLoading && !isDemo) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 pt-6 pb-16 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="h-4 w-16 animate-pulse rounded bg-neutral-100 mb-6" />
          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="aspect-square w-full rounded-3xl bg-neutral-100 animate-pulse" />
            <div className="space-y-4">
              <div className="h-6 w-1/3 animate-pulse rounded-full bg-neutral-100" />
              <div className="h-10 w-3/4 animate-pulse rounded bg-neutral-100" />
              <div className="h-24 animate-pulse rounded-2xl bg-neutral-100" />
              <div className="h-12 animate-pulse rounded-full bg-neutral-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (query.isError && !isDemo) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 pt-6 pb-16 px-4">
        <div className="mx-auto max-w-md text-center py-20">
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-neutral-900">
              Erro ao carregar detalhes do produto
            </h2>
            <p className="mt-2 text-sm text-neutral-500">
              Não foi possível comunicar com o servidor. Tente novamente em instantes.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => query.refetch()}
                className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-black transition cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" /> Recarregar
              </button>
              <Link
                to="/#vitrine"
                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-5 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition"
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
      <div className="min-h-screen bg-white text-neutral-900 pt-6 pb-16 px-4">
        <div className="mx-auto max-w-5xl text-center py-20">
          <p className="font-display text-xl font-bold text-neutral-700">
            Produto não encontrado
          </p>
          <Link
            to="/#vitrine"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-black transition"
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
    <div className="bg-white min-h-screen text-[#1d1d1f] pt-4 pb-20 px-4">
      <SEO
        title={prodTitle}
        description={prodDesc}
        image={prodImage}
        url={prodUrl}
      />

      <div className="max-w-5xl mx-auto">
        {/* Botão de retorno discreto no topo: ← Loja */}
        <div className="mb-4">
          <Link
            to="/#vitrine"
            className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-black transition"
          >
            <ChevronLeft className="h-4 w-4" /> Loja
          </Link>
        </div>

        {/* Grid em 2 colunas no desktop */}
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start max-w-5xl mx-auto">
          {/* Coluna da Esquerda (Foto do Produto ou Vídeo) */}
          <div className="aspect-square w-full rounded-3xl bg-[#fbfbfd] border border-neutral-100 p-4 sm:p-8 flex items-center justify-center shadow-xs overflow-hidden relative">
            {videoEmbed && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full bg-black/75 p-1 backdrop-blur-md shadow-md">
                <button
                  type="button"
                  onClick={() => setMediaTab("photo")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    mediaTab === "photo"
                      ? "bg-white text-black shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  📷 Foto
                </button>
                <button
                  type="button"
                  onClick={() => setMediaTab("video")}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    mediaTab === "video"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-white/80 hover:text-white"
                  }`}
                >
                  <Video className="h-3.5 w-3.5" /> Vídeo
                </button>
              </div>
            )}

            {mediaTab === "video" && videoEmbed ? (
              <div className="h-full w-full flex items-center justify-center bg-black rounded-2xl overflow-hidden">
                {videoEmbed.type === "youtube" ? (
                  <iframe
                    src={videoEmbed.src}
                    title="Vídeo do aparelho"
                    className="h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : videoEmbed.type === "video" ? (
                  <video
                    src={videoEmbed.src}
                    controls
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="text-center p-6 text-white">
                    <Video className="mx-auto h-10 w-10 text-purple-400 mb-2" />
                    <p className="text-sm font-semibold">Vídeo demonstrativo</p>
                    <a
                      href={videoEmbed.src}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500"
                    >
                      Assistir vídeo externo
                    </a>
                  </div>
                )}
              </div>
            ) : prodImage ? (
              <img
                src={optimizeImageUrl(prodImage, 800, 85)}
                srcSet={getImageSrcSet(prodImage)}
                sizes="(max-width: 768px) 100vw, 500px"
                alt={product.name}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.removeAttribute("srcset");
                  if (prodImage && e.currentTarget.src !== prodImage) {
                    e.currentTarget.src = prodImage;
                  }
                }}
                className="h-full w-full max-h-full max-w-full object-contain drop-shadow-[0_16px_32px_rgba(0,0,0,0.12)] transition-all duration-300"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm font-medium text-neutral-400">
                Sem foto
              </div>
            )}
          </div>

          {/* Coluna da Direita (Configuração e Compra) */}
          <div className="flex flex-col">
            {/* Badges superiores exatamente como na BLK Store */}
            <div className="flex flex-wrap items-center gap-2">
              {Boolean(product.featured) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ff3b30] px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-xs animate-in fade-in">
                  <Flame className="h-3.5 w-3.5 fill-white" />
                  Promoção
                </span>
              )}
              {isLacrado ? (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-[#1d1d1f] text-white">
                  Lacrado
                </span>
              ) : (
                <span className="rounded-full px-3 py-1 text-xs font-medium border border-neutral-300 bg-neutral-100 text-neutral-800">
                  Seminovo
                </span>
              )}

              {!isAvailable && (
                <span className="rounded-full px-3 py-1 text-xs font-semibold bg-neutral-200 text-neutral-600">
                  Esgotado
                </span>
              )}

              {/* Código do produto */}
              <span className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs font-mono text-neutral-500">
                {displaySku}
              </span>

              {/* Bateria para seminovos */}
              {batteryHealthDisplay && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  🔋 Bateria {batteryHealthDisplay}
                </span>
              )}
            </div>

            {/* Título do Produto */}
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-neutral-950 mt-3 leading-tight">
              {product.name}
              {color ? ` - ${color}` : ""}
              {storage && storage !== "Padrão" ? ` ${storage}` : ""}
            </h1>

            {/* Bloco de Preço */}
            <div className="mt-4">
              {price != null && isAvailable ? (
                <div>
                  {/* Selo de Pix */}
                  <span className="inline-block rounded-full bg-[#e8f2ff] px-3 py-1 text-xs font-bold text-[#0066cc] mb-1">
                    12% OFF no Pix
                  </span>

                  {/* Preço à vista destacado */}
                  <div className="text-4xl sm:text-5xl font-black text-neutral-950 tracking-tight mt-1">
                    {formatBRL(price)}
                  </div>

                  {/* Subtítulo à vista no Pix */}
                  <p className="text-xs text-neutral-500 mt-0.5 font-medium">
                    à vista no Pix
                  </p>

                  {/* Linha de Parcelamento */}
                  <p
                    onClick={() => setShowAllInstallments((v) => !v)}
                    className="text-xs sm:text-sm text-neutral-600 mt-2 cursor-pointer hover:text-black transition"
                  >
                    ou em até{" "}
                    <span className="font-bold text-neutral-900">12x de {formatBRL(installment12 ?? 0)}</span> no cartão —{" "}
                    <span className="underline decoration-neutral-300">
                      {showAllInstallments ? "ocultar parcelas" : "ver todas as parcelas"}
                    </span>
                  </p>

                  {showAllInstallments && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-3.5 text-xs animate-in fade-in-50">
                      {Array.from(
                        { length: Math.min(s.installmentsMax, 12) },
                        (_, i) => i + 1,
                      ).map((n) => {
                        const fee = s.fees[String(n)] ?? 0;
                        const val = installmentFromFees(price, n, fee);
                        return (
                          <div
                            key={n}
                            className="flex items-center justify-between gap-1 text-neutral-600"
                          >
                            <span className="font-bold text-neutral-900">{n}x</span>
                            <span className="text-neutral-800 font-medium">{formatBRL(val)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="font-display text-lg font-semibold text-neutral-400">
                  Combinação indisponível no momento
                </p>
              )}
            </div>

            {/* Seletores de Capacidade e Cores */}
            {showStorages && (
              <div className="mt-6">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-2">
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
                        className={`rounded-full px-5 py-2 text-sm font-semibold transition cursor-pointer ${
                          isSelected
                            ? "bg-[#1d1d1f] text-white shadow-xs"
                            : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        } ${!ok ? "opacity-40" : ""}`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showColors && (
              <div className="mt-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Cor
                  </label>
                  <span className="text-xs text-neutral-700 font-semibold">{color}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {derived.colors.map((c) => {
                    const isSelected = color === c;
                    const hex = derived.colorHex(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => pickColor(c)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-[#1d1d1f] text-white shadow-xs"
                            : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                        <span>{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Botões de Ação Duplos */}
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              {!isAvailable ? (
                <a
                  href={waLink(
                    whatsapp,
                    `Olá! Vi o ${product.name}${storage ? ` ${storage}` : ""}${color ? ` ${color}` : ""} na Lojinha do Celular, mas está esgotado no momento. Gostaria de saber a previsão de chegada ou encomendar.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full rounded-full bg-neutral-900 hover:bg-black text-white py-3.5 px-6 font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>Consultar previsão no WhatsApp</span>
                </a>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="flex-1 rounded-full bg-[#0071e3] hover:bg-[#0077ed] text-white py-3.5 px-6 font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98] cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Adicionar à Sacola</span>
                  </button>

                  <a
                    href={waLink(whatsapp, buyMessage)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={handleAddToCart}
                    className="flex-1 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white py-3.5 px-6 font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98] cursor-pointer"
                  >
                    <WhatsAppIcon className="h-4 w-4 fill-white" />
                    <span>Pedir agora</span>
                  </a>
                </>
              )}
            </div>

            {/* Promo Cards (Screenshot 4: Trade-in e Brinde) */}
            <div className="mt-6 flex flex-col gap-3">
              {/* Card 1: Trade-in */}
              <a
                href="https://trocafacil.lojinhadocelular.com"
                className="rounded-2xl border border-neutral-200/90 bg-white p-4 flex items-center gap-3.5 shadow-xs hover:border-neutral-300 transition group"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-800 group-hover:scale-105 transition">
                  <RefreshCcw className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-sm font-bold text-neutral-900 leading-snug">
                    Tem um iPhone pra dar de entrada?
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Descubra quanto vale o seu e pague só a diferença — avaliação online, sem compromisso.
                  </p>
                </div>
              </a>

              {/* Card 2: Brinde */}
              <div className="rounded-2xl bg-[#eef5ff] border border-[#d2e4ff] text-[#0066cc] p-4 flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ddecff] text-[#0066cc]">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-xs sm:text-sm font-bold text-[#0055b3] leading-snug">
                    Fechando hoje: capa e película de brinde.
                  </p>
                  <p className="text-xs text-[#0066cc]/80 mt-0.5">
                    Fale com a gente pra garantir seu kit completo.
                  </p>
                </div>
              </div>
            </div>

            {/* Tabela de Especificações (Screenshot 4) */}
            <div className="mt-8 border-t border-neutral-200 pt-4">
              <div className="divide-y divide-neutral-100 text-xs sm:text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-neutral-500">Modelo</span>
                  <span className="font-bold text-neutral-900 text-right">{product.name}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-neutral-500">Categoria</span>
                  <span className="font-bold text-neutral-900 text-right">{categoryLabel || "iPhone"}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-neutral-500">Condição</span>
                  <span className="font-bold text-neutral-900 text-right">{conditionLabel}</span>
                </div>
                {color && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-neutral-500">Cor</span>
                    <span className="font-bold text-neutral-900 text-right">{color}</span>
                  </div>
                )}
                {storage && storage !== "Padrão" && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-neutral-500">Armazenamento</span>
                    <span className="font-bold text-neutral-900 text-right">{storage}</span>
                  </div>
                )}
                {batteryHealthDisplay && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-neutral-500">Saúde da bateria</span>
                    <span className="font-bold text-emerald-700 text-right">
                      {batteryHealthDisplay}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-neutral-500">Código</span>
                  <span className="font-mono text-neutral-600 text-right">{displaySku}</span>
                </div>
                {warrantyDisplay && (
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-neutral-500">Garantia</span>
                    <span className="font-bold text-neutral-900 text-right">{warrantyDisplay}</span>
                  </div>
                )}
              </div>

              {/* Nota de Procedência & Confiança */}
              <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-neutral-50 border border-neutral-100 p-3.5 text-xs text-neutral-600">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{s.warrantyBadgeText || "Garantia de 1 ano, nota fiscal e procedência verificada. Entrega rápida na região."}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
