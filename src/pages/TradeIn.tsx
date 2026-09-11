import { useState, useMemo, useRef, type ChangeEvent, type ReactNode } from "react";
import { Link } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
  X,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import SEO from "@/components/SEO";
import { useShopSettings, waLink } from "@/lib/shop";
import { trpc } from "@/providers/trpc";
import { safeStorage } from "@/lib/storage";
import {
  detectIphoneModel,
  getIphoneModelColorImage,
  POPULAR_IPHONE_MODELS,
  FALLBACK_STORAGE_OPTIONS,
  FALLBACK_COLOR_OPTIONS,
} from "@/lib/iphoneCatalog";
import {
  evaluateDevice,
  formatBRL,
  getGradeBadgeConfig,
} from "@/lib/valuationEngine";

// Modelos alvo para troca
const TARGET_IPHONE_MODELS = [
  "iPhone 17 Pro Max",
  "iPhone 17 Pro",
  "iPhone 17",
  "iPhone Air",
  "iPhone 17e",
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16 Plus",
  "iPhone 16",
  "iPhone 16e",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15 Plus",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14 Pro",
  "iPhone 14 Plus",
  "iPhone 14",
  "iPhone 13 Pro Max",
  "iPhone 13 Pro",
  "iPhone 13",
  "iPhone 12 Pro Max",
  "iPhone 12",
  "iPhone 11",
];

const PURCHASE_ORIGIN_OPTIONS = [
  { id: "Lojinha do Celular", label: "Lojinha do Celular", desc: "Comprado com a nossa equipe" },
  { id: "Outra loja física da cidade", label: "Outra loja física da cidade", desc: "" },
  {
    id: "Loja de departamento / Marketplace",
    label: "Loja de departamento / Marketplace",
    desc: "Ex.: Mercado Livre, Amazon, Shopee, Magazine Luiza, etc.",
  },
  { id: "Outro", label: "Outro", desc: "" },
];

const SIMPLE_TRI_OPTIONS = ["Sim", "Não", "Não sei"];

const VISUAL_CONDITION_OPTIONS = [
  "Parece novo, sem marcas",
  "Pouquíssimas marcas de uso",
  "Marcas normais do dia a dia",
  "Riscos ou amassados visíveis",
  "Tela ou tampa com trinco",
];

type PhotoSlotKey = "front" | "back" | "sides" | "battery" | "screen";

interface PhotoSlot {
  key: PhotoSlotKey;
  label: string;
  required: boolean;
  file?: File;
  previewUrl?: string;
}

const INITIAL_PHOTO_SLOTS: PhotoSlot[] = [
  { key: "front", label: "Foto da frente", required: true },
  { key: "back", label: "Foto da traseira", required: true },
  { key: "sides", label: "Foto das laterais (opcional)", required: false },
  { key: "battery", label: "Foto da saúde da bateria (opcional)", required: false },
  { key: "screen", label: "Foto da tela ligada (opcional)", required: false },
];

type EvaluationData = {
  name: string;
  whatsapp: string;
  model: string;
  storage: string;
  color: string;
  purchaseLocation: string;
  batteryPercent: number;
  batteryUnknown: boolean;
  targetModel: string;
  faceId: string;
  screenOriginal: string;
  batteryOriginal: string;
  camerasOk: string;
  audioOk: string;
  chargingPortOk: string;
  openedBefore: string;
  hasBox: string;
  visualCondition: string;
  notes: string;
};

