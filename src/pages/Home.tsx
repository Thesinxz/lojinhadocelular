import { Link } from "react-router";
import {
  ShieldCheck,
  Plane,
  Wrench,
  Smartphone,
  BadgeCheck,
  MapPin,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import ProductCard from "@/components/ProductCard";
import HeroCarousel from "@/components/HeroCarousel";
import { useShopSettings } from "@/lib/shop";

const CATEGORY_CARDS = [
  {
    to: "/catalogo?categoria=iphone_lacrado",
    icon: Sparkles,
    title: "iPhones Lacrados",
    desc: "Importados direto dos EUA, na caixa, com 1 ano de garantia.",
  },
  {
    to: "/catalogo?categoria=iphone_seminovo",
    icon: BadgeCheck,
    title: "iPhones Seminovos",
    desc: "Revisados, com bateria saudável e 1 ano de garantia.",
  },
  {
    to: "/catalogo?categoria=android",
    icon: Smartphone,
    title: "Xiaomi, Realme e Tecno",
    desc: "Os melhores custo-benefício do Android, novos e lacrados.",
  },
  {
    to: "/#servicos",
    icon: Wrench,
    title: "Manutenção",
    desc: "Troca de tela, bateria, conector e muito mais, na hora.",
  },
];

export default function Home() {
  const s = useShopSettings();
  const featured = trpc.shop.featured.useQuery();

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden bg-brand">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-ink">
              <Plane className="h-3.5 w-3.5" /> Importados dos EUA
            </span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] text-ink md:text-6xl">
              Seu próximo iPhone está aqui.
            </h1>
            <p className="mt-4 max-w-md text-base font-medium text-ink/70 md:text-lg">
              iPhones lacrados e seminovos com <strong>1 ano de garantia</strong>,
              além de Xiaomi, Realme, Tecno e assistência técnica completa.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/catalogo"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-ink px-6 py-3 font-display font-bold text-brand shadow-[4px_4px_0_0_rgba(20,20,20,0.3)] transition hover:-translate-y-0.5"
              >
                Ver catálogo <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#unidades"
                className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-white px-6 py-3 font-display font-bold text-ink transition hover:-translate-y-0.5"
              >
                <MapPin className="h-4 w-4" /> Nossas lojas
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-ink">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" /> 1 ano de garantia
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck className="h-4 w-4" /> Seminovos revisados
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Wrench className="h-4 w-4" /> Assistência técnica
              </span>
            </div>
          </div>

          <HeroCarousel images={s.heroImages} />
        </div>
      </section>

      {/* CATEGORIAS */}
      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
          O que você procura?
        </h2>
        <p className="mt-1 text-neutral-600">Escolha uma categoria e confira os modelos disponíveis.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORY_CARDS.map((c) => (
            <Link
              key={c.title}
              to={c.to}
              className="group rounded-2xl border-2 border-ink bg-white p-5 shadow-[4px_4px_0_0_#141414] transition hover:-translate-y-1 hover:bg-brand"
            >
              <c.icon className="h-8 w-8 text-ink" />
              <h3 className="mt-3 font-display text-lg font-bold text-ink">{c.title}</h3>
              <p className="mt-1 text-sm text-neutral-600 group-hover:text-ink/70">{c.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* DESTAQUES */}
      <section className="border-y-4 border-ink bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
                Destaques da loja
              </h2>
              <p className="mt-1 text-neutral-600">Os modelos mais procurados, com estoque atualizado.</p>
            </div>
            <Link
              to="/catalogo"
              className="hidden shrink-0 items-center gap-1 font-semibold text-ink underline decoration-brand decoration-4 underline-offset-4 hover:decoration-ink md:inline-flex"
            >
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {featured.isLoading ? (
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-neutral-200" />
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {(featured.data ?? []).map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  installmentsMax={s.installmentsMax}
                  fees={s.fees}
                />
              ))}
            </div>
          )}

          <div className="mt-8 text-center md:hidden">
            <Link
              to="/catalogo"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-ink px-6 py-3 font-display font-bold text-brand"
            >
              Ver catálogo completo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SOBRE */}
      <section id="sobre" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">
              Por que comprar na Lojinha?
            </h2>
            <div className="mt-6 space-y-5">
              {[
                {
                  icon: Plane,
                  title: "Importados direto dos EUA",
                  desc: "Trabalhamos com iPhones trazidos diretamente dos Estados Unidos, sem intermediários — por isso o preço é melhor.",
                },
                {
                  icon: ShieldCheck,
                  title: "1 ano de garantia de verdade",
                  desc: "Todos os aparelhos, lacrados ou seminovos, saem com 1 ano de garantia pela loja. Comprou, ficou tranquilo.",
                },
                {
                  icon: BadgeCheck,
                  title: "Seminovos revisados",
                  desc: "Cada seminovo passa por teste completo de tela, bateria, câmeras e Face ID antes de ir pra vitrine.",
                },
                {
                  icon: Wrench,
                  title: "Manutenção especializada",
                  desc: "Troca de tela, bateria, conector de carga, vidro traseiro e diagnóstico gratuito em todas as marcas.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-brand">
                    <item.icon className="h-5 w-5 text-ink" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-ink">{item.title}</h3>
                    <p className="text-sm text-neutral-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border-4 border-ink bg-brand p-8 shadow-[8px_8px_0_0_#141414]">
            <p className="font-display text-3xl font-bold leading-tight text-ink">
              "Comprou na Lojinha, levou garantia."
            </p>
            <p className="mt-4 font-medium text-ink/70">
              Atendemos em Jardim-MS e Guia Lopes da Laguna com loja física,
              estoque à pronta entrega e suporte pelo WhatsApp.
            </p>
            <Link
              to="/catalogo"
              className="mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-ink px-6 py-3 font-display font-bold text-brand"
            >
              Conferir estoque <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SERVIÇOS */}
      <section id="servicos" className="border-y-4 border-ink bg-ink text-white">
        <div className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
          <h2 className="font-display text-2xl font-bold text-brand md:text-3xl">
            Assistência técnica
          </h2>
          <p className="mt-1 text-white/70">
            Manutenção em iPhone, Xiaomi, Realme, Tecno e outras marcas.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              "Troca de tela",
              "Troca de bateria",
              "Conector de carga",
              "Vidro traseiro",
              "Câmeras e lentes",
              "Placa e reparo avançado",
              "Películas e capinhas",
              "Diagnóstico gratuito",
            ].map((service) => (
              <div
                key={service}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-4 text-center text-sm font-semibold text-white transition hover:border-brand hover:text-brand"
              >
                {service}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* UNIDADES */}
      <section id="unidades" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14">
        <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">Nossas unidades</h2>
        <p className="mt-1 text-neutral-600">Duas lojas pra te atender de pertinho.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            { city: "Jardim-MS", address: s.addressJardim, maps: s.mapsJardim, whatsapp: s.whatsappJardim },
            { city: "Guia Lopes da Laguna-MS", address: s.addressGll, maps: s.mapsGll, whatsapp: s.whatsappGll },
          ].map((u) => (
            <div
              key={u.city}
              className="rounded-2xl border-2 border-ink bg-white p-6 shadow-[4px_4px_0_0_#141414]"
            >
              <h3 className="font-display text-lg font-bold text-ink">{u.city}</h3>
              <p className="mt-1 flex items-start gap-2 text-sm text-neutral-600">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {u.address}
              </p>
              <div className="mt-4 flex gap-3">
                <a
                  href={u.maps}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-xl border-2 border-ink bg-brand px-4 py-2.5 text-center text-sm font-bold text-ink transition hover:brightness-95"
                >
                  Ver no mapa
                </a>
                <a
                  href={`https://wa.me/${u.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-xl border-2 border-ink bg-[#25D366] px-4 py-2.5 text-center text-sm font-bold text-ink transition hover:brightness-105"
                >
                  WhatsApp
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
