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

    // Atributos obrigatórios pelo iOS Safari e Android Chrome para liberar autoplay sem som
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const triggerPlay = () => {
      const p = video.play();
      if (p !== undefined) {
        p.then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        }).catch(() => {
          // Bloqueado pelo iOS (Modo de Pouca Energia / 11% de bateria)
          setAutoplayBlocked(true);
        });
      }
    };

    // Tenta reproduzir em múltiplos estágios do ciclo de vida da mídia
    triggerPlay();
    video.addEventListener("loadedmetadata", triggerPlay);
    video.addEventListener("canplay", triggerPlay);
    video.addEventListener("playing", () => {
      setIsPlaying(true);
      setAutoplayBlocked(false);
    });

    // Desbloqueia ao primeiro toque, clique ou rolagem de tela em modo de economia
    const unlockOnGesture = () => {
      video.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {});
    };

    window.addEventListener("touchstart", unlockOnGesture, { passive: true });
    window.addEventListener("touchend", unlockOnGesture, { passive: true });
    window.addEventListener("scroll", unlockOnGesture, { passive: true });
    window.addEventListener("click", unlockOnGesture, { passive: true });

    return () => {
      video.removeEventListener("loadedmetadata", triggerPlay);
      video.removeEventListener("canplay", triggerPlay);
      window.removeEventListener("touchstart", unlockOnGesture);
      window.removeEventListener("touchend", unlockOnGesture);
      window.removeEventListener("scroll", unlockOnGesture);
      window.removeEventListener("click", unlockOnGesture);
    };
  }, []);

  const handleManualPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.play().then(() => {
      setIsPlaying(true);
      setAutoplayBlocked(false);
    }).catch(() => {});
  };

  return (
    <section
      onClick={handleManualPlay}
      className="relative flex min-h-[580px] sm:min-h-[640px] md:min-h-[700px] flex-col items-center justify-center overflow-hidden bg-neutral-950 px-4 py-12 sm:py-16 text-center select-none"
    >
      {/* Camada do poster estático: visível imediatamente desde o frame 0 (sem tela preta) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero-poster.jpg?v=ldc4')" }}
        aria-hidden="true"
      />

      {/* Vídeo de fundo com src direto + streams de fallback (7MB mobile / 15MB desktop) */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/hero-poster.jpg?v=ldc4"
        className="absolute inset-0 h-full w-full object-cover object-center"
      >
        <source src="/hero-mobile.mp4?v=ldc4" media="(max-width: 768px)" type="video/mp4" />
        <source src="/hero.mp4?v=ldc4" type="video/mp4" />
      </video>

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
