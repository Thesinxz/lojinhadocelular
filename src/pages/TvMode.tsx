import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, Play, Pause, ChevronLeft, ChevronRight, Expand, Smartphone, MessageCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, CATEGORIES } from "@contracts/types";
import { useShopSettings, optimizeImageUrl } from "@/lib/shop";
import { IPHONE_CATALOG } from "@/lib/iphoneCatalog";
import { DEMO_PRODUCTS } from "@/lib/catalogDemo";

const SLIDE_SECONDS = 7;

export default function TvMode() {
  const s = useShopSettings();
  // Atualiza estoque a cada 60s automaticamente
  const query = trpc.shop.products.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const products = useMemo(() => {
    const fromDb = (query.data ?? []).filter((p) => p.variants.some((v) => v.available));
    if (fromDb.length > 0) return fromDb;
    return DEMO_PRODUCTS as unknown as ProductWithVariants[];
  }, [query.data]);

  const [index, setIndex] = useState(0);
  const [colorIndexes, setColorIndexes] = useState<Record<number, number>>({});
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  const current = products[index % Math.max(products.length, 1)] as
    | ProductWithVariants
    | undefined;

  const nextSlide = useCallback(() => {
    if (current) {
      setColorIndexes((prev) => ({
        ...prev,
        [current.id]: (prev[current.id] ?? 0) + 1,
      }));
    }
    setIndex((i) => (i + 1) % Math.max(products.length, 1));
  }, [current, products.length]);

  const prevSlide = useCallback(() => {
    setIndex((i) => (i - 1 + products.length) % Math.max(products.length, 1));
  }, [products.length]);

  // Avanço automático com barra de progresso
  useEffect(() => {
    if (paused || products.length <= 1) return;
    const startedAt = Date.now();
    setProgress(0);
    timerRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      setProgress(Math.min(elapsed / SLIDE_SECONDS, 1));
      if (elapsed >= SLIDE_SECONDS) {
        nextSlide();
      }
    }, 100);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [paused, index, products.length, current, nextSlide]);

  // Navegação por teclado (controle/remoto da TV)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === " ") setPaused((p) => !p);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nextSlide, prevSlide]);

  // Pré-carregamento proativo com cache único em memória para Smart TVs
  const preloadedUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (products.length === 0) return;

    for (let offset = 0; offset <= 4; offset++) {
      const p = products[(index + offset) % products.length];
      if (!p) continue;

      const urls = [
        p.imageUrl,
        ...p.variants.map((v) => v.imageUrl),
        IPHONE_CATALOG.find((m) => p.name.toLowerCase().includes(m.name.toLowerCase()))?.colors[0]?.imageUrl,
      ].filter(Boolean) as string[];

      urls.forEach((url) => {
        const optimized = optimizeImageUrl(url, 1000);
        if (optimized && !preloadedUrlsRef.current.has(optimized)) {
          preloadedUrlsRef.current.add(optimized);
          const img = new Image();
          img.src = optimized;
        }
      });
    }
  }, [index, products]);

  function toggleFullscreen() {
    try {
      const elem = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
      };
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void> | void;
      };
      if (!elem) return;
      if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
        if (elem.requestFullscreen) {
          elem.requestFullscreen().catch(() => {});
        } else if (elem.webkitRequestFullscreen) {
          try {
            elem.webkitRequestFullscreen();
          } catch {}
        } else if (elem.msRequestFullscreen) {
          try {
            elem.msRequestFullscreen();
          } catch {}
        }
      } else {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          try {
            doc.webkitExitFullscreen();
          } catch {}
        }
      }
    } catch (e) {
      console.warn("Fullscreen não suportado ou bloqueado no navegador:", e);
    }
  }

  const [hideBars, setHideBars] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#070709] text-white select-none overflow-hidden">
      {/* Barra superior Showroom */}
      {!hideBars && (
        <header className="flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-md px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <img src="/images/logo-icon.png" alt="Logo" className="h-9 w-auto object-contain md:h-10" />
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="block font-display text-lg font-bold text-white md:text-xl">Lojinha do Celular</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  AO VIVO NA LOJA
                </span>
              </div>
              <span className="block text-[11px] font-semibold tracking-wider text-neutral-400">
                Vitrine Digital & Showroom
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold text-neutral-200 md:flex">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Aparelhos com até 1 ano de garantia
            </div>
            <div className="hidden items-center gap-1.5 text-xs text-neutral-400 lg:flex">
              <Smartphone className="h-3.5 w-3.5 text-neutral-400" /> Pronta-entrega em Jardim e Guia Lopes
            </div>
          </div>
        </header>
      )}

      {/* Slide principal (ocupa toda a altura disponível) */}
      <main className="relative flex-1 overflow-hidden">
        {query.isLoading && products.length === 0 ? (
          <div className="flex h-full items-center justify-center font-display text-2xl font-semibold text-neutral-400 animate-pulse">
            Carregando vitrine showroom...
          </div>
        ) : !current ? (
          <div className="flex h-full items-center justify-center font-display text-2xl font-bold text-white">
            Nenhum produto disponível no momento
          </div>
        ) : (
          <Slide
            key={`${current.id}-${index}`}
            product={current}
            colorIndex={colorIndexes[current.id] ?? 0}
            installmentsMax={s.installmentsMax}
            fees={s.fees}
            whatsapp={s.whatsappJardim}
          />
        )}
      </main>

      {/* Barra inferior: progresso + controles */}
      {!hideBars && (
        <footer className="border-t border-white/10 bg-black/60 backdrop-blur-md shrink-0">
          <div className="h-1.5 w-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-[#0071e3] to-cyan-400 transition-[width] duration-100 ease-linear shadow-[0_0_12px_rgba(0,113,227,0.8)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-6 py-2.5">
            <p className="truncate text-xs font-medium text-neutral-400 md:text-sm">
              📍 {s.addressJardim} &nbsp;•&nbsp; {s.addressGll} &nbsp;•&nbsp; Importados
              com procedência &nbsp;•&nbsp; Seminovos revisados &nbsp;•&nbsp; Assistência técnica
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={prevSlide}
                className="cursor-pointer rounded-lg p-2 text-neutral-300 hover:bg-white/10 hover:text-white transition"
                aria-label="Anterior"
                title="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPaused((p) => !p)}
                className="cursor-pointer rounded-lg p-2 text-neutral-300 hover:bg-white/10 hover:text-white transition"
                aria-label="Pausar"
                title="Pausar"
              >
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
              <button
                onClick={nextSlide}
                className="cursor-pointer rounded-lg p-2 text-neutral-300 hover:bg-white/10 hover:text-white transition"
                aria-label="Próximo"
                title="Próximo"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => {
                  setHideBars(true);
                  toggleFullscreen();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                title="Maximizar tela para Smart TV"
              >
                <Expand className="h-3.5 w-3.5" /> Tela Cheia
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Botão flutuante para restaurar barras se estiver no modo oculto */}
      {hideBars && (
        <button
          onClick={() => setHideBars(false)}
          className="absolute right-6 top-6 z-50 rounded-full border border-white/20 bg-black/60 backdrop-blur-md p-3 text-white shadow-lg hover:bg-black/80 transition"
          title="Exibir barras superiores e inferiores"
        >
          <Expand className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

function Slide({
  product,
  colorIndex = 0,
  installmentsMax,
  fees,
  whatsapp,
}: {
  product: ProductWithVariants;
  colorIndex?: number;
  installmentsMax: number;
  fees: Record<string, number>;
  whatsapp: string;
}) {
  const available = useMemo(
    () => product.variants.filter((v) => v.available),
    [product.variants],
  );

  const priceCents = useMemo(() => {
    const list = available.length > 0 ? available : product.variants;
    return list.length > 0 ? Math.min(...list.map((v) => v.priceCash)) : 0;
  }, [available, product.variants]);

  const fee12 = fees["12"] ?? fees[String(installmentsMax)] ?? 0;
  const installment12 = installmentFromFees(priceCents, 12, fee12);
  const storages = useMemo(
    () => [...new Set((available.length > 0 ? available : product.variants).map((v) => v.storage))],
    [available, product.variants],
  );

  const categoryLabel =
    CATEGORIES.find((c) => c.value === product.category)?.label ?? product.category;

  // Mapeia TODAS as cores cadastradas nas variantes do produto
  const colorItems = useMemo(() => {
    const map = new Map<string, { color: string; hex: string; imageUrl?: string }>();
    const vars = product.variants;

    for (const v of vars) {
      if (!v.color) continue;
      if (!map.has(v.color)) {
        map.set(v.color, {
          color: v.color,
          hex: v.colorHex ?? "#111111",
          imageUrl: v.imageUrl || product.imageUrl || undefined,
        });
      } else if (v.imageUrl && !map.get(v.color)?.imageUrl) {
        map.get(v.color)!.imageUrl = v.imageUrl;
      }
    }

    const result = Array.from(map.values());
    if (result.length === 0 && product.imageUrl) {
      return [{ color: "", hex: "#111111", imageUrl: product.imageUrl }];
    }
    return result;
  }, [product.variants, product.imageUrl]);

  // Foto e cor exibidas nesta passada do aparelho na TV
  const activeItem = colorItems[colorIndex % Math.max(colorItems.length, 1)];

  const [qr, setQr] = useState("");
  useEffect(() => {
    const url = `${window.location.origin}/produto/${product.id}`;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#141414", light: "#ffffff" } })
      .then(setQr)
      .catch(() => {});
  }, [product.id]);

  const catalogFallbackImg = useMemo(() => {
    return IPHONE_CATALOG.find((m) => product.name.toLowerCase().includes(m.name.toLowerCase()))?.colors[0]?.imageUrl;
  }, [product.name]);

  const rawImg = activeItem?.imageUrl || product.imageUrl || catalogFallbackImg || "";
  const optimizedImg = rawImg ? optimizeImageUrl(rawImg, 700) : "";
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="tv-slide-in grid h-full grid-cols-1 md:grid-cols-2 overflow-hidden">
      {/* Coluna Esquerda: Vitrine do Aparelho */}
      <div className="relative flex items-center justify-center p-4 md:p-8 h-full w-full overflow-hidden">
        <div className="relative flex aspect-square h-full max-h-[72vh] w-full max-w-[72vh] items-center justify-center overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]">
          {!isLoaded && rawImg && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800" />
          )}
          {rawImg ? (
            <img
              key={rawImg}
              src={optimizedImg}
              alt={product.name}
              loading="eager"
              decoding="async"
              onLoad={() => setIsLoaded(true)}
              onError={(e) => {
                if (rawImg && e.currentTarget.src !== rawImg) {
                  e.currentTarget.src = rawImg;
                }
              }}
              className={`h-full w-full object-contain p-6 transition-all duration-500 scale-102 ${
                isLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center font-semibold text-neutral-500">Sem foto</div>
          )}

          {/* Badge de Condição no Topo */}
          <span className="absolute left-5 top-5 z-10 rounded-full border border-white/20 bg-white/15 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
            {product.condition === "seminovo" ? "🔄 Seminovo Revisado" : product.condition === "lacrado" ? "✨ 100% Lacrado" : "✨ Original"}
          </span>

          {/* Tag de cor atual exibida na foto */}
          {activeItem?.color && (
            <span className="absolute bottom-5 left-5 z-10 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-4 py-1.5 text-xs font-semibold text-white backdrop-blur-md shadow-md">
              {activeItem.hex && (
                <span className="h-3.5 w-3.5 rounded-full border border-white/40 shadow-xs" style={{ backgroundColor: activeItem.hex }} />
              )}
              Cor: {activeItem.color}
            </span>
          )}

          {/* Indicador de fotos/cores */}
          {colorItems.length > 1 && (
            <div className="absolute bottom-5 right-5 z-10 flex gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 backdrop-blur-md shadow">
              {colorItems.map((_, i) => (
                <span
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === (colorIndex % colorItems.length) ? "w-5 bg-white" : "w-2 bg-white/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Coluna Direita: Informações & Oferta Comercial */}
      <div className="flex flex-col justify-between gap-4 p-6 md:p-8 h-full overflow-hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
              {product.brand} • {categoryLabel}
            </p>
          </div>
          <h2 className="mt-1 font-display text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl tracking-tight break-words">
            {product.name}
          </h2>

          <div className="mt-3 flex flex-wrap gap-2">
            {storages.map((st) => (
              <span key={st} className="rounded-full border border-white/15 bg-white/10 px-3.5 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
                {st}
              </span>
            ))}
            {/* Cores cadastradas */}
            {colorItems.map((item) => {
              const isSelectedColor = activeItem?.color === item.color;
              return (
                <span
                  key={item.color}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold transition-all duration-300 ${
                    isSelectedColor
                      ? "border-white bg-white text-[#070709] scale-105 shadow-md font-bold"
                      : "border-white/15 bg-white/5 text-neutral-300"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-black/20"
                    style={{ backgroundColor: item.hex }}
                  />
                  {item.color}
                </span>
              );
            })}
          </div>
        </div>

        {/* Card de Preço Imponente para TV */}
        <div className="rounded-3xl border border-white/15 bg-gradient-to-br from-white/[0.09] to-white/[0.03] backdrop-blur-2xl p-6 md:p-7 shadow-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
            Condição especial no cartão
          </p>
          <p className="mt-1 font-display text-5xl font-extrabold leading-none text-white md:text-6xl lg:text-7xl tracking-tight">
            12x de <span className="text-white">{formatBRL(installment12)}</span>
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              PIX OU DINHEIRO
            </span>
            <p className="text-base font-medium text-neutral-300">
              ou <span className="font-display text-2xl sm:text-3xl font-bold text-white">{formatBRL(priceCents)}</span> à vista
            </p>
          </div>

          {(() => {
            const activeVariant = product.variants.find((v) => v.color === activeItem?.color) ?? product.variants[0];
            const displayWarranty = activeVariant?.warranty || product.warranty || "1 ano de garantia";
            return (
              <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-white/10">
                <p className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> {displayWarranty}
                </p>
                {activeVariant?.batteryHealth && (
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-400">
                    🔋 Bateria {activeVariant.batteryHealth}
                  </p>
                )}
                {activeVariant?.notes && (
                  <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
                    📝 {activeVariant.notes}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* QR Code + Call to action para clientes na loja */}
        <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-4">
          {qr && (
            <div className="shrink-0 rounded-2xl bg-white p-2 shadow-xl">
              <img src={qr} alt="QR Code" className="h-20 w-20 md:h-22 md:w-22" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#25D366]" />
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-300">Compre pelo celular</p>
            </div>
            <p className="font-display text-base sm:text-lg font-bold text-white mt-0.5 leading-snug">
              Aponte a câmera e fale com nossa equipe no WhatsApp
            </p>
            <p className="mt-1 text-xs font-medium text-neutral-400">
              WhatsApp Loja: {whatsapp ? `(${whatsapp.slice(2, 4)}) ${whatsapp.slice(4, 9)}-${whatsapp.slice(9)}` : "(67) 99208-6012"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
