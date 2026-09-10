import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { MessageCircle, ArrowRight } from "lucide-react";
import { useShopSettings, waLink } from "@/lib/shop";

export default function HeroBlk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.playsInline = true;

    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        const handleUserInteraction = () => {
          video.play().catch(() => {});
          window.removeEventListener("touchstart", handleUserInteraction);
          window.removeEventListener("scroll", handleUserInteraction);
          window.removeEventListener("click", handleUserInteraction);
        };

        window.addEventListener("touchstart", handleUserInteraction, {
          passive: true,
          once: true,
        });
        window.addEventListener("scroll", handleUserInteraction, {
          passive: true,
          once: true,
        });
        window.addEventListener("click", handleUserInteraction, {
          passive: true,
          once: true,
        });
      });
    }
  }, []);

  return (
    <section className="relative flex min-h-[540px] sm:min-h-[600px] md:min-h-[660px] flex-col items-center justify-center overflow-hidden bg-black px-4 py-16 text-center">
      {/* Vídeo de fundo com poster de fallback */}
      <video
        ref={videoRef}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        poster="/hero-poster.jpg"
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/hero.mp4" type="video/mp4" />
      </video>

      {/* Overlay de gradiente escuro cinematográfico */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/75" />

      {/* Conteúdo centralizado */}
      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl drop-shadow-md">
          Seu próximo iPhone é aqui na Lojinha.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white/90 sm:text-lg md:text-xl drop-shadow-sm font-medium">
          iPhones lacrados e seminovos com 1 ano de garantia, pronta entrega e
          assistência técnica em Jardim e Guia Lopes.
        </p>

        {/* 3 Botões de conversão rápida exatamente como no print */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 sm:gap-4">
          <a
            href="#vitrine"
            className="inline-flex items-center gap-1 rounded-full bg-white px-7 py-3 text-sm font-bold text-neutral-950 transition hover:bg-white/90 active:scale-[0.98] shadow-md"
          >
            <span>Ver ofertas</span>
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={waLink(
              whatsapp,
              "Olá! Gostaria de tirar uma dúvida sobre os iPhones da Lojinha do Celular",
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] hover:bg-[#20ba59] px-6 py-3 text-sm font-bold text-white transition active:scale-[0.98] shadow-md"
          >
            <MessageCircle className="h-4 w-4 fill-white/20" />
            <span>Falar no WhatsApp</span>
          </a>
          <Link
            to="/avaliacao"
            className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-[0.98]"
          >
            Avaliar meu iPhone
          </Link>
        </div>
      </div>
    </section>
  );
}
