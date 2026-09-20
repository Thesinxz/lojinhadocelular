import { Link } from "react-router";
import { HelpCircle, ChevronLeft, MessageCircle } from "lucide-react";
import SEO from "@/components/SEO";
import { useShopSettings, waLink } from "@/lib/shop";

export default function NotFound() {
  const s = useShopSettings();
  const whatsapp = s.whatsappJardim || s.whatsappGll || "5567992086012";

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-20 text-center">
      <SEO
        title="Página não encontrada (404)"
        description="O endereço que você tentou acessar não existe ou foi movido."
        noindex={true}
      />

      <div className="mx-auto max-w-md">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-neutral-100 text-neutral-400">
          <HelpCircle className="h-10 w-10 text-neutral-600" />
        </div>

        <span className="mt-6 inline-block rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-600">
          Erro 404
        </span>

        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
          Página não encontrada
        </h1>

        <p className="mt-3 text-sm text-neutral-500">
          O link que você acessou pode ter sido digitado incorretamente, o produto pode ter esgotado ou a página foi movida.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/#vitrine"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-xs font-semibold text-white shadow-sm transition hover:bg-black sm:w-auto"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Voltar para a Loja</span>
          </Link>

          <a
            href={waLink(
              whatsapp,
              "Olá! Tentei acessar uma página no site da Lojinha do Celular e deu página não encontrada. Podem me ajudar?",
            )}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-6 py-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 sm:w-auto"
          >
            <MessageCircle className="h-4 w-4 text-[#25D366]" />
            <span>Falar no WhatsApp</span>
          </a>
        </div>
      </div>
    </div>
  );
}