const INITIAL_EVALUATION: EvaluationData = {
  name: "",
  whatsapp: "",
  model: "",
  storage: "",
  color: "",
  purchaseLocation: "",
  batteryPercent: 90,
  batteryUnknown: false,
  targetModel: "",
  faceId: "",
  screenOriginal: "",
  batteryOriginal: "",
  camerasOk: "",
  audioOk: "",
  chargingPortOk: "",
  openedBefore: "",
  hasBox: "",
  visualCondition: "",
  notes: "",
};

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export default function TradeIn() {
  const settings = useShopSettings();
  const destination = settings.whatsappJardim || settings.whatsappGll || "5567992086012";
  const submitMutation = trpc.shop.submitEvaluation.useMutation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<EvaluationData>(INITIAL_EVALUATION);
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>(INITIAL_PHOTO_SLOTS);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [lgpdConsent, setLgpdConsent] = useState(true);
  const [animatingSelection, setAnimatingSelection] = useState<string | null>(null);

  const fileInputRefs = useRef<{ [key in PhotoSlotKey]?: HTMLInputElement | null }>({});

  const isTrocaFacilDomain =
    typeof window !== "undefined" && window.location.hostname.includes("trocafacil");

  const detectedModel = useMemo(() => detectIphoneModel(data.model), [data.model]);

  const previewImage = useMemo(
    () => getIphoneModelColorImage(detectedModel, data.color),
    [detectedModel, data.color]
  );

  const storageOptions = useMemo(() => {
    if (detectedModel && detectedModel.capacities.length > 0) {
      const formatted = detectedModel.capacities.map(c =>
        c.replace(/([0-9]+)\s*(gb|tb)/i, "$1 $2").toUpperCase()
      );
      return [...formatted, "Não sei"];
    }
    return FALLBACK_STORAGE_OPTIONS;
  }, [detectedModel]);

  const colorOptions = useMemo(() => {
    if (detectedModel && detectedModel.colors.length > 0) {
      return detectedModel.colors;
    }
    return FALLBACK_COLOR_OPTIONS;
  }, [detectedModel]);

  const valuation = useMemo(
    () =>
      evaluateDevice({
        model: data.model,
        storage: data.storage,
        color: data.color,
        purchaseLocation: data.purchaseLocation,
        batteryPercent: data.batteryPercent,
        batteryUnknown: data.batteryUnknown,
        targetModel: data.targetModel,
        visualCondition: data.visualCondition,
        faceId: data.faceId,
        screenOriginal: data.screenOriginal,
        batteryOriginal: data.batteryOriginal,
        camerasOk: data.camerasOk,
        audioOk: data.audioOk,
        chargingPortOk: data.chargingPortOk,
        openedBefore: data.openedBefore,
        hasBox: data.hasBox,
        notes: data.notes,
      }),
    [data]
  );

  const gradeConfig = useMemo(() => getGradeBadgeConfig(valuation.grade), [valuation.grade]);

  function updateField<K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) {
    const finalValue =
      field === "whatsapp" && typeof value === "string"
        ? (formatPhoneInput(value) as EvaluationData[K])
        : value;
    setData(curr => ({ ...curr, [field]: finalValue }));
    setError("");
  }

  function selectPopularModel(popName: string) {
    updateField("model", popName);
    const found = detectIphoneModel(popName);
    if (found && found.colors.length > 0) {
      const hasCurrent = found.colors.some(
        c => c.name.toLowerCase() === data.color.toLowerCase()
      );
      if (!hasCurrent) {
        updateField("color", found.colors[0].name);
      }
    }
  }

  // Avanço automático com micro feedback tátil
  function autoAdvance<K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) {
    updateField(field, value);
    setAnimatingSelection(String(value));
    setTimeout(() => {
      setAnimatingSelection(null);
      setStep(curr => curr + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 180);
  }

  function handlePhotoUpload(key: PhotoSlotKey, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setPhotoSlots(prev =>
      prev.map(slot => (slot.key === key ? { ...slot, file, previewUrl } : slot))
    );
  }

  function removePhoto(key: PhotoSlotKey) {
    setPhotoSlots(prev =>
      prev.map(slot => {
        if (slot.key === key) {
          if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
          return { ...slot, file: undefined, previewUrl: undefined };
        }
        return slot;
      })
    );
  }

  const filledPhotosCount = useMemo(
    () => photoSlots.filter(s => Boolean(s.file || s.previewUrl)).length,
    [photoSlots]
  );

  // Validação por etapa
  function validateCurrentStep(): boolean {
    setError("");
    if (step === 0) {
      if (!data.name.trim()) {
        setError("Digite seu primeiro nome para continuar.");
        return false;
      }
      if (data.whatsapp.replace(/\D/g, "").length < 10) {
        setError("Digite um WhatsApp válido com DDD.");
        return false;
      }
      if (!lgpdConsent) {
        setError("É necessário concordar com os Termos de Privacidade e LGPD para continuar.");
        return false;
      }
    } else if (step === 1) {
      if (!data.model.trim()) {
        setError("Selecione ou digite o modelo do seu iPhone.");
        return false;
      }
    } else if (step === 2) {
      if (!data.purchaseLocation) {
        setError("Selecione onde comprou o aparelho.");
        return false;
      }
    } else if (step === 4) {
      if (!data.targetModel) {
        setError("Selecione o modelo que deseja ou escolha apenas vender.");
        return false;
      }
    } else if (step === 14) {
      // Fotos: recomenda frente e traseira, mas permite avançar
    }
    return true;
  }

  function goNext() {
    if (validateCurrentStep()) {
      setStep(curr => curr + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goBack() {
    setError("");
    setStep(curr => Math.max(0, curr - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitEvaluation() {
    const batteryText = data.batteryUnknown ? "Não sei informar" : `${data.batteryPercent}%`;

    const summaryText = [
      "*Solicitação de Avaliação — Lojinha do Celular*",
      "",
      `👤 *Cliente:* ${data.name.trim()}`,
      `📱 *WhatsApp:* ${data.whatsapp.trim()}`,
      `📦 *Aparelho:* ${data.model.trim()} ${data.storage ? `(${data.storage})` : ""}`,
      `🎨 *Cor:* ${data.color || "Não informada"}`,
      `🏬 *Onde comprou:* ${data.purchaseLocation || "Não informado"}`,
      `🔋 *Saúde da bateria:* ${batteryText}`,
      `🎯 *Interesse de troca:* ${data.targetModel || "Apenas vender"}`,
      "",
      `✨ *Classificação Preliminar:* ${gradeConfig.label} (${valuation.grade})`,
      `💰 *Estimativa de Avaliação:* ${formatBRL(valuation.minEstimatedValue)} a ${formatBRL(valuation.maxEstimatedValue)}`,
      valuation.targetModelName && valuation.minTradeDelta !== undefined
        ? `🎯 *Volta Estimada (${valuation.targetModelName}):* ${formatBRL(valuation.minTradeDelta)} a ${formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}`
        : "",
      valuation.loyaltyBonusApplied ? "🎁 *Bônus Fidelidade Lojinha do Celular (+5% na avaliação)*" : "",
      "",
      "🔍 *Diagnóstico Rápido:*",
      `• Face ID: ${data.faceId || "Não informado"}`,
      `• Tela original: ${data.screenOriginal || "Não informado"}`,
      `• Bateria original: ${data.batteryOriginal || "Não informado"}`,
      `• Câmeras: ${data.camerasOk || "Não informado"}`,
      `• Áudio: ${data.audioOk || "Não informado"}`,
      `• Conector de carga: ${data.chargingPortOk || "Não informado"}`,
      `• Já aberto: ${data.openedBefore || "Não informado"}`,
      `• Possui caixa: ${data.hasBox || "Não informado"}`,
      `• Conservação visual: ${data.visualCondition || "Não informado"}`,
      "",
      `📸 *Fotos anexadas:* ${filledPhotosCount} de 5 selecionadas`,
      data.notes ? `📝 *Obs:* ${data.notes}` : "",
      "",
      "Enviado pelo site https://lojinhadocelular.com",
    ]
      .filter(Boolean)
      .join("\n");

    // 1. Salva no banco de dados via tRPC
    submitMutation.mutate({
      name: data.name.trim(),
      whatsapp: data.whatsapp.trim(),
      model: data.model.trim(),
      storage: data.storage.trim(),
      color: data.color.trim(),
      purchaseLocation: data.purchaseLocation,
      targetModel: data.targetModel,
      faceId: data.faceId,
      screenOriginal: data.screenOriginal,
      batteryOriginal: data.batteryOriginal,
      camerasOk: data.camerasOk,
      audioOk: data.audioOk,
      chargingPortOk: data.chargingPortOk,
      openedBefore: data.openedBefore,
      hasBox: data.hasBox,
      visualCondition: data.visualCondition,
      condition: data.visualCondition || "Em análise",
      battery: batteryText,
      notes: data.notes.trim() || undefined,
      photosCount: filledPhotosCount,
    });

    // 2. Histórico local de segurança
    try {
      const history = JSON.parse(safeStorage.getItem("lojinha_evaluations_history") || "[]");
      safeStorage.setItem(
        "lojinha_evaluations_history",
        JSON.stringify([
          { ...data, battery: batteryText, photosCount: filledPhotosCount, date: new Date().toISOString() },
          ...history.slice(0, 19),
        ])
      );
    } catch {}

    // 3. Abre conversa com o atendente
    window.open(waLink(destination, summaryText), "_blank", "noopener,noreferrer");
    setSent(true);
  }

  // TELA DE SUCESSO APÓS ENVIO
  if (sent) {
    return (
      <main className="min-h-[100dvh] bg-[#fbfbfd] px-4 py-8 text-[#1d1d1f] sm:py-16">
        <SEO
          title="Resultado da Avaliação | Troca Fácil Lojinha do Celular"
          description="Confira a pré-avaliação do seu iPhone na Lojinha do Celular e combine os detalhes no WhatsApp."
        />
        <div className="mx-auto flex min-h-[75dvh] w-full max-w-[540px] flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 animate-scaleIn">
            <Check className="h-8 w-8 stroke-[2.5]" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.25em] text-[#86868b]">
            TROCA FÁCIL LOJINHA DO CELULAR
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#1d1d1f]">
            Pré-Avaliação Concluída!
          </h1>
          <p className="mt-2 max-w-sm text-xs sm:text-sm text-[#6e6e73]">
            Sua proposta foi registrada no sistema e a conversa no WhatsApp foi iniciada.
          </p>

          {/* CARD DE RESULTADO DA PRÉ-AVALIAÇÃO */}
          <div className="mt-6 w-full rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 text-left shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)]">
            <div className="flex items-start gap-4">
              <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-[#fbfbfd] p-2 border border-[#e5e5e7]">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={data.model}
                    className="h-full w-full object-contain drop-shadow-xs"
                  />
                ) : (
                  <Smartphone className="h-9 w-9 text-[#86868b]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#1d1d1f]">
                    {data.model}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${gradeConfig.badgeBg} ${gradeConfig.badgeText} ${gradeConfig.badgeBorder}`}
                  >
                    <span>{gradeConfig.iconText}</span>
                    <span>{gradeConfig.label}</span>
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6e6e73]">
                  {data.storage || "Capacidade padrão"} • Cor: {data.color || "Padrão"}
                </p>
                {data.purchaseLocation && (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    Comprado em: {data.purchaseLocation}
                  </p>
                )}
              </div>
            </div>

            {/* FAIXA DE VALOR EM DESTAQUE */}
            <div className="mt-5 rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                💰 Faixa Estimada de Pré-Avaliação
              </span>
              <div className="mt-1 font-display text-2xl sm:text-3xl font-bold text-emerald-950">
                {formatBRL(valuation.minEstimatedValue)} a {formatBRL(valuation.maxEstimatedValue)}
              </div>
              <p className="mt-1 text-[11px] text-emerald-900/80">
                {valuation.disclaimer}
              </p>
            </div>

            {/* SE HOUVER APARELHO DESEJADO PARA TROCA */}
            {valuation.targetModelName && valuation.minTradeDelta !== undefined && (
              <div className="mt-3 rounded-2xl border border-purple-200/80 bg-purple-50/70 p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">
                  🎯 Troca pelo {valuation.targetModelName}
                </span>
                <div className="mt-1 font-display text-xl sm:text-2xl font-bold text-purple-950">
                  Volta estimada de {formatBRL(valuation.minTradeDelta)} a {formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}
                </div>
                <p className="mt-1 text-[11px] text-purple-900/80">
                  Entregando seu {data.model}, essa é a estimativa da diferença a pagar.
                </p>
              </div>
            )}

            {/* PONTOS FORTES E BÔNUS */}
            {valuation.highlights.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3 text-[11px]">
                {valuation.highlights.map((hl, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-lg bg-[#f5f5f7] px-2.5 py-1 font-medium text-[#1d1d1f]"
                  >
                    {hl}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="mt-6 flex flex-col gap-3 w-full sm:flex-row">
            <a
              href={waLink(
                destination,
                `Olá! Acabei de fazer a pré-avaliação do meu ${data.model} no site Troca Fácil da Lojinha do Celular (Estimativa: ${formatBRL(
                  valuation.minEstimatedValue
                )} a ${formatBRL(valuation.maxEstimatedValue)}). Gostaria de confirmar a proposta!`
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] hover:bg-[#20ba59] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
            >
              <Phone className="h-4 w-4" /> Abrir WhatsApp novamente
            </a>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setStep(0);
                setData(INITIAL_EVALUATION);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-neutral-300 bg-white px-5 py-3.5 text-sm font-semibold text-[#1d1d1f] transition hover:bg-neutral-50 shadow-xs"
            >
              <RotateCcw className="h-4 w-4" /> Nova avaliação
            </button>
          </div>

          <p className="mt-4 text-[11px] text-[#86868b]">
            Unidade Jardim/MS: Av. Duque de Caxias, 486 • Unidade Guia Lopes/MS: Rua Macias Barbosa, 2185
          </p>
        </div>
      </main>
    );
  }

  // Progresso relativo (etapas 0 a 15)
  const totalSteps = 16;
  const progressPercent = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#fbfbfd] text-[#1d1d1f]">
      <SEO
        title="Troca Fácil | Avaliação de iPhone com Segurança — Lojinha do Celular"
        description="Receba uma pré-avaliação rápida e transparente para vender ou trocar seu iPhone na Lojinha do Celular."
      />

      {/* Barra de Progresso Fina no Topo */}
      <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-neutral-200/60">
        <div
          className="h-full bg-[#0071e3] transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[500px] flex-col justify-between px-4 py-6 sm:py-10">
        {/* Header Compacto */}
        <header className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <img
              src="/images/logo-icon.png"
              alt="Lojinha do Celular"
              className="h-7 w-auto object-contain"
            />
            <span className="font-display text-xs font-bold tracking-[0.2em] text-[#1d1d1f] uppercase">
              TROCA FÁCIL
            </span>
          </div>
          <a
            href={isTrocaFacilDomain ? "https://lojinhadocelular.com" : "/"}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#86868b] transition hover:text-[#1d1d1f]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para loja
          </a>
        </header>

        {/* CORPO DO CARD PRINCIPAL */}
        <div className="my-auto py-2">
          {/* ========================================================================= */}
          {/* ETAPA 0: VAMOS COMEÇAR (NOME E WHATSAPP)                                */}
          {/* ========================================================================= */}
          {step === 0 && (
            <div className="space-y-5 animate-fadeIn">
              <div className="text-center">
                <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight tracking-tight text-[#1d1d1f]">
                  Venda ou troque seu iPhone <span className="text-[#0071e3]">com segurança</span>
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-[#6e6e73]">
                  Receba uma pré-avaliação rápida da equipe Lojinha do Celular e descubra quanto o seu aparelho
                  pode valer hoje.
                </p>
              </div>

              {/* Box de segurança */}
              <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-xs leading-5 text-neutral-700">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#0071e3]" />
                <span>
                  Esta é uma <b className="text-[#1d1d1f]">pré-avaliação online</b>. O valor final será
                  confirmado após a conferência presencial do aparelho na loja.
                </span>
              </div>

              {/* Card de formulário */}
              <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)]">
                <h2 className="font-display text-lg font-bold text-[#1d1d1f]">Vamos começar</h2>
                <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
                  Primeiro, conta pra gente quem é você — é por aqui que enviamos sua pré-proposta.
                </p>

                <div className="mt-5 space-y-4">
                  <Field label="Primeiro nome" icon={<UserRound className="h-4 w-4" />}>
                    <input
                      value={data.name}
                      onChange={e => updateField("name", e.target.value)}
                      placeholder="Seu nome"
                      autoComplete="name"
                      className="w-full bg-transparent text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none"
                    />
                  </Field>

                  <Field label="WhatsApp para receber a proposta" icon={<Phone className="h-4 w-4" />}>
                    <input
                      value={data.whatsapp}
                      onChange={e => updateField("whatsapp", e.target.value)}
                      placeholder="(67) 99999-9999"
                      inputMode="tel"
                      autoComplete="tel"
                      className="w-full bg-transparent text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none"
                    />
                  </Field>
                </div>

                {/* Termos de Privacidade e LGPD */}
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-3.5 text-xs text-neutral-700">
                  <label className="flex items-start gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={lgpdConsent}
                      onChange={e => setLgpdConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-[#0071e3] focus:ring-[#0071e3] accent-[#0071e3] cursor-pointer"
                    />
                    <span className="leading-snug text-neutral-700">
                      Declaro que li e concordo com os{" "}
                      <a
                        href="/privacidade"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[#0071e3] hover:underline"
                      >
                        Termos de Privacidade & LGPD
                      </a>{" "}
                      para envio da pré-avaliação do meu aparelho.
                    </span>
                  </label>
                  <p className="mt-2 text-[11px] leading-relaxed text-neutral-500 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    Seus dados são confidenciais e protegidos pela LGPD (Lei 13.709/2018).
                  </p>
                </div>

                {error && (
                  <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={goNext}
                  className="mt-5 flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1d1f] hover:bg-black font-semibold text-white transition-all shadow-md shadow-black/10 active:scale-[0.99]"
                >
                  Receber minha pré-avaliação <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 1: MODELO ATUAL (NOSSO SELETOR SUPERIOR MANTIDO & ENRIQUECIDO)      */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                Prazer, {data.name.trim() || "amigo"}! Qual é o seu iPhone?
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
                Toque no modelo ou digite o nome do aparelho que você tem hoje.
              </p>

              <div className="mt-5 space-y-4">
                {/* Campo de busca do modelo */}
                <Field label="Modelo do aparelho" icon={<Smartphone className="h-4 w-4" />}>
                  <input
                    value={data.model}
                    onChange={e => updateField("model", e.target.value)}
                    placeholder="Ex.: iPhone 15 Pro, iPhone 13..."
                    autoComplete="off"
                    className="w-full bg-transparent text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none"
                  />
                </Field>

                {/* Chips de modelos populares */}
                <div>
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                    Modelos mais comuns
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {POPULAR_IPHONE_MODELS.map(popName => {
                      const isSelected =
                        detectedModel?.name.toLowerCase() === popName.toLowerCase() ||
                        data.model.toLowerCase().trim() === popName.toLowerCase();
                      return (
                        <button
                          key={popName}
                          type="button"
                          onClick={() => selectPopularModel(popName)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                            isSelected
                              ? "bg-[#1d1d1f] text-white shadow-xs scale-102"
                              : "border border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:border-neutral-400 hover:bg-white"
                          }`}
                        >
                          {popName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Card de visualização do aparelho em tempo real */}
                {detectedModel && (
                  <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/70 via-white to-neutral-50 p-4 shadow-xs animate-fadeIn">
                    <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
                      {previewImage ? (
                        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-white p-2 shadow-xs border border-neutral-100">
                          <img
                            key={previewImage}
                            src={previewImage}
                            alt={detectedModel.name}
                            className="h-full w-full object-contain drop-shadow-sm"
                            onError={e => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-white p-3 shadow-xs border border-neutral-100">
                          <Smartphone className="h-10 w-10 text-[#0071e3]" />
                        </div>
                      )}
                      <div className="flex-1 text-center sm:text-left min-w-0">
                        <div className="inline-flex items-center gap-1 rounded-full bg-blue-100/80 px-2 py-0.5 text-[10.5px] font-semibold text-[#0071e3]">
                          <Sparkles className="h-3 w-3" /> Modelo reconhecido
                        </div>
                        <h3 className="font-display text-base font-bold text-[#1d1d1f] mt-0.5">
                          {detectedModel.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1 text-[11px] text-[#6e6e73]">
                          <span className="rounded bg-white border border-neutral-200 px-1.5 py-0.5 font-medium">
                            Ano {detectedModel.year}
                          </span>
                          <span className="rounded bg-white border border-neutral-200 px-1.5 py-0.5 font-medium">
                            Tela {detectedModel.screen}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Armazenamento */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#6e6e73]">Capacidade</span>
                    {data.storage && (
                      <span className="text-xs font-bold text-[#0071e3]">{data.storage}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {storageOptions.map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => updateField("storage", option)}
                        className={`h-11 rounded-xl border text-xs font-semibold transition-all ${
                          data.storage === option
                            ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]"
                            : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-white"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cores Oficiais */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#6e6e73]">Cor do aparelho</span>
                    {data.color && (
                      <span className="text-xs font-bold text-[#0071e3]">{data.color}</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {colorOptions.map(c => {
                      const isSelected = data.color === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => updateField("color", c.name)}
                          className={`flex h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-semibold transition-all ${
                            isSelected
                              ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3] ring-1 ring-[#0071e3]"
                              : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-white"
                          }`}
                        >
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/15"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="truncate flex-1">{c.name}</span>
                          {isSelected && <Check className="h-3 w-3 text-[#0071e3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {error && (
                <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-12 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black font-semibold text-white transition-all shadow-sm"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: ONDE VOCÊ COMPROU ESSE IPHONE?                                 */}
          {/* ========================================================================= */}
          {step === 2 && (
            <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                Onde você comprou esse {data.model || "iPhone"}?
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
                Se foi com a gente, sua troca já começa com uma condição melhor.
              </p>

              <div className="mt-5 space-y-2.5">
                {PURCHASE_ORIGIN_OPTIONS.map(opt => {
                  const isSelected = data.purchaseLocation === opt.id;
                  const isAnimating = animatingSelection === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => autoAdvance("purchaseLocation", opt.id)}
                      className={`flex w-full flex-col justify-center rounded-2xl border p-4 text-left transition-all ${
                        isSelected || isAnimating
                          ? "border-[#1d1d1f] bg-[#1d1d1f] text-white scale-[0.99] shadow-sm"
                          : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:border-neutral-300 hover:bg-[#fbfbfd]"
                      }`}
                    >
                      <span className="text-sm font-semibold">{opt.label}</span>
                      {opt.desc && (
                        <span
                          className={`mt-1 text-xs ${
                            isSelected || isAnimating ? "text-neutral-300" : "text-[#86868b]"
                          }`}
                        >
                          {opt.desc}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <span className="text-xs text-[#86868b]">Toque numa opção pra continuar →</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: COMO ESTÁ A SAÚDE DA BATERIA? (SLIDER VISUAL)                  */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                Como está a saúde da bateria?
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
                Veja em Ajustes › Bateria › Saúde da bateria.
              </p>

              <div className="mt-8 space-y-6">
                {!data.batteryUnknown ? (
                  <div className="rounded-2xl border border-neutral-100 bg-[#fbfbfd] p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="font-display text-5xl font-extrabold tracking-tight text-[#1d1d1f]">
                        {data.batteryPercent}%
                      </span>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          data.batteryPercent >= 90
                            ? "bg-emerald-100 text-emerald-700"
                            : data.batteryPercent >= 80
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {data.batteryPercent >= 90
                          ? "Bateria ótima"
                          : data.batteryPercent >= 80
                          ? "Bateria boa"
                          : "Manutenção recomendada"}
                      </span>
                    </div>

                    <div className="mt-6">
                      <input
                        type="range"
                        min={50}
                        max={100}
                        step={1}
                        value={data.batteryPercent}
                        onChange={e => updateField("batteryPercent", Number(e.target.value))}
                        className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-neutral-200 accent-[#1d1d1f]"
                      />
                      <div className="mt-2 flex justify-between text-[11px] font-semibold text-[#86868b]">
                        <span>50%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-center">
                    <p className="text-xs font-semibold text-[#0071e3]">
                      Opção "Não sei informar" selecionada. Nossa equipe fará a checagem no atendimento.
                    </p>
                  </div>
                )}

                {/* Alternar Não sei */}
                <button
                  type="button"
                  onClick={() => updateField("batteryUnknown", !data.batteryUnknown)}
                  className={`w-full rounded-xl border py-2.5 text-xs font-semibold transition ${
                    data.batteryUnknown
                      ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                  }`}
                >
                  {data.batteryUnknown ? "Quero informar a porcentagem" : "Não sei informar a porcentagem"}
                </button>
              </div>

              <div className="mt-8 flex items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black font-semibold text-white transition shadow-sm"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: E PRA QUAL IPHONE VOCÊ QUER TROCAR?                            */}
          {/* ========================================================================= */}
          {step === 4 && (
            <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                E pra qual iPhone você quer trocar?
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
                Pode ser um modelo mais novo ou mais antigo — aceitamos os dois.
              </p>

              {/* Botão de apenas venda em destaque */}
              <button
                type="button"
                onClick={() => autoAdvance("targetModel", "Quero apenas vender (sem troca)")}
                className={`mt-4 flex w-full items-center justify-between rounded-2xl border p-3.5 text-left text-xs font-bold transition-all ${
                  data.targetModel === "Quero apenas vender (sem troca)"
                    ? "border-[#0071e3] bg-[#0071e3]/10 text-[#0071e3]"
                    : "border-blue-100 bg-blue-50/50 text-[#0071e3] hover:bg-blue-50"
                }`}
              >
                <span>💰 Quero apenas vender meu aparelho (sem troca)</span>
                <Check className="h-4 w-4" />
              </button>

              <div className="mt-4 grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {TARGET_IPHONE_MODELS.map(targetName => {
                  const isSelected = data.targetModel === targetName;
                  const isAnimating = animatingSelection === targetName;
                  return (
                    <button
                      key={targetName}
                      type="button"
                      onClick={() => autoAdvance("targetModel", targetName)}
                      className={`flex h-12 items-center justify-center rounded-xl border px-3 text-center text-xs font-semibold transition-all ${
                        isSelected || isAnimating
                          ? "border-[#1d1d1f] bg-[#1d1d1f] text-white scale-[0.98] shadow-xs"
                          : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:border-neutral-300 hover:bg-white"
                      }`}
                    >
                      <span className="truncate">{targetName}</span>
                    </button>
                  );
                })}
              </div>

              {error && (
                <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">
                  {error}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <span className="text-xs text-[#86868b]">Toque numa opção pra continuar →</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPAS 5 A 12: DIAGNÓSTICO SIM / NÃO / NÃO SEI                           */}
          {/* ========================================================================= */}
          {step === 5 && (
            <TriChoiceStep
              title="Face ID funciona?"
              subtitle="Só marcar — Sim, Não ou Não sei."
              value={data.faceId}
              animating={animatingSelection}
              onSelect={val => autoAdvance("faceId", val)}
              onBack={goBack}
            />
          )}

          {step === 6 && (
            <TriChoiceStep
              title="Tela original?"
              subtitle="Só marcar — Sim, Não ou Não sei."
              value={data.screenOriginal}
              animating={animatingSelection}
              onSelect={val => autoAdvance("screenOriginal", val)}
              onBack={goBack}
            />
          )}

          {step === 7 && (
            <TriChoiceStep
              title="Bateria original?"
              subtitle="Só marcar — Sim, Não ou Não sei."
              value={data.batteryOriginal}
              animating={animatingSelection}
              onSelect={val => autoAdvance("batteryOriginal", val)}
              onBack={goBack}
            />
          )}

          {step === 8 && (
            <TriChoiceStep
              title="Câmeras funcionando?"
              subtitle="Só marcar — Sim, Não ou Não sei."
              value={data.camerasOk}
              animating={animatingSelection}
              onSelect={val => autoAdvance("camerasOk", val)}
              onBack={goBack}
            />
          )}

          {step === 9 && (
            <TriChoiceStep
              title="Áudio funcionando?"
              subtitle="Só marcar — Sim, Não ou Não sei."
              value={data.audioOk}
              animating={animatingSelection}
              onSelect={val => autoAdvance("audioOk", val)}
              onBack={goBack}
            />
          )}

          {step === 10 && (
            <TriChoiceStep
              title="Conector de carga funcionando?"
              subtitle="Só marcar — Sim, Não ou Não sei."
              value={data.chargingPortOk}
              animating={animatingSelection}
              onSelect={val => autoAdvance("chargingPortOk", val)}
              onBack={goBack}
            />
          )}

          {step === 11 && (
            <TriChoiceStep
              title="Aparelho já foi aberto?"
              subtitle="Só marcar — Sim, Não ou Não sei."
              value={data.openedBefore}
              animating={animatingSelection}
              onSelect={val => autoAdvance("openedBefore", val)}
              onBack={goBack}
            />
          )}

          {step === 12 && (
            <TriChoiceStep
              title="Tem caixa?"
              subtitle="Só marcar — Sim, Não ou Não sei."
              value={data.hasBox}
              animating={animatingSelection}
              onSelect={val => autoAdvance("hasBox", val)}
              onBack={goBack}
            />
          )}

          {/* ========================================================================= */}
          {/* ETAPA 13: COMO ESTÁ O VISUAL DELE?                                       */}
          {/* ========================================================================= */}
          {step === 13 && (
            <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                Como está o visual dele?
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
                Seja sincero — a conferência é presencial.
              </p>

              <div className="mt-5 space-y-2.5">
                {VISUAL_CONDITION_OPTIONS.map(opt => {
                  const isSelected = data.visualCondition === opt;
                  const isAnimating = animatingSelection === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => autoAdvance("visualCondition", opt)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left text-sm font-semibold transition-all ${
                        isSelected || isAnimating
                          ? "border-[#1d1d1f] bg-[#1d1d1f] text-white scale-[0.99] shadow-xs"
                          : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:border-neutral-300 hover:bg-[#fbfbfd]"
                      }`}
                    >
                      <span>{opt}</span>
                      {(isSelected || isAnimating) && <Check className="h-4 w-4" />}
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <span className="text-xs text-[#86868b]">Toque numa opção pra continuar →</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 14: AGORA AS FOTOS (5 SLOTS DEDICADOS)                             */}
          {/* ========================================================================= */}
          {step === 14 && (
            <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                Agora as fotos
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">
                Com a frente e a traseira você já pode enviar — as outras aceleram sua pré-avaliação.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2.5">
                {photoSlots.slice(0, 4).map(slot => (
                  <PhotoSlotCard
                    key={slot.key}
                    slot={slot}
                    onTrigger={() => fileInputRefs.current[slot.key]?.click()}
                    onRemove={() => removePhoto(slot.key)}
                  />
                ))}
              </div>

              <div className="mt-2.5">
                <PhotoSlotCard
                  slot={photoSlots[4]}
                  onTrigger={() => fileInputRefs.current[photoSlots[4].key]?.click()}
                  onRemove={() => removePhoto(photoSlots[4].key)}
                  fullWidth
                />
              </div>

              {/* Inputs de arquivo ocultos */}
              {photoSlots.map(slot => (
                <input
                  key={slot.key}
                  ref={el => {
                    fileInputRefs.current[slot.key] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => handlePhotoUpload(slot.key, e)}
                />
              ))}

              {/* Observação opcional */}
              <div className="mt-4">
                <label className="block text-xs font-semibold text-[#6e6e73] mb-1">
                  Alguma observação? (opcional)
                </label>
                <textarea
                  value={data.notes}
                  onChange={e => updateField("notes", e.target.value)}
                  placeholder="Ex.: tenho carregador original, pequeno trinco na película..."
                  rows={2}
                  className="w-full rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-3 text-xs text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:border-[#0071e3] focus:bg-white resize-none"
                />
              </div>

              <div className="mt-6 flex items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black font-semibold text-white transition shadow-sm"
                >
                  Continuar <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 15: ÚLTIMA OLHADA ANTES DE ENVIAR (RESUMO & ENVIO)                  */}
          {/* ========================================================================= */}
          {step === 15 && (
            <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
                Última olhada antes de enviar
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">Confere se está tudo certinho.</p>

              {/* Tabela de conferência */}
              <div className="mt-5 divide-y divide-neutral-100 rounded-2xl border border-[#e5e5e7] bg-white text-xs">
                <SummaryRow label="Nome" value={data.name} />
                <SummaryRow label="WhatsApp" value={data.whatsapp} />
                <SummaryRow
                  label="Modelo"
                  value={`${data.model} ${data.storage ? data.storage : ""}`}
                  highlight
                />
                <SummaryRow label="Comprou" value={data.purchaseLocation || "Não informado"} />
                <SummaryRow label="Cor" value={data.color || "Não informada"} />
                <SummaryRow
                  label="Bateria"
                  value={data.batteryUnknown ? "Não sei informar" : `${data.batteryPercent}%`}
                />
                <SummaryRow
                  label="Quer trocar por"
                  value={data.targetModel || "Apenas vender"}
                  highlight
                />
                <SummaryRow label="Estado" value={data.visualCondition || "Em análise"} />
                <SummaryRow label="Fotos" value={`${filledPhotosCount} de 5`} />
              </div>

              {/* Destaque da Pré-Avaliação Estimada */}
              <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    💰 Pré-avaliação estimada
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${gradeConfig.badgeBg} ${gradeConfig.badgeText} ${gradeConfig.badgeBorder}`}
                  >
                    <span>{gradeConfig.iconText}</span>
                    <span>{gradeConfig.label}</span>
                  </span>
                </div>
                <div className="mt-1 font-display text-2xl font-bold text-emerald-950">
                  {formatBRL(valuation.minEstimatedValue)} a {formatBRL(valuation.maxEstimatedValue)}
                </div>
                {valuation.targetModelName && valuation.minTradeDelta !== undefined && (
                  <p className="mt-1.5 text-xs font-medium text-purple-900">
                    🎯 Volta estimada no {valuation.targetModelName}:{" "}
                    <b>
                      {formatBRL(valuation.minTradeDelta)} a {formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}
                    </b>
                  </p>
                )}
              </div>

              {/* Mini resumo do diagnóstico técnico */}
              <div className="mt-3 rounded-xl bg-[#f5f5f7] p-3 text-[11px] leading-relaxed text-[#6e6e73]">
                <span className="font-bold text-[#1d1d1f]">Diagnóstico: </span>
                Face ID ({data.faceId || "–"}), Tela ({data.screenOriginal || "–"}), Bateria (
                {data.batteryOriginal || "–"}), Câmeras ({data.camerasOk || "–"}), Áudio (
                {data.audioOk || "–"}), Conector ({data.chargingPortOk || "–"}), Aberto (
                {data.openedBefore || "–"}), Caixa ({data.hasBox || "–"}).
              </div>

              {/* Box de Confidencialidade e LGPD */}
              <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed text-emerald-900">
                  <b>Avaliação 100% segura e confidencial:</b> Seus dados e fotos são tratados com sigilo
                  conforme a <b>LGPD (Lei nº 13.709/2018)</b> exclusivamente para análise técnica e contato
                  via WhatsApp. Consulte nossa{" "}
                  <a
                    href="/privacidade"
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold underline text-emerald-800 hover:text-emerald-950"
                  >
                    Política de Privacidade
                  </a>.
                </span>
              </div>

              <div className="mt-6 flex items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex h-12 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                </button>
                <button
                  type="button"
                  onClick={submitEvaluation}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black font-semibold text-white transition-all shadow-md shadow-black/10 active:scale-[0.99]"
                >
                  <CheckCircle2 className="h-4 w-4" /> Enviar para avaliação
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé Seguro com Links de Privacidade e Cookies */}
        <footer className="pt-6 pb-2 text-center text-[11px] text-[#86868b] space-y-1">
          <p>
            Seus dados são confidenciais e protegidos pela LGPD. Avaliação gratuita sem compromisso.
          </p>
          <p className="flex items-center justify-center gap-3 text-neutral-500">
            <a
              href="/privacidade"
              target="_blank"
              rel="noreferrer"
              className="hover:text-black transition underline underline-offset-2"
            >
              Termos de Privacidade & LGPD
            </a>
            <span>•</span>
            <a
              href="/privacidade#cookies"
              target="_blank"
              rel="noreferrer"
              className="hover:text-black transition underline underline-offset-2"
            >
              Política de Cookies
            </a>
            <span>•</span>
            <Link
              to="/"
              className="hover:text-black transition underline underline-offset-2"
            >
              Vitrine da Loja
            </Link>
          </p>
        </footer>
      </div>
    </main>
  );
}

// COMPONENTE PARA TELAS DE 3 OPÇÕES (SIM, NÃO, NÃO SEI)
function TriChoiceStep({
  title,
  subtitle,
  value,
  animating,
  onSelect,
  onBack,
}: {
  title: string;
  subtitle: string;
  value: string;
  animating: string | null;
  onSelect: (val: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">
        {title}
      </h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">{subtitle}</p>

      <div className="mt-6 space-y-2.5">
        {SIMPLE_TRI_OPTIONS.map(opt => {
          const isSelected = value === opt;
          const isAnimating = animating === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onSelect(opt)}
              className={`flex h-13 w-full items-center justify-center rounded-2xl border text-sm font-semibold transition-all ${
                isSelected || isAnimating
                  ? "border-[#1d1d1f] bg-[#1d1d1f] text-white scale-[0.99] shadow-xs"
                  : "border-[#e5e5e7] bg-white text-[#1d1d1f] hover:border-neutral-300 hover:bg-[#fbfbfd]"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 items-center justify-center gap-1 rounded-xl border border-[#e5e5e7] px-4 text-xs font-semibold text-neutral-700 transition hover:bg-[#f5f5f7]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </button>
        <span className="text-xs text-[#86868b]">Toque numa opção pra continuar →</span>
      </div>
    </div>
  );
}

// CARD DE SLOT DE FOTO INDIVIDUAL
function PhotoSlotCard({
  slot,
  onTrigger,
  onRemove,
  fullWidth = false,
}: {
  slot: PhotoSlot;
  onTrigger: () => void;
  onRemove: () => void;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all ${
        slot.previewUrl
          ? "border-emerald-500/50 bg-emerald-50/20"
          : "border-[#d5d5d7] bg-[#f5f5f7] hover:border-[#1d1d1f] hover:bg-white"
      } ${fullWidth ? "h-28" : "h-32"} p-2 text-center cursor-pointer`}
      onClick={onTrigger}
    >
      {slot.previewUrl ? (
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl">
          <img
            src={slot.previewUrl}
            alt={slot.label}
            className="h-full w-full object-cover rounded-xl"
          />
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onRemove();
            }}
            className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow-xs hover:bg-black"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-xs border border-neutral-200/60">
            <Camera className="h-4 w-4 text-[#1d1d1f]" />
          </div>
          <span className="mt-2 text-[11px] font-semibold text-[#1d1d1f] leading-tight px-1">
            {slot.label}
          </span>
          {slot.required && (
            <span className="text-[10px] font-bold text-[#0071e3] mt-0.5">Essencial</span>
          )}
        </>
      )}
    </div>
  );
}

// LINHA DE RESUMO FINAL
function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className="text-[#86868b] font-medium">{label}</span>
      <span
        className={`font-semibold text-right ${
          highlight ? "text-[#1d1d1f] font-bold" : "text-neutral-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// CAMPO GENÉRICO DE INPUT
function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-[#6e6e73]">{label}</span>
      <div className="group flex h-12 items-center gap-2.5 rounded-2xl border border-[#e5e5e7] bg-[#f5f5f7] px-3.5 transition-all focus-within:border-[#1d1d1f] focus-within:bg-white focus-within:ring-2 focus-within:ring-black/5">
        <span className="shrink-0 text-[#86868b] transition-colors group-focus-within:text-[#1d1d1f]">
          {icon}
        </span>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </label>
  );
}
