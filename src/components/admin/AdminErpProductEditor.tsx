import { useState } from "react";
import {
  X,
  Sparkles,
  Save,
  Video,
  Image as ImageIcon,
  Battery,
  ShieldCheck,
  Star,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { CATEGORIES, formatBRL } from "@contracts/types";
import { detectIphoneModel } from "@/lib/iphoneCatalog";
import type { ShopProduct } from "../../../api/erp/types";

interface AdminErpProductEditorProps {
  product: ShopProduct;
  onClose: () => void;
  onSaved: () => void;
}

function cleanCommercialName(rawName: string): string {
  let s = rawName
    .replace(/^Aparelho\s+/i, "")
    .replace(/^CEL\s+/i, "")
    .replace(/^APPLE\s+CEL\s+/i, "")
    .replace(/\s*-\s*Seminovo/i, "")
    .replace(/\s*-\s*Novo/i, "")
    .replace(/\s*-\s*Lacrado/i, "")
    .replace(/\s*\([A-D]\)/gi, "") // remove marcas de grade como (A), (B), (C)
    .trim();

  // Se começar com número tipo 14 PRO MAX ou 15, adiciona iPhone
  if (/^(11|12|13|14|15|16|17)\b/i.test(s)) {
    s = "iPhone " + s;
  } else if (/^IPHONE\s+/i.test(s)) {
    s = "iPhone " + s.replace(/^IPHONE\s+/i, "");
  }

  // Garante GB no armazenamento
  s = s.replace(/\b(\d{2,3})\b(?!\s*GB|\s*TB)/i, "$1GB");

  return s;
}

export function AdminErpProductEditor({
  product,
  onClose,
  onSaved,
}: AdminErpProductEditorProps) {
  const externalId = product.externalId || String(product.id);
  const mainVariant = product.variants?.[0];

  const [imageUrl, setImageUrl] = useState(product.imageUrl || "");
  const [videoUrl, setVideoUrl] = useState(product.videoUrl || mainVariant?.videoUrl || "");
  const [customName, setCustomName] = useState(product.name || "");
  const [category, setCategory] = useState(product.category || "iphone_seminovo");
  const [batteryHealth, setBatteryHealth] = useState(mainVariant?.batteryHealth || "");
  const [warranty, setWarranty] = useState(product.warranty || mainVariant?.warranty || "1 ano de garantia");
  const [description, setDescription] = useState(product.description || "");
  const [featured, setFeatured] = useState(Boolean(product.featured));
  const [active, setActive] = useState(product.active !== false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const utils = trpc.useUtils();
  const saveMutation = trpc.admin.saveErpOverride.useMutation({
    onSuccess: () => {
      setSaveSuccess(true);
      utils.admin.products.invalidate();
      utils.shop.products.invalidate();
      utils.shop.featured.invalidate();
      utils.shop.product.invalidate({ id: externalId });
      setTimeout(() => {
        setSaveSuccess(false);
        onSaved();
      }, 900);
    },
    onError: (err) => {
      setErrorMessage(err.message || "Erro ao salvar alterações.");
    },
  });

  // Detecta se é iPhone para sugerir cores e fotos oficiais
  const detectedModel = detectIphoneModel(product.name);

  // Calcula estoque total das variantes
  const totalStock = (product.variants || []).reduce(
    (acc, v) => acc + (typeof v.quantity === "number" ? v.quantity : 0),
    0,
  );
  const basePrice = mainVariant?.priceCash ? mainVariant.priceCash : 0;

  const handleSave = () => {
    setErrorMessage("");
    saveMutation.mutate({
      externalId,
      customName: customName.trim() || undefined,
      category: category as (typeof CATEGORIES)[number]["value"],
      imageUrl: imageUrl.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      batteryHealth: batteryHealth.trim() || undefined,
      warranty: warranty.trim() || undefined,
      description: description.trim() || undefined,
      featured,
      active,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-neutral-100 bg-[#fbfbfd] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                <Sparkles className="h-3 w-3" /> Gestão Celular ERP
              </span>
              <span className="text-xs text-neutral-500">ID: {externalId}</span>
              <a
                href="https://gestaocelular.com.br"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline ml-1"
              >
                Abrir no Gestão Celular ↗
              </a>
            </div>
            <h2 className="mt-1 text-lg font-bold text-neutral-900 line-clamp-1">
              Editar Vitrine: {product.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Resumo do ERP (Somente Leitura) */}
        <div className="grid grid-cols-3 gap-3 border-b border-neutral-100 bg-neutral-50/50 px-6 py-3 text-xs">
          <div>
            <span className="text-neutral-400 block">Estoque no ERP:</span>
            <span className="font-semibold text-emerald-700">{totalStock} unidade(s) física(s)</span>
          </div>
          <div>
            <span className="text-neutral-400 block">Preço de Venda:</span>
            <span className="font-semibold text-neutral-900">{formatBRL(basePrice)}</span>
          </div>
          <div>
            <span className="text-neutral-400 block">Condição Detectada:</span>
            <span className="font-semibold capitalize text-neutral-800">{product.condition}</span>
          </div>
        </div>

        {/* Formulário com Scroll */}
        <div className="max-h-[65vh] overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
          )}

          {saveSuccess && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Alterações salvas com sucesso! Atualizando vitrine...
            </div>
          )}

          {/* Seção 1: Foto do Produto */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5 text-neutral-500" /> Foto Principal na Vitrine
            </label>
            <div className="flex gap-4 items-start">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-[#fbfbfd] p-1 flex items-center justify-center shadow-xs">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-[10px] text-neutral-400 text-center font-medium">Sem foto</span>
                )}
              </div>
              <div className="flex-1 space-y-2">
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://exemplo.com/foto-do-iphone.jpg (ou selecione uma cor abaixo)"
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
                />
                
                {/* Sugestões de Fotos Oficiais do iPhone Detectado */}
                {detectedModel && detectedModel.colors.length > 0 && (
                  <div>
                    <span className="text-[11px] text-neutral-500 block mb-1.5 font-medium">
                      Sugestões oficiais para {detectedModel.name}:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detectedModel.colors.map((c) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            if (c.imageUrl) setImageUrl(c.imageUrl);
                          }}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                            imageUrl === c.imageUrl
                              ? "border-neutral-900 bg-neutral-900 text-white"
                              : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                          }`}
                        >
                          <span
                            className="h-2 w-2 rounded-full border border-black/20"
                            style={{ backgroundColor: c.hex }}
                          />
                          {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Seção 2: Vídeo Demonstrativo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2 flex items-center gap-1.5">
              <Video className="h-3.5 w-3.5 text-neutral-500" /> Vídeo do Aparelho (YouTube / MP4)
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/shorts/... ou link de vídeo"
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Vídeo demonstrativo para o cliente assistir no site e na TV antes de comprar.
            </p>
          </div>

          {/* Seção 3: Categoria e Nome Personalizado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2">
                Categoria no Site
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number]["value"])}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600">
                  Título Exibido na Vitrine
                </label>
                <button
                  type="button"
                  onClick={() => setCustomName(cleanCommercialName(product.name))}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
                  title="Formata o nome sem códigos internos ou termos de controle"
                >
                  <Sparkles className="h-3 w-3" /> Limpar Nome
                </button>
              </div>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={cleanCommercialName(product.name)}
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition font-medium"
              />
            </div>
          </div>

          {/* Seção 4: Saúde da Bateria & Garantia */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2 flex items-center gap-1.5">
                <Battery className="h-3.5 w-3.5 text-emerald-600" /> Saúde da Bateria
              </label>
              <input
                type="text"
                value={batteryHealth}
                onChange={(e) => setBatteryHealth(e.target.value)}
                placeholder="Ex: 89% ou 100%"
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
              />
              <div className="flex gap-1.5 mt-2">
                {["100%", "95%", "90%", "88%", "85%+"].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setBatteryHealth(pct)}
                    className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100"
                  >
                    {pct}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> Garantia
              </label>
              <input
                type="text"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                placeholder="Ex: 1 ano de garantia"
                className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
              />
              <div className="flex gap-1.5 mt-2">
                {["1 ano de garantia", "6 meses", "Garantia Apple"].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setWarranty(g)}
                    className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 hover:bg-neutral-100"
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Seção 5: Descrição & Observações */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-600 mb-2">
              Descrição Comercial / Acessórios Inclusos
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Aparelho impecável sem marcas. Acompanha caixa original, carregador e cabo novo homologado."
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 transition"
            />
          </div>

          {/* Seção 6: Destaques e Visibilidade */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-center gap-2">
                <Star className={`h-4 w-4 ${featured ? "text-amber-500 fill-amber-500" : "text-neutral-400"}`} />
                <div>
                  <span className="text-xs font-bold text-neutral-900 block">Destaque na Vitrine</span>
                  <span className="text-[11px] text-neutral-500">Exibir em posição de destaque na página inicial e na TV</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={featured}
                onChange={(e) => setFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-neutral-200/60">
              <div className="flex items-center gap-2">
                {active ? (
                  <Eye className="h-4 w-4 text-emerald-600" />
                ) : (
                  <EyeOff className="h-4 w-4 text-neutral-400" />
                )}
                <div>
                  <span className="text-xs font-bold text-neutral-900 block">Visível na Vitrine</span>
                  <span className="text-[11px] text-neutral-500">Desmarque para ocultar temporariamente o aparelho</span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
              />
            </label>
          </div>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between border-t border-neutral-100 bg-[#fbfbfd] px-6 py-4">
          <div className="text-[11px] text-neutral-400">
            * O estoque é gerido automaticamente pelo Gestão Celular ERP.
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-neutral-900 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-black transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
