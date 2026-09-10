import { useState, useMemo } from "react";
import { X, Plus, Minus, Trash2, ShoppingBag, ShieldCheck, Gift, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/cart";
import { useShopSettings, waLink, optimizeImageUrl } from "@/lib/shop";
import { formatBRL, installmentFromFees } from "@contracts/types";
import { WhatsAppIcon } from "./WhatsAppModal";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    totalPix,
    totalItems,
    buildWhatsAppMessage,
  } = useCart();

  const s = useShopSettings();
  const [selectedUnit, setSelectedUnit] = useState<"jardim" | "gll">("jardim");

  const targetWhatsApp =
    selectedUnit === "jardim"
      ? s.whatsappJardim || s.whatsappGll || "5567992086012"
      : s.whatsappGll || s.whatsappJardim || "5567998206533";

  const unitName =
    selectedUnit === "jardim"
      ? "Unidade Jardim - MS"
      : "Unidade Guia Lopes da Laguna";

  const installmentsMax = Math.min(s.installmentsMax || 12, 12);
  const fee12 = s.fees[String(installmentsMax)] ?? s.fees["12"] ?? 0;
  const installment12 =
    totalPix > 0 ? installmentFromFees(totalPix, installmentsMax, fee12) : 0;

  const orderMessage = useMemo(() => {
    return buildWhatsAppMessage({
      fees: s.fees,
      installmentsMax,
      unitName,
      storeName: "Lojinha do Celular",
    });
  }, [buildWhatsAppMessage, s.fees, installmentsMax, unitName]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={closeCart}
    >
      <div
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-300 sm:rounded-l-3xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho da Sacola */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 text-white">
              <ShoppingBag className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-neutral-900">
                Sua Sacola
              </h2>
              <p className="text-xs text-neutral-500 font-medium">
                {totalItems === 0
                  ? "Nenhum item"
                  : totalItems === 1
                  ? "1 item selecionado"
                  : `${totalItems} itens selecionados`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCart}
            className="rounded-full bg-neutral-100 p-2 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 transition cursor-pointer"
            aria-label="Fechar sacola"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Lista de Itens ou Estado Vazio */}
        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-neutral-100 text-neutral-400 mb-4">
              <ShoppingBag className="h-9 w-9 stroke-1" />
            </div>
            <h3 className="font-display text-lg font-bold text-neutral-900">
              Sua sacola está vazia
            </h3>
            <p className="mt-1 text-xs text-neutral-500 max-w-xs leading-relaxed">
              Explore nossos iPhones seminovos e lacrados com 1 ano de garantia e adicione seu próximo aparelho!
            </p>
            <a
              href="/#vitrine"
              onClick={closeCart}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-neutral-900 hover:bg-black px-6 py-3 text-xs font-bold text-white transition active:scale-95 shadow-sm"
            >
              <span>Ver aparelhos disponíveis</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {items.map((item) => {
                const itemTotal = item.price * item.quantity;
                return (
                  <div
                    key={item.id}
                    className="flex gap-3.5 rounded-2xl border border-neutral-100 bg-[#fbfbfd] p-3.5 transition hover:border-neutral-200"
                  >
                    {/* Imagem do Aparelho */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white border border-neutral-100 p-1 flex items-center justify-center">
                      {item.imageUrl ? (
                        <img
                          src={optimizeImageUrl(item.imageUrl, 160, 85)}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <ShoppingBag className="h-6 w-6 text-neutral-300" />
                      )}
                    </div>

                    {/* Detalhes do Produto */}
                    <div className="flex flex-1 flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-display text-sm font-bold text-neutral-900 line-clamp-1 leading-snug">
                            {item.name}
                          </h4>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="text-neutral-400 hover:text-red-600 transition p-0.5 cursor-pointer"
                            aria-label={`Remover ${item.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Badges de Variação (Cor, Storage, Condição) */}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500 font-medium">
                          {item.condition && (
                            <span className="rounded-full bg-neutral-200/70 px-2 py-0.5 text-[10px] font-semibold text-neutral-800">
                              {item.condition}
                            </span>
                          )}
                          {item.color && <span>{item.color}</span>}
                          {item.storage && item.storage !== "Padrão" && (
                            <>
                              <span>•</span>
                              <span>{item.storage}</span>
                            </>
                          )}
                          {item.sku && (
                            <span className="font-mono text-[10px] text-neutral-400">
                              (cód. {item.sku})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Preço e Controle de Quantidade */}
                      <div className="mt-2.5 flex items-center justify-between pt-1 border-t border-neutral-100">
                        <div>
                          <span className="text-[11px] text-neutral-400 font-medium mr-1">
                            Pix:
                          </span>
                          <span className="font-display text-sm font-extrabold text-neutral-950">
                            {formatBRL(itemTotal)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-2 py-0.5 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, -1)}
                            className="text-neutral-500 hover:text-black transition p-0.5 cursor-pointer"
                            aria-label="Diminuir quantidade"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-xs font-bold text-neutral-800 min-w-[14px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, 1)}
                            className="text-neutral-500 hover:text-black transition p-0.5 cursor-pointer"
                            aria-label="Aumentar quantidade"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Benefícios Inclusos */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 p-2.5 text-xs text-emerald-800 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Garantia de 1 ano com nota fiscal e procedência.</span>
                </div>
                <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 p-2.5 text-xs text-blue-800 font-medium">
                  <Gift className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>Fechando pelo site: capa e película inclusas de brinde!</span>
                </div>
              </div>
            </div>

            {/* Rodapé com Resumo Financeiro e Fechamento no WhatsApp */}
            <div className="border-t border-neutral-100 bg-white p-5 space-y-4 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
              {/* Seleção da Unidade para Retirada ou Entrega */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 mb-1.5">
                  Selecione a unidade para atendimento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedUnit("jardim")}
                    className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
                      selectedUnit === "jardim"
                        ? "border-[#25D366] bg-emerald-50/50 text-neutral-900 ring-1 ring-[#25D366]"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="block text-xs font-bold leading-tight">Jardim - MS</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">Av. Duque de Caxias</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedUnit("gll")}
                    className={`rounded-xl border px-3 py-2 text-left transition cursor-pointer ${
                      selectedUnit === "gll"
                        ? "border-[#25D366] bg-emerald-50/50 text-neutral-900 ring-1 ring-[#25D366]"
                        : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="block text-xs font-bold leading-tight">Guia Lopes</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">Rua Macias Barbosa</span>
                  </button>
                </div>
              </div>

              {/* Resumo de Valores no Pix e Cartão */}
              <div className="rounded-2xl bg-neutral-50 border border-neutral-100 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-neutral-700">Total no Pix</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      12% OFF
                    </span>
                  </div>
                  <span className="font-display text-lg font-black text-neutral-950">
                    {formatBRL(totalPix)}
                  </span>
                </div>

                {installment12 > 0 && (
                  <div className="flex items-center justify-between pt-1.5 border-t border-neutral-200/60 text-xs">
                    <span className="text-neutral-500">Ou no cartão de crédito</span>
                    <span className="font-semibold text-neutral-800">
                      até {installmentsMax}x de {formatBRL(installment12)}
                    </span>
                  </div>
                )}
              </div>

              {/* Botão de Fechar Pedido no WhatsApp */}
              <a
                href={waLink(targetWhatsApp, orderMessage)}
                target="_blank"
                rel="noreferrer"
                className="w-full rounded-full bg-[#25D366] hover:bg-[#20ba59] text-white py-3.5 px-6 font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-[#25D366]/25 transition active:scale-[0.98] cursor-pointer"
              >
                <WhatsAppIcon className="h-5 w-5 fill-white" />
                <span>Fechar Pedido no WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={closeCart}
                className="w-full text-center text-xs font-medium text-neutral-400 hover:text-neutral-700 transition cursor-pointer"
              >
                Continuar escolhendo produtos
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
