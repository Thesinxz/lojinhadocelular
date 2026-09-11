import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { openWhatsAppModal } from "@/lib/whatsappModal";
import { WhatsAppIcon } from "./WhatsAppModal";

export default function HeroBlk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Garante compatibilidade 100% com autoplay no iOS Safari e Android Chrome
    video.defaultMuted = true;
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("webkit-playsinline", "");

    const startPlayback = () => {
      const p = video.play();
      if (p !== undefined) {
        p.then(() => setIsPlaying(true)).catch(() => {
          // Destrava no primeiro gesto caso o modo de economia de bateria bloqueie
          const unlock = () => {
            video.play().then(() => setIsPlaying(true)).catch(() => {});
            window.removeEventListener("touchstart", unlock);
            window.removeEventListener("touchend", unlock);
            window.removeEventListener("scroll", unlock);
            window.removeEventListener("click", unlock);
          };

          window.addEventListener("touchstart", unlock, { passive: true, once: true });
          window.addEventListener("touchend", unlock, { passive: true, once: true });
          window.addEventListener("scroll", unlock, { passive: true, once: true });
          window.addEventListener("click", unlock, { passive: true, once: true });
        });
      }
    };

    startPlayback();
  }, []);

  return (
    <section className="relative flex min-h-[580px] sm:min-h-[640px] md:min-h-[700px] flex-col items-center justify-center overflow-hidden bg-neutral-950 px-4 py-12 sm:py-16 text-center">
      {/* Camada do poster estático permanente: elimina tela preta instantaneamente */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000"
        style={{ backgroundImage: "url('/hero-poster.jpg?v=ldc3')" }}
        aria-hidden="true"
      />

      {/* Vídeo de fundo com streams responsivos e fade-in suave ao tocar */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/hero-poster.jpg?v=ldc3"
        onPlaying={() => setIsPlaying(true)}
        onLoadedData={() => setIsPlaying(true)}
        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
          isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Stream de 7.1 MB otimizado para celulares (carrega rápido no 4G/5G) */}
        <source src="/hero-mobile.mp4?v=ldc3" media="(max-width: 768px)" type="video/mp4" />
        {/* Stream HD de 15 MB para desktop */}
        <source src="/hero.mp4?v=ldc3" type="video/mp4" />
      </video>

      {/* Overlay de gradiente cinematográfico: destaque para o letreiro neon e fachada da loja */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-black/85 pointer-events-none" />

      {/* Conteúdo centralizado e perfeitamente enquadrado para telas mobile */}
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-2 sm:px-4">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl drop-shadow-md leading-tight sm:leading-tight">
          Seu próximo iPhone é aqui na Lojinha.
        </h1>
        <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-sm sm:text-lg md:text-xl text-white/90 drop-shadow-sm font-medium leading-relaxed">
          iPhones lacrados e seminovos com garantia e procedência, pronta entrega e
          assistência técnica em Jardim e Guia Lopes.
        </p>

        {/* Botões de conversão com medidas ideais para não quebrar textos no celular */}
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
            onClick={() =>
              openWhatsAppModal(
                "Olá! Gostaria de tirar uma dúvida sobre os iPhones da Lojinha do Celular",
              )
            }
            className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] hover:bg-[#20ba59] px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white transition active:scale-[0.98] shadow-md cursor-pointer"
          >
            <WhatsAppIcon className="h-4 w-4 fill-white" />
            <span>Falar no WhatsApp</span>
          </button>
          <a
            href="https://trocafacil.lojinhadocelular.com"
            className="inline-flex items-center rounded-full border border-white/40 bg-white/10 px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-[0.98]"
          >
            Avaliar meu iPhone
          </a>
        </div>
      </div>
    </section>
  );
}
