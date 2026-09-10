import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { MessageCircle } from "lucide-react";
import { DEMO_CLIENTS } from "@/lib/catalogDemo";
import { useShopSettings, waLink } from "@/lib/shop";

export default function HeroBlk() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567999999999";

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

  // Duplicar lista de clientes para loop contínuo e sem emendas
  const marqueeClients = [
    ...DEMO_CLIENTS,
    ...DEMO_CLIENTS,
    ...DEMO_CLIENTS,
    ...DEMO_CLIENTS,
  ];

  return (
    <section className="relative flex min-h-[620px] flex-col items-center justify-between overflow-hidden bg-[#0a0a0a] px-4 pt-16 pb-8 md:min-h-[700px] md:pt-24 md:pb-12">
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

      {/* Overlay de gradiente */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/45 to-[#0a0a0a]" />

      {/* Conteúdo centralizado */}
      <div className="relative z-10 mx-auto my-auto flex w-full max-w-4xl flex-col items-center text-center">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Seu próximo iPhone está aqui.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-neutral-300 sm:text-lg md:text-xl">
          iPhones lacrados e seminovos com 1 ano de garantia, pronta entrega e
          assistência técnica em Jardim e Guia Lopes.
        </p>

        {/* 3 Botões de conversão rápida */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5 sm:gap-4">
          <a
            href="#vitrine"
            className="rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition hover:bg-neutral-200"
          >
            Ver vitrine ↓
          </a>
          <a
            href={waLink(
              whatsapp,
              "Olá! Gostaria de tirar uma dúvida sobre os iPhones da Lojinha do Celular",
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Falar no WhatsApp</span>
          </a>
          <Link
            to="/avaliacao"
            className="rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
          >
            Avaliar meu iPhone
          </Link>
        </div>
      </div>

      {/* Faixa de Prova Social (Marquee de clientes) */}
      <div className="relative z-10 mt-12 w-full max-w-6xl">
        <p className="mb-3 text-center text-xs font-medium text-neutral-400 sm:text-sm">
          Quem confia e já faz parte da família Lojinha do Celular ❤️
        </p>
        <div className="w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="animate-marquee py-2">
            {marqueeClients.map((client, idx) => (
              <div
                key={`${client.id}-${idx}`}
                className="mr-3 flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15 backdrop-blur-md transition hover:bg-white/20"
              >
                <img
                  src={client.avatarUrl}
                  alt={client.name}
                  className="h-6 w-6 rounded-full object-cover"
                  loading="lazy"
                />
                <span className="text-xs font-medium text-white">
                  {client.name}
                </span>
                <span className="text-xs text-neutral-300">
                  {client.bought}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
