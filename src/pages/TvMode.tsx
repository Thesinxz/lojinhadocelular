import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { ShieldCheck, Play, Pause, ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { trpc } from "@/providers/trpc";
import type { ProductWithVariants } from "@/providers/trpc";
import { formatBRL, installmentFromFees, CATEGORIES } from "@contracts/types";
import { useShopSettings } from "@/lib/shop";

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

  function start() {
    setStarted(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
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

  return (
    <div className="fixed inset-0 z-50 flex cursor-none flex-col bg-brand select-none">
      {/* Barra superior */}
      <div className="flex items-center justify-between border-b-4 border-ink bg-brand px-6 py-3">
        <div className="flex items-center gap-3">
          <img src="/images/logo-icon.png" alt="" className="h-10 w-auto object-contain md:h-12" />
          <div className="leading-tight">
            <span className="block font-display text-xl font-bold text-ink md:text-2xl">Lojinha do Celular</span>
            <span className="block text-xs font-bold uppercase tracking-widest text-ink/60">
              Reparos e Acessórios
            </span>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-1.5 text-sm font-bold text-ink md:flex">
          <ShieldCheck className="h-4 w-4" /> 1 ano de garantia em todos os aparelhos
        </div>
      </div>

      {/* Slide */}
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

      {/* Barra inferior: progresso + ticker */}
      <div className="border-t-4 border-ink bg-ink">
        <div className="h-1.5 w-full bg-white/10">
          <div
            className="h-full bg-brand transition-[width] duration-100 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-6 py-2.5">
          <p className="truncate text-sm font-semibold text-brand md:text-base">
            📍 {s.addressJardim} &nbsp;•&nbsp; {s.addressGll} &nbsp;•&nbsp; Importados
            dos EUA &nbsp;•&nbsp; Seminovos revisados &nbsp;•&nbsp; Assistência técnica
          </p>
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <button onClick={prevSlide} className="cursor-pointer rounded-lg p-1.5 text-brand hover:bg-white/10" aria-label="Anterior">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => setPaused((p) => !p)} className="cursor-pointer rounded-lg p-1.5 text-brand hover:bg-white/10" aria-label="Pausar">
              {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </button>
            <button onClick={nextSlide} className="cursor-pointer rounded-lg p-1.5 text-brand hover:bg-white/10" aria-label="Próximo">
              <ChevronRight className="h-5 w-5" />
            </button>
            <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="cursor-pointer rounded-lg p-1.5 text-brand hover:bg-white/10" aria-label="Tela cheia">
              <Expand className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
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

  const fee = fees[String(installmentsMax)] ?? 0;
  const installment = installmentFromFees(priceCents, installmentsMax, fee);
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

  return (
    <div className="tv-slide-in grid h-full grid-cols-1 md:grid-cols-2">
      {/* Imagem com Alternância de Cores */}
      <div className="relative hidden items-center justify-center p-8 md:flex">
        <div className="relative h-full max-h-[70vh] w-full overflow-hidden rounded-3xl border-4 border-ink bg-white shadow-[10px_10px_0_0_#141414]">
          {activeItem?.imageUrl ? (
            <img
              key={activeItem.imageUrl}
              src={activeItem.imageUrl}
              alt={product.name}
              className="h-full w-full object-contain p-6 transition-all duration-500 ease-in-out"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-neutral-300">Sem foto</div>
          )}
          <span className="absolute left-5 top-5 rounded-full border-2 border-ink bg-brand px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-ink">
            {product.condition === "seminovo" ? "Seminovo" : product.condition === "lacrado" ? "Lacrado" : "Novo"}
          </span>

          {/* Tag de cor atual exibida na foto */}
          {activeItem?.color && (
            <span className="absolute bottom-5 left-5 inline-flex items-center gap-2 rounded-full border-2 border-ink bg-ink px-4 py-1.5 text-sm font-bold text-brand shadow-md">
              {activeItem.hex && (
                <span className="h-3.5 w-3.5 rounded-full border border-white/50" style={{ backgroundColor: activeItem.hex }} />
              )}
              Cor: {activeItem.color}
            </span>
          )}

          {/* Indicador de fotos */}
          {colorItems.length > 1 && (
            <div className="absolute bottom-5 right-5 flex gap-1.5 rounded-full border-2 border-ink bg-white/90 px-3 py-1.5 shadow">
              {colorItems.map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    i === (colorIndex % colorItems.length) ? "w-6 bg-ink" : "w-2.5 bg-ink/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-col justify-center gap-4 px-6 py-6 md:px-10">
        <p className="text-sm font-bold uppercase tracking-widest text-ink/60">
          {product.brand} • {categoryLabel}
        </p>
        <h2 className="font-display text-4xl font-bold leading-none text-ink md:text-6xl">
          {product.name}
        </h2>

        <div className="flex flex-wrap gap-2">
          {storages.map((st) => (
            <span key={st} className="rounded-full border-2 border-ink bg-white px-4 py-1.5 text-sm font-bold text-ink">
              {st}
            </span>
          ))}
          {/* Exibe TODAS as cores cadastradas nas variantes e destaca a cor da foto atual */}
          {colorItems.map((item) => {
            const isSelectedColor = activeItem?.color === item.color;
            return (
              <span
                key={item.color}
                className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-4 py-1.5 text-sm font-bold transition-all duration-300 ${
                  isSelectedColor
                    ? "bg-ink text-brand scale-105 shadow-[3px_3px_0_0_#141414]"
                    : "bg-white text-ink"
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full border border-ink/40"
                  style={{ backgroundColor: item.hex }}
                />
                {item.color}
              </span>
            );
          })}
        </div>

        <div className="mt-2 rounded-3xl border-4 border-ink bg-white p-6 shadow-[8px_8px_0_0_#141414]">
          <p className="text-sm font-bold uppercase tracking-widest text-neutral-500">À vista</p>
          <p className="font-display text-6xl font-bold leading-none text-ink md:text-7xl">
            {formatBRL(priceCents)}
          </p>
          {installmentsMax > 1 && (
            <p className="mt-2 font-display text-2xl font-bold text-ink/70">
              ou {installmentsMax}x de {formatBRL(installment)}
            </p>
          )}
          {product.variants.find((v) => v.batteryHealth)?.batteryHealth ? (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-emerald-300 px-3.5 py-1 text-sm font-extrabold text-ink shadow-[2px_2px_0_0_#141414]">
              🔋 Saúde da Bateria: {product.variants.find((v) => v.batteryHealth)?.batteryHealth}
            </p>
          ) : (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1 text-sm font-bold text-ink">
              <ShieldCheck className="h-4 w-4" /> {product.warranty ?? "1 ano de garantia"}
            </p>
          )}
        </div>

        {/* QR + WhatsApp */}
        <div className="flex items-center gap-4">
          {qr && (
            <div className="rounded-2xl border-4 border-ink bg-white p-2 shadow-[5px_5px_0_0_#141414]">
              <img src={qr} alt="QR Code do produto" className="h-24 w-24 md:h-28 md:w-28" />
            </div>
          )}
          <div>
            <p className="font-display text-xl font-bold leading-tight text-ink md:text-2xl">
              Aponte a câmera<br />e compre pelo celular
            </p>
            <p className="mt-1 text-sm font-semibold text-ink/60">
              WhatsApp: {whatsapp ? `(${whatsapp.slice(2, 4)}) ${whatsapp.slice(4, 9)}-${whatsapp.slice(9)}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
