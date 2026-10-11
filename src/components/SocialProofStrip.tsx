import { trpc } from "@/providers/trpc";
import { useShopSettings, waLink } from "@/lib/shop";

const AVATAR_COLORS = ["#f59e0b", "#6366f1", "#14b8a6", "#ef4444", "#3b82f6", "#84cc16", "#a855f7", "#06b6d4", "#ec4899", "#22c55e"];
const MIN_ITEMS = 3;

function colorFor(text: string): string {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

interface Buyer {
  firstName: string;
  lastInitial: string;
  model: string;
  brand: string;
}

function Pill({ buyer }: { buyer: Buyer }) {
  const initials = `${buyer.firstName[0]}${buyer.lastInitial || buyer.firstName[1] || ""}`.toUpperCase();
  const label = `${buyer.firstName}${buyer.lastInitial ? ` ${buyer.lastInitial}.` : ""}`;
  return (
    <li className="flex shrink-0 items-center gap-2.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 shadow-2xs">
      <span
        aria-hidden="true"
        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: colorFor(label) }}
      >
        {initials}
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-semibold text-[#1d1d1f]">{label}</span>
        <span className="block text-[11px] text-[#6e6e73]">{buyer.model}</span>
      </span>
    </li>
  );
}

/**
 * "Quem já comprou com a gente": primeiro nome, inicial e aparelho, vindos do ERP.
 * Só aparece ligada no painel e com pelo menos 3 nomes. Para quem reduz movimento, fica parada e rolável.
 */
export default function SocialProofStrip() {
  const query = trpc.shop.socialProof.useQuery(undefined, { staleTime: 5 * 60 * 1000, retry: 0 });
  const shop = useShopSettings();
  const contact = shop.whatsappJardim || shop.whatsappGll;
  const data = query.data;
  if (!data || data.items.length < MIN_ITEMS) return null;

  const duration = Math.max(30, data.items.length * 4);

  return (
    <section aria-label={data.title} className="border-y border-neutral-100 bg-[#fbfbfd] py-5">
      <p className="mb-3 px-4 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#86868b]">{data.title}</p>
      <div className="social-proof-viewport overflow-hidden">
        <div className="animate-marquee gap-3 px-3" style={{ animationDuration: `${duration}s` }}>
          <ul className="flex shrink-0 gap-3">
            {data.items.map((buyer, i) => (
              <Pill key={`a-${i}`} buyer={buyer} />
            ))}
          </ul>
          {/* Cópia só para o loop visual: some para leitores de tela. */}
          <ul className="flex shrink-0 gap-3" aria-hidden="true">
            {data.items.map((buyer, i) => (
              <Pill key={`b-${i}`} buyer={buyer} />
            ))}
          </ul>
        </div>
      </div>
      {contact && (
        <p className="mt-3 px-4 text-center text-[11px] text-[#86868b]">
          Comprou com a gente e prefere não aparecer?{" "}
          <a
            href={waLink(contact, "Olá! Comprei na Lojinha do Celular e gostaria de não aparecer na faixa “Quem já comprou” do site.")}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#1d1d1f] underline underline-offset-2 hover:text-black"
          >
            Peça a remoção
          </a>
        </p>
      )}
    </section>
  );
}
