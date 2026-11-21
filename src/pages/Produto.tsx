import { useMemo, useRef, useState } from "react";
import { useParams, Link } from "react-router";
import { getQueryKey } from "@trpc/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  MessageCircle,
  ChevronLeft,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  Plus,
  RefreshCcw,
  Gift,
  Flame,
  Copy,
  Scale,
  Check,
} from "lucide-react";
import { trpc, type ProductWithVariants, type RouterOutputs } from "@/providers/trpc";
import {
  formatBRL,
  installmentFromFees,
  CATEGORIES,
} from "@contracts/types";
import { useShopSettings, waLink } from "@/lib/shop";
import { DEMO_PRODUCTS } from "@/lib/catalogDemo";
import { getVideoEmbed } from "@/lib/videoEmbed";
import { useCart } from "@/lib/cart";
import { useCompare } from "@/lib/compare";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";
import {
  formatCommercialProductName,
  formatCommercialSku,
} from "@/lib/commercialFormatting";
import { createProductShareSlug } from "@/lib/productUrls";
import {
  buildProductGalleryImages,
  buildProductJsonLd,
  deriveVariantSelection,
  findProductInCachedCatalog,
  parseProductRouteParams,
  pickNextColorVariant,
  pickNextStorageVariant,
  pickNextVersionVariant,
  type ParsedProductRoute,
} from "@/lib/productDetail";
import SEO from "@/components/SEO";
import SpecSheet from "@/components/SpecSheet";
import ProductGallery from "@/components/produto/ProductGallery";
import MobileStickyCta from "@/components/produto/MobileStickyCta";
import RelatedProducts from "@/components/produto/RelatedProducts";

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const parsed = parseProductRouteParams(id);

  return (
    <ProdutoContent
      key={parsed.productQueryId || parsed.idStr || "invalid"}
      parsed={parsed}
    />
  );
}

