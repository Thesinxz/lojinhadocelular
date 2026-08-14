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
  BatteryCharging,
  FileText,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, CATEGORIES } from "@contracts/types";
import { useShopSettings, waLink, optimizeImageUrl, getImageSrcSet, isImportedEua } from "@/lib/shop";

import SEO from "@/components/SEO";

type Variant = ProductWithVariants["variants"][number];

export default function Produto() {
  const { id } = useParams<{ id: string }>();
  const numericId = Number(id);
  const isValidId = !Number.isNaN(numericId) && numericId > 0;

  const s = useShopSettings();
  const query = trpc.shop.product.useQuery(
    { id: numericId },
    { enabled: isValidId, staleTime: 1000 * 30 },
  );
  const product = query.data;

  const [version, setVersion] = useState("");
  const [storage, setStorage] = useState("");
  const [color, setColor] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
  const [showAllInstallments, setShowAllInstallments] = useState(false);

  // Seleção inicial: primeira combinação disponível
  useEffect(() => {
    if (!product) return;
    const first =
      product.variants.find((v) => v.available && (v.quantity ?? 1) > 0) ?? product.variants[0];
    if (first) {
      setVersion(first.version);
      setStorage(first.storage);
      setColor(first.color);
      setSelectedVariantId(first.id ?? null);
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
    setStorage(st);
    if (!product) return;
    const match = product.variants.find(
      (v) => v.version === version && v.storage === st && v.color === color && v.available && (v.quantity ?? 1) > 0,
    );
    if (match) {
      setSelectedVariantId(match.id ?? null);
    } else {
      const first = product.variants.find(
        (v) => v.version === version && v.storage === st && v.available && (v.quantity ?? 1) > 0,
      );
      if (first) {
        setColor(first.color);
        setSelectedVariantId(first.id ?? null);
      }
    }
  }

  function pickColor(c: string) {
    setColor(c);
    if (!product) return;
    const match = product.variants.find(
      (v) => v.version === version && v.storage === storage && v.color === c && v.available && (v.quantity ?? 1) > 0,
    );
    if (match) {
      setSelectedVariantId(match.id ?? null);
    } else {
      const first = product.variants.find(
        (v) => v.version === version && v.color === c && v.available && (v.quantity ?? 1) > 0,
      );
      if (first) {
        setStorage(first.storage);
        setSelectedVariantId(first.id ?? null);
      }
    }
  }

  function pickVersion(ver: string) {
    setVersion(ver);
    if (!product) return;
    const first =
      product.variants.find((v) => v.version === ver && v.available && (v.quantity ?? 1) > 0) ??
      product.variants.find((v) => v.version === ver) ??
      product.variants[0];
    if (first) {
      setStorage(first.storage);
      setColor(first.color);
      setSelectedVariantId(first.id ?? null);
    }
  }

  const selected = derived?.selected;
  const isAvailable = !!selected?.available;
  const price = selected?.priceCash ?? null;
  const maxFee = s.fees[String(s.installmentsMax)] ?? 0;
  const categoryLabel = product
    ? (CATEGORIES.find((c) => c.value === product.category)?.label ?? product.category)
    : "";

  const buyMessage = product
    ? `Olá! Quero comprar o ${product.name}${
        version ? ` ${version}` : ""
      } ${storage} na cor ${color}${price != null ? ` (${formatBRL(price)} à vista)` : ""}. Está disponível?`
    : "";

  const prodTitle = product
    ? `${product.name}${version ? ` ${version}` : ""} ${storage} ${color}`
    : "";
  const prodDesc = product
    ? product.description ||
      `Compre ${product.name} na Lojinha do Celular com garantia e melhor preço em Jardim-MS e Guia Lopes da Laguna.`
    : "";
  const prodImage = product?.imageUrl || "/images/logo.png";
  const prodUrl = typeof window !== "undefined" ? window.location.href : "";

  const productJsonLd = useMemo(() => {
    if (!product) return undefined;
    return {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": prodTitle,
      "image":
        prodImage.startsWith("/") && typeof window !== "undefined"
          ? `${window.location.origin}${prodImage}`
          : prodImage,
      "description": prodDesc,
      "brand": {
        "@type": "Brand",
        "name": product.brand,
      },
      "offers": {
        "@type": "Offer",
        "priceCurrency": "BRL",
        "price": price != null ? (price / 100).toFixed(2) : undefined,
        "itemCondition":
          product.condition === "seminovo"
            ? "https://schema.org/UsedCondition"
            : "https://schema.org/NewCondition",
        "availability": isAvailable
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      },
    };
  }, [product, prodTitle, prodDesc, prodImage, price, isAvailable]);

  if (!isValidId) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-20 text-center">
        <p className="font-display text-xl font-bold text-neutral-500">Endereço de produto inválido</p>
        <Link to="/catalogo" className="mt-4 inline-block font-semibold text-ink underline">
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

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

  if (query.isError) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <div className="rounded-3xl border-2 border-ink bg-white p-8 shadow-[4px_4px_0_0_#141414]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-ink bg-brand">
            <AlertCircle className="h-6 w-6 text-ink" />
          </div>
          <h2 className="mt-3 font-display text-lg font-bold text-ink">Erro ao carregar detalhes do produto</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Não foi possível comunicar com o servidor. Tente novamente em instantes.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              onClick={() => query.refetch()}
              className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-ink px-4 py-2.5 text-sm font-bold text-brand shadow-[2px_2px_0_0_rgba(20,20,20,0.3)] hover:-translate-y-0.5 transition"
            >
              <RefreshCw className="h-4 w-4" /> Recarregar
            </button>
            <Link
              to="/catalogo"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-4 py-2.5 text-sm font-bold text-ink hover:bg-neutral-50"
            >
              Voltar ao catálogo
            </Link>
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <SEO
        title={prodTitle}
        description={prodDesc}
        image={prodImage}
        url={prodUrl}
        jsonLd={productJsonLd}
      />
      <Link
        to="/catalogo"
        className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" /> Voltar ao catálogo
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2">
        {/* Imagem */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-ink bg-neutral-100 shadow-[6px_6px_0_0_#141414]">
          {selected?.imageUrl || product.imageUrl ? (
            <img
              src={optimizeImageUrl(selected?.imageUrl || product.imageUrl!, 720, 80)}
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
              className="aspect-square w-full object-contain pt-14 pb-4 px-4 transition-all duration-300"
            />
          ) : (
            <div className="flex aspect-square items-center justify-center text-neutral-300">Sem foto</div>
          )}
          {(() => {
            const vCond = selected?.condition || product.condition;
            const vWarr = selected?.warranty || product.warranty || "";
            const isEua = vCond === "seminovo_eua" || vWarr.includes("EUA") || isImportedEua(product);
            const isLacrado = vCond === "lacrado" || product.condition === "lacrado";

            if (isLacrado) {
              return (
                <span className="absolute left-4 top-4 z-10 rounded-full border-2 border-ink bg-brand px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-ink shadow-sm">
                  ✨ Lacrado Novo
                </span>
              );
            }
            if (isEua) {
              return (
                <span className="absolute left-4 top-4 z-10 rounded-full border-2 border-ink bg-blue-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-sm">
                  🇺🇸 Seminovo EUA (1 Ano)
                </span>
              );
            }
            return (
              <span className="absolute left-4 top-4 z-10 rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink shadow-sm">
                🔄 Seminovo (Pego na Troca)
              </span>
            );
          })()}
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

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(selected?.warranty || product.warranty) && (
              <p className="inline-flex items-center gap-1.5 rounded-full bg-brand/40 px-3 py-1 text-xs font-bold text-ink">
                <ShieldCheck className="h-3.5 w-3.5" /> {selected?.warranty || product.warranty}
              </p>
            )}
            {selected?.batteryHealth ? (
              <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-emerald-300 px-3 py-1 text-xs font-extrabold text-ink shadow-[2px_2px_0_0_#141414]">
                <BatteryCharging className="h-4 w-4 text-ink" /> Saúde da Bateria: {selected.batteryHealth}
              </p>
            ) : product.condition === "seminovo" ? (
              <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-emerald-100 px-3 py-1 text-xs font-bold text-ink">
                <BatteryCharging className="h-4 w-4 text-emerald-700" /> Bateria Excelente (80%+)
              </p>
            ) : null}
            {selected?.notes && (
              <p className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-amber-200 px-3 py-1 text-xs font-extrabold text-ink shadow-[2px_2px_0_0_#141414]">
                <FileText className="h-4 w-4 text-ink" /> Obs: {selected.notes}
              </p>
            )}
          </div>

          {/* Status do Estoque */}
          {selected && (
            <div className="mt-2.5">
              {(selected.quantity ?? 1) > 1 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-950">
                  📦 {selected.quantity} unidades disponíveis em estoque
                </span>
              ) : (selected.quantity ?? 1) === 1 && isAvailable ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950">
                  ⚡ Última unidade disponível em estoque!
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-red-100 px-3 py-1 text-xs font-bold text-red-950">
                  ❌ Esgotado no momento
                </span>
              )}
            </div>
          )}

          {/* Preço */}
          <div className="mt-5 rounded-2xl border-2 border-ink bg-white p-5 shadow-[4px_4px_0_0_#141414]">
            {price != null && isAvailable ? (
              <>
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">No cartão em</p>
                <p className="font-display text-4xl font-bold text-ink md:text-5xl">
                  12x de {formatBRL(installmentFromFees(price, 12, s.fees["12"] ?? maxFee))}
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-600">
                  ou <span className="font-display text-2xl font-bold text-ink">{formatBRL(price)}</span> à vista (PIX ou dinheiro)
                </p>
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
              {derived.storages.map((st) => {
                const ok = derived.storageAvailable(st);
                const isSelected = storage === st;
                return (
                  <button
                    key={st}
                    onClick={() => pickStorage(st)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition ${
                      isSelected
                        ? "border-ink bg-ink !text-brand font-bold shadow-[2px_2px_0_0_#141414]"
                        : ok
                          ? "border-ink/30 bg-white text-ink hover:border-ink"
                          : "border-dashed border-neutral-300 bg-neutral-100 text-neutral-400 hover:border-ink/50"
                    }`}
                  >
                    <span>{st}</span>
                    {!ok && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                        Esgotado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </OptionGroup>

          {/* Cores */}
          <OptionGroup icon={<Palette className="h-4 w-4" />} label={`Cor — ${color || "selecione"}`}>
            <div className="flex flex-wrap gap-2">
              {derived.colors.map((c) => {
                const ok = derived.colorAvailable(c);
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    onClick={() => pickColor(c)}
                    className={`flex items-center gap-2 rounded-full border-2 px-3.5 py-2 text-sm font-semibold transition ${
                      isSelected
                        ? "border-ink bg-ink !text-brand font-bold shadow-[2px_2px_0_0_#141414]"
                        : ok
                          ? "border-ink/30 bg-white text-ink hover:border-ink"
                          : "border-dashed border-neutral-300 bg-neutral-100 text-neutral-500 hover:border-ink/50"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-ink/40 shrink-0"
                      style={{ backgroundColor: derived.colorHex(c) }}
                    />
                    <span>{c}</span>
                    {!ok && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                        Esgotado
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </OptionGroup>

          {/* Opções / Unidades em Estoque (quando há unidades da mesma cor) */}
          {(() => {
            const hasMultipleUnits = derived.matchingVariants.length > 1;

            if (!hasMultipleUnits) return null;

            return (
              <OptionGroup icon={<BadgeCheck className="h-4 w-4" />} label="Selecione a Unidade / Aparelho Específico">
                <div className="grid gap-2 sm:grid-cols-2">
                  {derived.matchingVariants.map((v, idx) => {
                    const isSelectedUnit = selected?.id === v.id;
                    return (
                      <button
                        key={v.id ?? idx}
                        type="button"
                        onClick={() => setSelectedVariantId(v.id ?? null)}
                        className={`flex flex-col gap-1 rounded-2xl border-2 p-3 text-left transition ${
                          isSelectedUnit
                            ? "border-ink bg-brand/20 shadow-[3px_3px_0_0_#141414]"
                            : v.available && (v.quantity ?? 1) > 0
                              ? "border-ink/30 bg-white text-ink hover:border-ink"
                              : "border-dashed border-neutral-300 bg-neutral-100 text-neutral-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-ink text-sm">
                            📱 Unidade #{idx + 1} {v.batteryHealth ? `• Bat. ${v.batteryHealth}` : ""}
                          </span>
                          <span className="font-display font-extrabold text-ink">
                            {formatBRL(v.priceCash)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
                          {v.warranty && (
                            <span className="rounded-md bg-amber-100 px-2 py-0.5 font-bold text-amber-900">
                              🛡️ {v.warranty}
                            </span>
                          )}
                          {v.notes && (
                            <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-semibold text-neutral-700">
                              📝 {v.notes}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </OptionGroup>
            );
          })()}

          {/* SOBRE ESTE APARELHO (Diferenciais e Observações da Variante) */}
          <div className="mt-6 rounded-2xl border-2 border-ink bg-white p-5 shadow-[4px_4px_0_0_#141414]">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border-2 border-ink bg-brand font-bold text-ink">
                📱
              </div>
              <h2 className="font-display text-xl font-bold text-ink">Sobre este aparelho</h2>
            </div>

            {/* Observações / Histórico Específico desta Variante */}
            {selected?.notes && (
              <div className="mt-4 rounded-xl border-2 border-ink bg-amber-100 p-4 shadow-[2px_2px_0_0_#141414]">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-amber-900 shrink-0" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                    Detalhes & Histórico desta Unidade
                  </span>
                </div>
                <p className="mt-1 text-sm font-bold leading-relaxed text-amber-950">
                  {selected.notes}
                </p>
              </div>
            )}

            {/* Descrição Geral */}
            {product.description && (
              <p className="mt-4 whitespace-pre-line text-sm font-medium leading-relaxed text-neutral-700">
                {product.description}
              </p>
            )}

            {/* Diferenciais da Loja */}
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-xl border border-ink/20 bg-neutral-50 p-3 text-xs font-bold text-ink">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Garantia de {selected?.warranty || product.warranty || "1 ano de garantia"}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-ink/20 bg-neutral-50 p-3 text-xs font-bold text-ink">
                <BadgeCheck className="h-4 w-4 text-blue-600 shrink-0" />
                <span>100% Testado, Revisado & Original</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-ink/20 bg-neutral-50 p-3 text-xs font-bold text-ink">
                <BatteryCharging className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Bateria: {selected?.batteryHealth || "Excelente (80%+)"}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-ink/20 bg-neutral-50 p-3 text-xs font-bold text-ink">
                <Package className="h-4 w-4 text-brand shrink-0" />
                <span>Pronta entrega em Jardim e Guia Lopes</span>
              </div>
            </div>
          </div>

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
              <div className="space-y-2">
                <p className="rounded-xl border-2 border-dashed border-red-300 bg-red-50 p-3 text-center text-xs font-bold text-red-700">
                  ⚠️ Esta opção ({storage} - {color}) está esgotada no momento.
                </p>
                <a
                  href={waLink(
                    s.whatsappJardim,
                    `Olá! Tenho interesse no ${product.name} ${version} ${storage} na cor ${color}. Podem me avisar quando chegar em estoque?`,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-ink px-6 py-4 font-display text-lg font-bold text-brand shadow-[4px_4px_0_0_#141414] transition hover:-translate-y-0.5"
                >
                  <MessageCircle className="h-5 w-5" /> Avise-me no WhatsApp quando chegar
                </a>
              </div>
            )}
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
          ? "border-ink bg-ink !text-brand font-bold shadow-[2px_2px_0_0_#141414]"
          : disabled
            ? "cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400 opacity-70"
            : "border-ink/30 bg-white text-ink hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}
