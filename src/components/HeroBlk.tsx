import { useEffect, useRef, useState } from "react";
import { ArrowRight, Play } from "lucide-react";
import { openWhatsAppModal } from "@/lib/whatsappModal";
import { WhatsAppIcon } from "./WhatsAppModal";

export default function HeroBlk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Atributos estritos obrigatórios pelo iOS WebKit (Safari e Chrome no iPhone) para autoplay
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const tryPlay = () => {
      const p = video.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        }).catch((err) => {
          // Bloqueado pelo iOS (ex: Modo de Pouca Energia / Bateria Fraca)
          console.log("[HeroVideo] Autoplay bloqueado pelo navegador:", err);
          setAutoplayBlocked(true);
        });
      }
    };

    // Tenta reproduzir assim que o elemento é montado e nos eventos do ciclo de vida
    tryPlay();
    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("canplaythrough", tryPlay);
    video.addEventListener("playing", () => {
      setIsPlaying(true);
      setAutoplayBlocked(false);
    });
    video.addEventListener("error", () => {
      console.warn("[HeroVideo] Erro na mídia:", video.error?.code, video.error?.message);
    });

    // Desbloqueio imediato na fase de captura (capture: true) em qualquer gesto no iPhone
    const unlockOnGesture = () => {
      video.muted = true;
      video.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {});
    };

    window.addEventListener("touchstart", unlockOnGesture, { passive: true, capture: true });
    window.addEventListener("touchend", unlockOnGesture, { passive: true, capture: true });
    window.addEventListener("scroll", unlockOnGesture, { passive: true, capture: true });
    window.addEventListener("click", unlockOnGesture, { passive: true, capture: true });

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("canplaythrough", tryPlay);
      window.removeEventListener("touchstart", unlockOnGesture, { capture: true });
      window.removeEventListener("touchend", unlockOnGesture, { capture: true });
      window.removeEventListener("scroll", unlockOnGesture, { capture: true });
      window.removeEventListener("click", unlockOnGesture, { capture: true });
    };
  }, []);

  const handleManualPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().then(() => {
      setIsPlaying(true);
      setAutoplayBlocked(false);
    }).catch((err) => {
      console.warn("[HeroVideo] Falha ao iniciar manualmente:", err);
    });
  };

  return (
    <section
      onClick={handleManualPlay}
      className="relative flex min-h-[580px] sm:min-h-[640px] md:min-h-[700px] flex-col items-center justify-center overflow-hidden bg-neutral-950 px-4 py-12 sm:py-16 text-center select-none"
    >
      {/* Camada do poster estático: visível imediatamente desde o frame 0 (sem tela preta) e esmaece suavemente */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ${
          isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        style={{ backgroundImage: "url('/hero-poster.jpg?v=ldc6')" }}
        aria-hidden="true"
      />

      {/* Vídeo de fundo com streaming HTTP 206 Byte-Ranges nativo */}
      <video
        ref={videoRef}
        src="/hero.mp4?v=ldc6"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/hero-poster.jpg?v=ldc6"
        className="absolute inset-0 h-full w-full object-cover object-center"
      />

      {/* Overlay de gradiente cinematográfico para contraste perfeito e letreiro visível */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-black/85 pointer-events-none" />

      {/* Conteúdo centralizado e perfeitamente enquadrado para celular */}
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-2 sm:px-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl drop-shadow-md leading-tight sm:leading-tight">
          Seu próximo iPhone é aqui na Lojinha.
        </h1>
        <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-sm sm:text-lg md:text-xl text-white/90 drop-shadow-sm font-medium leading-relaxed">
          iPhones lacrados e seminovos com garantia e procedência, pronta entrega e
          assistência técnica em Jardim e Guia Lopes.
        </p>

        {/* Botões de conversão com medidas ideais para não truncar palavras no celular */}
        <div className="mt-6 sm:mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
          <a
            href="#vitrine"
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

        {/* Botão sutil quando o modo de economia de energia do iOS bloqueia autoplay */}
        {autoplayBlocked && !isPlaying && (
          <button
            type="button"
            onClick={handleManualPlay}
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