function ProdutoContent({ parsed }: { parsed: ParsedProductRoute }) {
  const demoFallback = useMemo(() => {
    if (parsed.isUuidOrString) return undefined;
    if (Number.isNaN(parsed.numericId)) return undefined;
    return (
      DEMO_PRODUCTS.find((p) => p.id === parsed.numericId) ||
      DEMO_PRODUCTS.find((p) => p.id === Math.abs(parsed.numericId)) ||
      (parsed.numericId < 0 ? DEMO_PRODUCTS[0] : undefined)
    );
  }, [parsed.isUuidOrString, parsed.numericId]);

  const isDemo = Boolean(demoFallback);
  const isValidId = parsed.isValidId || isDemo;

  const s = useShopSettings();
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();
  const cachedCatalog: readonly ProductWithVariants[] | undefined =
    utils.shop.products.getData();
  const cachedProduct = useMemo(
    () => findProductInCachedCatalog(cachedCatalog, parsed.idStr),
    [cachedCatalog, parsed.idStr],
  );
  const productsQueryState = queryClient.getQueryState(
    getQueryKey(trpc.shop.products, undefined, "query"),
  );

  const query = trpc.shop.product.useQuery(
    {
      id: parsed.isUuidOrString
        ? parsed.productQueryId
        : parsed.numericId > 0
          ? parsed.numericId
          : 1,
    },
    {
      enabled: isValidId && !isDemo,
      staleTime: 1000 * 30,
      initialData: cachedProduct as RouterOutputs["shop"]["product"] | undefined,
      initialDataUpdatedAt: cachedProduct
        ? productsQueryState?.dataUpdatedAt
        : undefined,
    },
  );

  const product = useMemo(() => {
    if (query.data) return query.data as ProductWithVariants;
    if (demoFallback) return demoFallback as unknown as ProductWithVariants;
    return null;
  }, [query.data, demoFallback]);

  const [userVersion, setUserVersion] = useState<string | null>(null);
  const [userStorage, setUserStorage] = useState<string | null>(null);
  const [userColor, setUserColor] = useState<string | null>(null);
  const [userVariantId, setUserVariantId] = useState<string | number | null>(null);
  const [showAllInstallments, setShowAllInstallments] = useState(false);
  const [mediaTab, setMediaTab] = useState<"photo" | "video">("photo");
  const [manualImageUrl, setManualImageUrl] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const inlineCtaRef = useRef<HTMLDivElement | null>(null);

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
    return deriveVariantSelection(product.variants, {
      version,
      storage,
      color,
      selectedVariantId,
    });
  }, [product, version, storage, color, selectedVariantId]);

  const pickVersion = (nextVersion: string) => {
    setManualImageUrl(null);
    if (!product) {
      setUserVersion(nextVersion);
      return;
    }
    const next = pickNextVersionVariant(product.variants, nextVersion);
    setUserVersion(next.version);
    setUserStorage(next.storage ?? null);
    setUserColor(next.color ?? null);
    setUserVariantId(next.variantId);
  };

  const pickStorage = (nextStorage: string) => {
    setManualImageUrl(null);
    if (!product) {
      setUserStorage(nextStorage);
      return;
    }
    const next = pickNextStorageVariant(product.variants, version, nextStorage, color);
    setUserStorage(next.storage ?? nextStorage);
    if (next.color !== undefined) setUserColor(next.color);
    setUserVariantId(next.variantId);
  };

  const pickColor = (nextColor: string) => {
    setManualImageUrl(null);
    if (!product) {
      setUserColor(nextColor);
      return;
    }
    const next = pickNextColorVariant(product.variants, version, nextColor, storage);
    setUserColor(next.color ?? nextColor);
    if (next.storage !== undefined) setUserStorage(next.storage);
    setUserVariantId(next.variantId);
  };

  const selected = derived?.selected;
  const isAvailable = Boolean(selected?.available) && (selected?.quantity ?? 1) > 0;
  const price = selected?.priceCash ?? null;
  const interestFreeInstallments = Math.max(1, Math.min(12, s.installmentsMax));
  const installment12 =
    price != null
      ? installmentFromFees(price, interestFreeInstallments, s.fees[String(interestFreeInstallments)] ?? 0)
      : null;

  const isLacrado =
    selected?.condition === "lacrado" || product?.condition === "lacrado";
  const isIphone =
    product?.brand.toLowerCase() === "apple" ||
    (product?.name.toLowerCase().includes("iphone") ?? false);
  const rawBattery =
    selected?.batteryHealth ||
    (product as { batteryHealth?: string | null })?.batteryHealth;
  const batteryHealthDisplay = rawBattery
    ? rawBattery.includes("%") || isNaN(Number(rawBattery.replace(/\D/g, "")))
      ? rawBattery
      : `${rawBattery.replace(/\D/g, "")}%`
    : isLacrado && isIphone
      ? "100%"
      : null;

  const categoryLabel = product
    ? (CATEGORIES.find((c) => c.value === product.category)?.label ?? product.category)
    : "";

  const unitAvailability =
    selected?.unitAvailability || product?.unitAvailability || "jardim";
  const isGuiaOnly = unitAvailability === "guia_lopes";
  const isAmbas = unitAvailability === "ambas";

  const targetWhatsapp = isGuiaOnly
    ? s.whatsappGll || s.whatsappJardim || "5567998206533"
    : s.whatsappJardim || s.whatsappGll || "5567992086012";

  const conditionLabel = isLacrado ? "Lacrado" : "Seminovo";
  const formattedPrice = price != null ? formatBRL(price) : "";

  const { addItem, isOpen: isCartOpen } = useCart();
  const compare = useCompare();

  const productCode =
    typeof product?.id === "number"
      ? `B${product.id + 1600}`
      : `B${String(product?.id || "1000").slice(0, 8).toUpperCase()}`;
  const displaySku = formatCommercialSku(selected?.sku || productCode);
  const cleanTitle = formatCommercialProductName(
    product?.name || "",
    color,
    storage,
  );
  const prodPath = product
    ? `/produto/${createProductShareSlug(cleanTitle || product.name, product.id)}`
    : "";
  const prodUrl =
    typeof window !== "undefined" && prodPath
      ? `${window.location.origin}${prodPath}`
      : "";

  const unitLocationText = isGuiaOnly
    ? "Guia Lopes da Laguna - MS"
    : isAmbas
      ? "Jardim - MS (Também disponível em Guia Lopes)"
      : "Jardim - MS";

  const buyMessage =
    product && price != null
      ? `*Olá, Lojinha do Celular!* 📱\nQuero fechar este pedido pelo site:\n\n1. *${cleanTitle}* (${conditionLabel}) — cód. ${displaySku}\nPix: ${formattedPrice}\n\n*Total no Pix: ${formattedPrice}*\n${
          installment12
            ? `ou ${interestFreeInstallments}x de ${formatBRL(installment12)} sem juros no cartão${s.installmentsMax > 12 ? " (acima de 12x, com juros)" : ""}\n\n`
            : "\n"
        }📍 Unidade: ${unitLocationText}\n\nPode confirmar disponibilidade e a entrega? 📦`
      : "";

  const shareUrl = new URL(
    prodUrl || `https://lojinhadocelular.com/produto/${product?.id ?? ""}`,
  );
  if (product) {
    shareUrl.pathname = `/produto/${createProductShareSlug(cleanTitle, product.id)}`;
    shareUrl.hash = "";
    shareUrl.search = "";
  }

  const shareMessage =
    product && price != null
      ? [
          `📱 *${cleanTitle}*`,
          `💰 ${formattedPrice} no Pix${installment12 ? ` ou ${interestFreeInstallments}x de ${formatBRL(installment12)} sem juros no cartão` : ""}`,
          `${conditionLabel}${batteryHealthDisplay ? ` • 🔋 Bateria ${batteryHealthDisplay}` : ""}`,
          `🛡️ ${selected?.warranty || product.warranty || (isLacrado ? "1 ano de garantia" : "Garantia com procedência")}`,
          `📍 Disponível em ${unitLocationText}`,
          `🔗 ${shareUrl.toString()}`,
        ].join("\n")
      : "";

  const handleShare = () => {
    if (!shareMessage) return;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleCopyShare = async () => {
    if (!shareMessage) return;
    setShareFeedback("");
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareMessage);
      } else {
        throw new Error("Clipboard API indisponível");
      }
      setShareFeedback("Resumo copiado. Agora é só colar na conversa.");
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareMessage;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      setShareFeedback(
        copied
          ? "Resumo copiado. Agora é só colar na conversa."
          : "Não foi possível copiar. Tente usar Compartilhar.",
      );
    }
  };

  const galleryImages = useMemo(() => {
    if (!product) return [];
    return buildProductGalleryImages(
      product.name,
      product.imageUrl,
      selected?.imageUrl,
      color,
      product.variants,
    );
  }, [product, selected?.imageUrl, color]);

  const activeImage =
    manualImageUrl && galleryImages.includes(manualImageUrl)
      ? manualImageUrl
      : (galleryImages[0] ?? "");

  const prodTitle = cleanTitle
    ? `${cleanTitle} — Lojinha do Celular`
    : product
      ? `${product.name} — Lojinha do Celular`
      : "";
  const prodDesc = product
    ? product.description ||
      `Compre ${product.name} na Lojinha do Celular com garantia e melhor preço em Jardim-MS e Guia Lopes da Laguna.`
    : "";

  const productJsonLd =
    product && price != null
      ? buildProductJsonLd({
          productId: product.id,
          cleanTitle: cleanTitle || product.name,
          description: prodDesc,
          brand: product.brand,
          sku: displaySku || String(product.id),
          priceCash: price,
          imageUrl: activeImage,
          productUrl: prodUrl || `https://lojinhadocelular.com/produto/${product.id}`,
          isLacrado,
          isAvailable,
          unitAvailability,
          addressJardim: s.addressJardim,
          addressGll: s.addressGll,
          whatsappJardim: s.whatsappJardim,
          whatsappGll: s.whatsappGll,
        })
      : undefined;

  const trackInterestMutation = trpc.shop.trackInterest.useMutation();
  const trackInterest = () => {
    if (isDemo || !product) return;
    trackInterestMutation.mutate({ productId: product.id });
  };

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
      price,
      imageUrl: activeImage || product.imageUrl || "",
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
        <SEO
          title="Produto não encontrado (404)"
          description="O produto procurado não está disponível ou foi descontinuado."
          noindex={true}
        />
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
        <SEO
          title="Produto não encontrado (404)"
          description="O produto procurado não está mais disponível ou foi removido do nosso catálogo."
          noindex={true}
        />
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

  const showVersions = derived.versions.filter(Boolean).length > 1;
  const showStorages = derived.storages.filter(Boolean).length > 0;
  const showColors = derived.colors.filter(Boolean).length > 0;
  const inCompare = compare.has(product.id);
  const compareBlocked = compare.isFull && !inCompare;
  const whatsappDirectHref = waLink(targetWhatsapp, buyMessage);
  const variantSummary = [color, storage && storage !== "Padrão" ? storage : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`bg-white min-h-screen text-[#1d1d1f] pt-4 px-4 ${
        isAvailable ? "pb-28 md:pb-20" : "pb-20"
      }`}
    >
      <SEO
        title={prodTitle}
        description={prodDesc}
        image={activeImage}
        url={prodUrl}
        jsonLd={productJsonLd}
      />

      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            to="/#vitrine"
            className="inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-black transition"
          >
            <ChevronLeft className="h-4 w-4" /> Loja
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-start max-w-5xl mx-auto">
          <ProductGallery
            productName={cleanTitle || product.name}
            images={galleryImages}
            activeImage={activeImage}
            onSelectImage={(url) => setManualImageUrl(url)}
            mediaTab={mediaTab}
            onChangeMediaTab={setMediaTab}
            videoEmbed={videoEmbed}
          />

          <div className="flex flex-col">
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

              <span className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs font-mono text-neutral-500">
                {displaySku}
              </span>

              {batteryHealthDisplay && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  🔋 Bateria {batteryHealthDisplay}
                </span>
              )}

              {unitAvailability === "guia_lopes" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                  📍 Unidade Guia Lopes
                </span>
              )}
              {unitAvailability === "ambas" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                  📍 Jardim & Guia Lopes
                </span>
              )}
              {unitAvailability === "jardim" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-900">
                  📍 Unidade Jardim (Matriz)
                </span>
              )}
            </div>

            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-neutral-950 mt-3 leading-tight">
              {cleanTitle}
            </h1>

            <div className="mt-4">
              {price != null && isAvailable ? (
                <div>
                  <div className="text-4xl sm:text-5xl font-black text-neutral-950 tracking-tight mt-1">
                    {formatBRL(price)}
                  </div>

                  <p className="text-sm text-neutral-500 mt-0.5 font-medium">
                    à vista no Pix · 12% de desconto já aplicado
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowAllInstallments((v) => !v)}
                    aria-expanded={showAllInstallments}
                    className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-left text-xs sm:text-sm text-neutral-600 hover:text-black transition cursor-pointer"
                  >
                    <span>
                      ou{" "}
                      <span className="font-bold text-neutral-900">
                        {interestFreeInstallments}x de {formatBRL(installment12 ?? 0)} sem juros
                      </span>{" "}
                      no cartão
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-neutral-700 underline decoration-neutral-300">
                      {showAllInstallments ? "ocultar parcelas" : "ver todas as parcelas"}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${
                          showAllInstallments ? "rotate-180" : ""
                        }`}
                      />
                    </span>
                    {s.installmentsMax > 12 && (
                      <span className="w-full text-[11px] sm:text-xs text-neutral-500 mt-0.5">
                        Acima de 12x, consulte as parcelas com juros.
                      </span>
                    )}
                  </button>

                  {showAllInstallments && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-2xl border border-neutral-100 bg-neutral-50 p-3.5 text-xs animate-in fade-in-50">
                      {(() => {
                        return Array.from(
                          { length: s.installmentsMax },
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
                              <span className="text-neutral-800 font-medium">
                                {formatBRL(val)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <p className="font-display text-lg font-semibold text-neutral-400">
                  Combinação indisponível no momento
                </p>
              )}
            </div>

            {showVersions && (
              <div className="mt-6">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-2">
                  Versão
                </span>
                <div className="flex flex-wrap gap-2">
                  {derived.versions.filter(Boolean).map((ver) => {
                    const isSelected = version === ver;
                    return (
                      <button
                        key={ver}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => pickVersion(ver)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition cursor-pointer ${
                          isSelected
                            ? "bg-[#1d1d1f] text-white shadow-xs"
                            : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        }`}
                      >
                        {ver}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {showStorages && (
              <div className="mt-5">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500 block mb-2">
                  Capacidade
                </span>
                <div className="flex flex-wrap gap-2">
                  {derived.storages.filter(Boolean).map((st) => {
                    const isSelected = storage === st;
                    const ok = derived.storageAvailable(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        aria-pressed={isSelected}
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
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                    Cor
                  </span>
                  <span className="text-xs text-neutral-700 font-semibold">{color}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {derived.colors.filter(Boolean).map((c) => {
                    const isSelected = color === c;
                    const hex = derived.colorHex(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => pickColor(c)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition cursor-pointer ${
                          isSelected
                            ? "bg-[#1d1d1f] text-white shadow-xs"
                            : "bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                        } ${!derived.colorAvailable(c) ? "opacity-50" : ""}`}
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

            {isGuiaOnly && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                <span className="text-base leading-none">📍</span>
                <div>
                  <p className="font-bold text-amber-950">
                    Aparelho disponível na Unidade de Guia Lopes da Laguna
                  </p>
                  <p className="mt-0.5 text-amber-800">
                    Ao pedir pelo WhatsApp, seu pedido será atendido diretamente pela nossa filial de Guia Lopes para separação e entrega.
                  </p>
                </div>
              </div>
            )}

            {/* Botões de Ação principais */}
            <div ref={inlineCtaRef} className="mt-6 flex flex-col sm:flex-row gap-3">
              {!isAvailable ? (
                <a
                  href={waLink(
                    targetWhatsapp,
                    `Olá! Vi o ${cleanTitle} na Lojinha do Celular, mas está esgotado no momento. Gostaria de saber a previsão de chegada ou encomendar.`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  onClick={trackInterest}
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
                    href={whatsappDirectHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={trackInterest}
                    className="flex-1 rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white py-3.5 px-6 font-semibold text-sm flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98] cursor-pointer"
                  >
                    <WhatsAppIcon className="h-4 w-4 fill-white" />
                    <span>Pedir agora</span>
                  </a>
                </>
              )}
            </div>

            {isAvailable && (
              <div className="mt-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex-1 rounded-full border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 py-2.5 px-4 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                  >
                    <WhatsAppIcon className="h-4 w-4 fill-current" />
                    <span>Enviar resumo</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyShare}
                    className="flex-1 rounded-full border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 py-2.5 px-4 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition active:scale-[0.98] cursor-pointer"
                  >
                    <Copy className="h-4 w-4" />
                    <span>Copiar resumo</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={inCompare}
                    disabled={compareBlocked}
                    onClick={() => compare.toggle(product.id)}
                    title={
                      compareBlocked
                        ? "Limite de 3 aparelhos para comparar atingido"
                        : inCompare
                          ? "Remover da comparação"
                          : "Comparar este aparelho"
                    }
                    className={`rounded-full border py-2.5 px-4 font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${
                      inCompare
                        ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] cursor-pointer"
                        : compareBlocked
                          ? "border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed"
                          : "border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 cursor-pointer"
                    }`}
                  >
                    {inCompare ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                    <span>{inCompare ? "Comparando" : "Comparar"}</span>
                  </button>
                </div>
                {shareFeedback && (
                  <p className="mt-2 text-center text-xs text-neutral-500" role="status">
                    {shareFeedback}
                  </p>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
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

            {product.description?.trim() && (
              <div className="mt-6 rounded-2xl border border-neutral-200/80 bg-[#fbfbfd] p-4">
                <h2 className="font-display text-sm font-bold text-neutral-900">
                  Sobre este aparelho
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-neutral-600 whitespace-pre-line">
                  {product.description.trim()}
                </p>
              </div>
            )}

            <div className="mt-8 border-t border-neutral-200 pt-4">
              <div className="divide-y divide-neutral-100 text-xs sm:text-sm">
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-neutral-500">Modelo</span>
                  <span className="font-bold text-neutral-900 text-right">{cleanTitle}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-neutral-500">Categoria</span>
                  <span className="font-bold text-neutral-900 text-right">
                    {categoryLabel || "Smartphone"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-neutral-500">Condição</span>
                  <span className="font-bold text-neutral-900 text-right">
                    {conditionLabel}
                  </span>
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
                    <span className="font-bold text-neutral-900 text-right">
                      {warrantyDisplay}
                    </span>
                  </div>
                )}
              </div>

              <SpecSheet
                productName={product.name}
                brand={product.brand}
                categoryLabel={categoryLabel}
                conditionLabel={conditionLabel}
                notes={selected?.notes}
                warranty={warrantyDisplay}
              />

              <div className="mt-5 flex items-center gap-2.5 rounded-2xl bg-neutral-50 border border-neutral-100 p-3.5 text-xs text-neutral-600">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  {s.warrantyBadgeText || "Garantia de até 1 ano e procedência verificada."}
                </span>
              </div>
            </div>
          </div>
        </div>

        <RelatedProducts currentProduct={product} isDemo={isDemo} />
      </div>

      <MobileStickyCta
        targetRef={inlineCtaRef}
        isAvailable={isAvailable}
        isCartOpen={isCartOpen}
        cleanTitle={cleanTitle}
        variantSummary={variantSummary}
        formattedPrice={formattedPrice}
        installmentSummary={
          installment12
            ? `${interestFreeInstallments}x ${formatBRL(installment12)}`
            : undefined
        }
        whatsappHref={whatsappDirectHref}
        onAddToCart={handleAddToCart}
        onTrackInterest={trackInterest}
      />
    </div>
  );
}
