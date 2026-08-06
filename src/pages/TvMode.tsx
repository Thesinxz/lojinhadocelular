import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, Play, Pause, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, CATEGORIES } from "@contracts/types";
import { useShopSettings, optimizeImageUrl } from "@/lib/shop";
import { IPHONE_CATALOG } from "@/lib/iphoneCatalog";

const SLIDE_SECONDS = 7;

export default function TvMode() {
  const s = useShopSettings();
  // Atualiza estoque a cada 60s automaticamente
  const query = trpc.shop.products.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const products = useMemo(
    () => (query.data ?? []).filter((p) => p.variants.some((v) => v.available)),
    [query.data],
  );

  const [index, setIndex] = useState(0);
  const [colorIndexes, setColorIndexes] = useState<Record<number, number>>({});
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  const current = products[index % Math.max(products.length, 1)] as
    | ProductWithVariants
    | undefined;

  function nextSlide() {
    if (current) {
      setColorIndexes((prev) => ({
        ...prev,
        [current.id]: (prev[current.id] ?? 0) + 1,
      }));
    }
    setIndex((i) => (i + 1) % products.length);
  }

  function prevSlide() {
    setIndex((i) => (i - 1 + products.length) % products.length);
  }

  // Avanço automático com barra de progresso
  useEffect(() => {
    if (!started || paused || products.length <= 1) return;
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
  }, [started, paused, index, products.length, current]);

  // Navegação por teclado (controle/remoto da TV)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") nextSlide();
      if (e.key === "ArrowLeft") prevSlide();
      if (e.key === " ") setPaused((p) => !p);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [products.length, current]);

  // Pré-carregamento proativo de imagens na memória da Smart TV (Instantâneo sem delay)
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
        const optimized = optimizeImageUrl(url, 700);
        if (optimized) {
          const img = new Image();
          img.src = optimized;
        }
      });
    }
  }, [index, products]);

  function toggleFullscreen() {
    const elem = document.documentElement as any;
    if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }

  function start() {
    setStarted(true);
    toggleFullscreen();
  }

  if (!started) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-brand px-6 text-center">
        <img src="/images/logo.png" alt="Lojinha do Celular" className="w-64 max-w-[70vw] rounded-2xl border-4 border-ink shadow-[8px_8px_0_0_#141414]" />
        <h1 className="mt-8 font-display text-3xl font-bold text-ink md:text-5xl">
          Modo TV — Vitrine da Loja
        </h1>
        <p className="mt-2 max-w-md font-medium text-ink/70">
          Os produtos do catálogo vão passar automaticamente em tela cheia.
        </p>
        <button
          onClick={start}
          className="mt-8 inline-flex items-center gap-3 rounded-2xl border-4 border-ink bg-ink px-10 py-5 font-display text-2xl font-bold text-brand shadow-[6px_6px_0_0_rgba(20,20,20,0.4)] transition hover:-translate-y-1"
        >
          <Play className="h-7 w-7" /> Iniciar vitrine
        </button>
      </div>
    );
  }

  const [hideBars, setHideBars] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand select-none overflow-hidden">
      {/* Barra superior (ocultável para 100% de tela) */}
      {!hideBars && (
        <div className="flex items-center justify-between border-b-4 border-ink bg-brand px-6 py-2 shrink-0">
          <div className="flex items-center gap-3">
            <img src="/images/logo-icon.png" alt="" className="h-9 w-auto object-contain md:h-10" />
            <div className="leading-tight">
              <span className="block font-display text-lg font-bold text-ink md:text-xl">Lojinha do Celular</span>
              <span className="block text-[11px] font-bold uppercase tracking-widest text-ink/60">
                Reparos e Acessórios
              </span>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-1 text-xs font-bold text-ink md:flex">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Aparelhos com até 1 ano de garantia
          </div>
        </div>
      )}

      {/* Slide principal (ocupa toda a altura disponível) */}
      <div className="relative flex-1 overflow-hidden">
        {query.isLoading ? (
          <div className="flex h-full items-center justify-center font-display text-2xl font-bold text-ink">
            Carregando vitrine...
          </div>
        ) : !current ? (
          <div className="flex h-full items-center justify-center font-display text-2xl font-bold text-ink">
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
      </div>

      {/* Barra inferior: progresso + controles */}
      {!hideBars && (
        <div className="border-t-4 border-ink bg-ink shrink-0">
          <div className="h-1.5 w-full bg-white/10">
            <div
              className="h-full bg-brand transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-6 py-2">
            <p className="truncate text-xs font-semibold text-brand md:text-sm">
              📍 {s.addressJardim} &nbsp;•&nbsp; {s.addressGll} &nbsp;•&nbsp; Importados
              dos EUA &nbsp;•&nbsp; Seminovos revisados &nbsp;•&nbsp; Assistência técnica
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={prevSlide} className="cursor-pointer rounded-lg p-1.5 text-brand hover:bg-white/10" aria-label="Anterior" title="Anterior">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button onClick={() => setPaused((p) => !p)} className="cursor-pointer rounded-lg p-1.5 text-brand hover:bg-white/10" aria-label="Pausar" title="Pausar">
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
              <button onClick={nextSlide} className="cursor-pointer rounded-lg p-1.5 text-brand hover:bg-white/10" aria-label="Próximo" title="Próximo">
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                onClick={() => setHideBars(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-brand/40 bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand hover:text-ink transition"
                title="Ocultar barras para maximizar tela na TV"
              >
                <Expand className="h-3.5 w-3.5" /> Maximizar Tela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão flutuante para restaurar barras se estiver no modo oculto */}
      {hideBars && (
        <button
          onClick={() => setHideBars(false)}
          className="absolute right-4 top-4 z-50 rounded-full border-2 border-ink bg-white/80 p-2 text-ink shadow-md hover:bg-white"
          title="Exibir barras superiores e inferiores"
        >
          <Expand className="h-4 w-4" />
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
      {/* Imagem em Destaque Ajustada sem Estourar a Altura da TV */}
      <div className="relative flex items-center justify-center p-3 md:p-5 h-full w-full overflow-hidden">
        <div className="relative flex aspect-square h-full max-h-[70vh] w-full max-w-[70vh] items-center justify-center overflow-hidden rounded-3xl border-4 border-ink bg-white shadow-[8px_8px_0_0_#141414]">
          {!isLoaded && rawImg && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-neutral-200 via-neutral-100 to-neutral-200" />
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
              className={`h-full w-full object-contain pt-8 pb-8 px-5 transition-opacity duration-300 ${
                isLoaded ? "opacity-100" : "opacity-0"
              }`}
            />
          ) : (
            <div className="flex h-full items-center justify-center font-bold text-neutral-300">Sem foto</div>
          )}

          <span className="absolute left-4 top-4 z-10 rounded-full border-2 border-ink bg-brand px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-ink shadow-sm">
            {product.condition === "seminovo" ? "Seminovo" : product.condition === "lacrado" ? "Lacrado" : "Novo"}
          </span>

          {/* Tag de cor atual exibida na foto */}
          {activeItem?.color && (
            <span className="absolute bottom-4 left-4 z-10 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-3.5 py-1 text-xs font-bold text-brand shadow-md">
              {activeItem.hex && (
                <span className="h-3 w-3 rounded-full border border-white/50" style={{ backgroundColor: activeItem.hex }} />
              )}
              Cor: {activeItem.color}
            </span>
          )}

          {/* Indicador de fotos */}
          {colorItems.length > 1 && (
            <div className="absolute bottom-4 right-4 z-10 flex gap-1.5 rounded-full border-2 border-ink bg-white/90 px-3 py-1 shadow">
              {colorItems.map((_, i) => (
                <span
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === (colorIndex % colorItems.length) ? "w-5 bg-ink" : "w-2 bg-ink/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Direita Balanceada sem Transbordar */}
      <div className="flex flex-col justify-between gap-3 p-4 md:p-6 h-full overflow-hidden">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-ink/60">
            {product.brand} • {categoryLabel}
          </p>
          <h2 className="font-display text-3xl font-bold leading-tight text-ink md:text-4xl lg:text-5xl break-words">
            {product.name}
          </h2>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {storages.map((st) => (
              <span key={st} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-xs font-bold text-ink">
                {st}
              </span>
            ))}
            {/* Exibe TODAS as cores cadastradas nas variantes e destaca a cor da foto atual */}
            {colorItems.map((item) => {
              const isSelectedColor = activeItem?.color === item.color;
              return (
                <span
                  key={item.color}
                  className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-3 py-1 text-xs font-bold transition-all duration-300 ${
                    isSelectedColor
                      ? "bg-ink text-brand scale-105 shadow-[2px_2px_0_0_#141414]"
                      : "bg-white text-ink"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full border border-ink/40"
                    style={{ backgroundColor: item.hex }}
                  />
                  {item.color}
                </span>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border-4 border-ink bg-white p-4 md:p-5 shadow-[6px_6px_0_0_#141414]">
          <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">No cartão</p>
          <p className="font-display text-4xl font-bold leading-none text-ink md:text-5xl lg:text-6xl">
            12x de {formatBRL(installment12)}
          </p>
          <p className="mt-2 text-lg font-bold text-neutral-600">
            ou <span className="font-display text-2xl font-extrabold text-ink">{formatBRL(priceCents)}</span> à vista
          </p>
          {(() => {
            const activeVariant = product.variants.find((v) => v.color === activeItem?.color) ?? product.variants[0];
            const displayWarranty = activeVariant?.warranty || product.warranty || "1 ano de garantia";
            return (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                <p className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-brand px-2.5 py-0.5 text-[11px] font-bold text-ink shadow-[2px_2px_0_0_#141414]">
                  <ShieldCheck className="h-3.5 w-3.5" /> {displayWarranty}
                </p>
                {activeVariant?.batteryHealth && (
                  <p className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-emerald-300 px-2.5 py-0.5 text-[11px] font-extrabold text-ink shadow-[2px_2px_0_0_#141414]">
                    🔋 Saúde da Bateria: {activeVariant.batteryHealth}
                  </p>
                )}
                {activeVariant?.notes && (
                  <p className="inline-flex items-center gap-1 rounded-full border-2 border-ink bg-amber-200 px-2.5 py-0.5 text-[11px] font-extrabold text-ink shadow-[2px_2px_0_0_#141414]">
                    📝 Obs: {activeVariant.notes}
                  </p>
                )}
              </div>
            );
          })()}
        </div>

        {/* QR + WhatsApp 100% Visível sem Corte */}
        <div className="flex items-center gap-3">
          {qr && (
            <div className="shrink-0 rounded-xl border-3 border-ink bg-white p-1.5 shadow-[4px_4px_0_0_#141414]">
              <img src={qr} alt="QR Code do produto" className="h-20 w-20 md:h-22 md:w-22" />
            </div>
          )}
          <div>
            <p className="font-display text-lg font-bold leading-tight text-ink md:text-xl">
              Aponte a câmera<br />e compre pelo celular
            </p>
            <p className="mt-0.5 text-xs font-semibold text-ink/60">
              WhatsApp: {whatsapp ? `(${whatsapp.slice(2, 4)}) ${whatsapp.slice(4, 9)}-${whatsapp.slice(9)}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
