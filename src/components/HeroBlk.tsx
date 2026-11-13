import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { openWhatsAppModal } from "@/lib/whatsappModal";
import { WhatsAppIcon } from "./WhatsAppIcon";

type NetworkInformationLike = {
  saveData?: boolean;
  effectiveType?: string;
};

function isConstrainedConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return conn.effectiveType === "slow-2g" || conn.effectiveType === "2g";
}

function getHeroVideoSrc(): string {
  if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches) {
    return "/hero-mobile.mp4?v=ldc9";
  }
  return "/hero.mp4?v=ldc9";
}

export default function HeroBlk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(() => !isConstrainedConnection());
  const videoSrc = useMemo(() => getHeroVideoSrc(), []);

  useEffect(() => {
    if (!videoEnabled) {
      setAutoplayBlocked(true);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    // Atributos estritos obrigatórios pelo iOS WebKit (Safari e Chrome no iPhone) para autoplay
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const removeGestureListeners = () => {
      window.removeEventListener("touchstart", unlockOnGesture, { capture: true });
      window.removeEventListener("touchend", unlockOnGesture, { capture: true });
      window.removeEventListener("scroll", unlockOnGesture, { capture: true });
      window.removeEventListener("click", unlockOnGesture, { capture: true });
    };

    const markPlaying = () => {
      setIsPlaying(true);
      setAutoplayBlocked(false);
      removeGestureListeners();
    };

    const tryPlay = () => {
      const p = video.play();
      if (p !== undefined) {
        p.then(markPlaying).catch(() => {
          // Bloqueado pelo iOS (ex: Modo de Pouca Energia / Bateria Fraca)
          setAutoplayBlocked(true);
        });
      }
    };

    const onError = () => {
      console.warn("[HeroVideo] Erro na mídia:", video.error?.code, video.error?.message);
    };

    // Desbloqueio imediato na fase de captura em qualquer gesto no iPhone até iniciar
    function unlockOnGesture() {
      video!.muted = true;
      video!.play().then(markPlaying).catch(() => {});
    }

    tryPlay();
    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", markPlaying);
    video.addEventListener("error", onError);

    window.addEventListener("touchstart", unlockOnGesture, { passive: true, capture: true });
    window.addEventListener("touchend", unlockOnGesture, { passive: true, capture: true });
    window.addEventListener("scroll", unlockOnGesture, { passive: true, capture: true });
    window.addEventListener("click", unlockOnGesture, { passive: true, capture: true });

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", markPlaying);
      video.removeEventListener("error", onError);
      removeGestureListeners();
    };
  }, [videoEnabled, videoSrc]);

  const handleManualPlay = () => {
    if (!videoEnabled) {
      setVideoEnabled(true);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().then(() => {
      setIsPlaying(true);
      setAutoplayBlocked(false);
    }).catch(() => {});
  };

  return (
    <section
      onClick={handleManualPlay}
      className="relative flex min-h-[430px] sm:min-h-[580px] md:min-h-[680px] flex-col items-center justify-center overflow-hidden bg-neutral-950 px-4 py-10 sm:py-16 text-center select-none"
    >
      {/* Elemento LCP real em WebP ultraleve, visível imediatamente antes do streaming do vídeo */}
      <picture
        className={`absolute inset-0 transition-opacity duration-700 ${
          isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        aria-hidden="true"
      >
        <source srcSet="/hero-poster.webp?v=ldc9" type="image/webp" />
        <img
          src="/hero-poster.jpg?v=ldc9"
          alt=""
          width={720}
          height={1280}
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
      </picture>

      {/* Vídeo adaptativo (versão mobile leve ~2.4 MB vs desktop) com HTTP 206 Byte-Ranges */}
      {videoEnabled && (
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/hero-poster.webp?v=ldc9"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      )}

      {/* Overlay de gradiente cinematográfico para contraste perfeito e letreiro visível */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-black/85 pointer-events-none" />

      {/* Conteúdo centralizado e perfeitamente enquadrado para celular */}
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-2 sm:px-4">
        <h1 className="font-display text-[1.85rem] leading-[1.12] font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl drop-shadow-md sm:leading-tight">
          Seu próximo iPhone é aqui na Lojinha.
        </h1>
        <p className="mx-auto mt-2.5 sm:mt-4 max-w-2xl text-sm sm:text-lg md:text-xl text-white/90 drop-shadow-sm font-medium leading-relaxed">
          iPhones lacrados e seminovos com garantia e procedência, pronta entrega e
          assistência técnica em Jardim e Guia Lopes.
        </p>

        {/* Botões de conversão com medidas ideais para não truncar palavras no celular */}
        <div className="mt-5 sm:mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          <a
            href="#vitrine"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 sm:px-7 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-neutral-950 transition hover:bg-white/90 active:scale-[0.98] shadow-md"
          >
            <span>Ver ofertas</span>
            <ArrowRight className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openWhatsAppModal(
                "Olá! Gostaria de tirar uma dúvida sobre os iPhones da Lojinha do Celular",
              );
            }}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white transition active:scale-[0.98] shadow-md cursor-pointer"
          >
            <WhatsAppIcon className="h-4 w-4 fill-white" />
            <span>Falar no WhatsApp</span>
          </button>
          <a
            href="https://trocafacil.lojinhadocelular.com"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-[0.98]"
          >
            Avaliar meu iPhone
          </a>
        </div>

        {/* Botão sutil quando o modo de economia de energia / conexão lenta impede autoplay */}
        {autoplayBlocked && !isPlaying && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleManualPlay();
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/50 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur-md hover:bg-black/70 transition shadow-lg animate-pulse cursor-pointer"
          >
            <Play className="h-3.5 w-3.5 fill-white text-white" />
            <span>Toque para assistir o vídeo da loja</span>
          </button>
        )}
      </div>
    </section>
  );
}
