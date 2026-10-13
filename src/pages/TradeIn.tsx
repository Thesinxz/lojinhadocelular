import { useEffect, useState, useMemo, useRef, type ChangeEvent } from "react";
import { ArrowLeft } from "lucide-react";
import SEO from "@/components/SEO";
import { useShopSettings, waLink, getMainStoreUrl } from "@/lib/shop";
import { trpc } from "@/providers/trpc";
import { safeStorage, safeSessionStorage } from "@/lib/storage";
import {
  detectIphoneModel,
  getIphoneModelColorImage,
  FALLBACK_STORAGE_OPTIONS,
  FALLBACK_COLOR_OPTIONS,
} from "@/lib/iphoneCatalog";
import { formatBRL, getGradeBadgeConfig } from "@/lib/iphoneKeys";
import type { ValuationResult } from "@contracts/valuation";
import { compressImage } from "@/lib/imageCompressor";
import { STORE_UNITS } from "@contracts/permissions";
import { declaredLojinhaPurchase } from "@contracts/loyalty";
import { isValidCpf, normalizeBrazilPhone } from "@contracts/brDocs";
import {
  EMPTY_VALUATION,
  INITIAL_EVALUATION,
  INITIAL_PHOTO_SLOTS,
  formatCpfInput,
  formatPhoneInput,
  publicHighlights,
  STEP,
  TOTAL_STEPS,
  type EvaluationData,
  type PhotoSlot,
  type PhotoSlotKey,
} from "@/pages/tradein/constants";
import SuccessScreen from "@/pages/tradein/SuccessScreen";
import IdentityStep from "@/pages/tradein/steps/IdentityStep";
import ModelStep from "@/pages/tradein/steps/ModelStep";
import PurchaseStep from "@/pages/tradein/steps/PurchaseStep";
import IcloudStep from "@/pages/tradein/steps/IcloudStep";
import BatteryStep from "@/pages/tradein/steps/BatteryStep";
import TargetModelStep from "@/pages/tradein/steps/TargetModelStep";
import DiagnosisStep, { diagnosisFieldsOf } from "@/pages/tradein/steps/DiagnosisStep";
import VisualConditionStep from "@/pages/tradein/steps/VisualConditionStep";
import PhotosStep from "@/pages/tradein/steps/PhotosStep";
import UnitStep from "@/pages/tradein/steps/UnitStep";
import SummaryStep from "@/pages/tradein/steps/SummaryStep";

/** Progresso do cliente na aba (sem CPF e sem fotos): sobrevive a recarregar a página ou a um corte de conexão. */
const PROGRESS_KEY = "lojinha_tradein_progress_v1";

function readSavedProgress(): { step: number; data: EvaluationData; lgpdConsent: boolean } | null {
  try {
    const raw = safeSessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { step?: unknown; data?: Partial<EvaluationData>; lgpdConsent?: unknown };
    if (typeof saved.step !== "number" || !saved.data || typeof saved.data !== "object") return null;
    // As fotos não são guardadas: se o cliente já tinha passado delas, volta para a etapa das fotos.
    const step = Math.min(Math.max(0, Math.floor(saved.step)), STEP.photos);
    return { step, data: { ...INITIAL_EVALUATION, ...saved.data, cpf: "" }, lgpdConsent: saved.lgpdConsent === true };
  } catch {
    return null;
  }
}

export default function TradeIn() {
  const settings = useShopSettings();
  const fallbackDestination = settings.whatsappJardim || settings.whatsappGll || "5567992086012";
  const submitMutation = trpc.shop.submitEvaluation.useMutation();
  const preparePhotoUploadMutation = trpc.shop.prepareEvaluationPhotoUpload.useMutation();
  const [savedProgress] = useState(readSavedProgress);
  const [step, setStep] = useState(savedProgress?.step ?? 0);
  const [data, setData] = useState<EvaluationData>(savedProgress?.data ?? INITIAL_EVALUATION);
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>(INITIAL_PHOTO_SLOTS);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState("");
  const [photoWarning, setPhotoWarning] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Consentimento precisa de ato afirmativo: começa desmarcado.
  const [lgpdConsent, setLgpdConsent] = useState(savedProgress?.lgpdConsent ?? false);
  const [animatingSelection, setAnimatingSelection] = useState<string | null>(null);

  useEffect(() => {
    if (sent) return;
    const { cpf: _cpf, ...dataWithoutCpf } = data;
    safeSessionStorage.setItem(PROGRESS_KEY, JSON.stringify({ step, data: dataWithoutCpf, lgpdConsent }));
  }, [sent, step, data, lgpdConsent]);

  const fileInputRefs = useRef<{ [key in PhotoSlotKey]?: HTMLInputElement | null }>({});

  const mainStoreUrl = getMainStoreUrl("/#vitrine");

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

  // O valor NÃO é calculado aqui: as tabelas de preço ficam só no servidor. Por padrão o cliente não vê valor
  // (cotação em andamento); se o dono liberar, a estimativa vem do servidor, sob demanda.
  const optionsQuery = trpc.shop.tradeInOptions.useQuery(undefined, { staleTime: 1000 * 60 * 5 });
  const hidePrices = optionsQuery.data?.hidePrices ?? true;

  const quoteInput = useMemo(
    () => ({
      model: data.model,
      storage: data.storage || undefined,
      color: data.color || undefined,
      purchaseLocation: data.purchaseLocation || undefined,
      batteryPercent: typeof data.batteryPercent === "number" ? data.batteryPercent : undefined,
      batteryUnknown: data.batteryUnknown || undefined,
      targetModel: data.targetModel || undefined,
      visualCondition: data.visualCondition || undefined,
      faceId: data.faceId || undefined,
      screenOriginal: data.screenOriginal || undefined,
      batteryOriginal: data.batteryOriginal || undefined,
      camerasOk: data.camerasOk || undefined,
      audioOk: data.audioOk || undefined,
      chargingPortOk: data.chargingPortOk || undefined,
      openedBefore: data.openedBefore || undefined,
      hasBox: data.hasBox || undefined,
      icloudFree: data.icloudFree || undefined,
    }),
    [data],
  );
  const [debouncedQuoteInput, setDebouncedQuoteInput] = useState(quoteInput);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuoteInput(quoteInput), 400);
    return () => clearTimeout(timer);
  }, [quoteInput]);
  const quoteQuery = trpc.shop.tradeInQuote.useQuery(debouncedQuoteInput, {
    enabled: !hidePrices && Boolean(debouncedQuoteInput.model),
    retry: 0,
    staleTime: 1000 * 30,
  });
  const valuation: ValuationResult = quoteQuery.data ?? EMPTY_VALUATION;
  const gradeConfig = useMemo(() => getGradeBadgeConfig(valuation.grade), [valuation.grade]);
  // Só mostra valor quando a loja permite E o servidor devolveu uma cotação com preço; senão fica "cotação em andamento".
  const showPrices = !hidePrices && valuation.priceable;
  const loyaltyDeclared = declaredLojinhaPurchase(data.purchaseLocation);

  const customerHighlights = useMemo(
    () => (hidePrices ? publicHighlights(data) : valuation.highlights),
    [hidePrices, data, valuation.highlights],
  );

  // WhatsApp da loja escolhida pelo cliente (cai no padrão se não houver número)
  const unitWhatsapp =
    data.unit === "jardim" ? settings.whatsappJardim : data.unit === "gll" ? settings.whatsappGll : "";
  const destination = unitWhatsapp || fallbackDestination;
  const unitLabel = STORE_UNITS.find(u => u.value === data.unit)?.label ?? "";

  function updateField<K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) {
    const finalValue =
      field === "whatsapp" && typeof value === "string"
        ? (formatPhoneInput(value) as EvaluationData[K])
        : field === "cpf" && typeof value === "string"
          ? (formatCpfInput(value) as EvaluationData[K])
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

  async function handlePhotoUpload(key: PhotoSlotKey, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reseta o input para permitir selecionar novamente o mesmo arquivo se o usuário quiser
    e.target.value = "";

    // Marca slot como comprimindo
    setPhotoSlots(prev =>
      prev.map(slot => (slot.key === key ? { ...slot, isCompressing: true } : slot))
    );

    try {
      const result = await compressImage(file, {
        // JPEG é mais compatível com fotos do iPhone/Safari e reduz o payload
        // enviado junto com os dados da avaliação em redes móveis.
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7,
        mimeType: "image/jpeg",
      });

      setPhotoSlots(prev =>
        prev.map(slot => {
          if (slot.key === key) {
            if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
            return {
              ...slot,
              file: result.file,
              previewUrl: result.previewUrl,
              dataUrl: result.dataUrl,
              originalSize: result.originalSize,
              compressedSize: result.compressedSize,
              savingsPercent: result.savingsPercent,
              isCompressing: false,
            };
          }
          return slot;
        })
      );
      setError("");
      if (!result.dataUrl) {
        setPhotoWarning(
          "Uma foto não pôde ser otimizada no Safari. A avaliação será registrada, mas essa foto deverá ser enviada pelo WhatsApp."
        );
      }
    } catch (err) {
      console.error("Falha ao comprimir imagem; ela não será incluída no request:", err);
      const previewUrl = URL.createObjectURL(file);

      setPhotoSlots(prev =>
        prev.map(slot => {
          if (slot.key === key) {
            if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
            return {
              ...slot,
              file,
              previewUrl,
              // Não envia o HEIC/original em base64: no Safari isso pode
              // ultrapassar o limite do request e impedir o cadastro inteiro.
              dataUrl: undefined,
              originalSize: file.size,
              compressedSize: file.size,
              savingsPercent: 0,
              isCompressing: false,
            };
          }
          return slot;
        })
      );
      setPhotoWarning(
        "Uma foto não pôde ser otimizada no Safari. A avaliação será registrada, mas essa foto deverá ser enviada pelo WhatsApp."
      );
      setError("");
    }
  }

  function removePhoto(key: PhotoSlotKey) {
    setPhotoSlots(prev =>
      prev.map(slot => {
        if (slot.key === key) {
          if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl);
          return {
            ...slot,
            file: undefined,
            previewUrl: undefined,
            dataUrl: undefined,
            originalSize: undefined,
            compressedSize: undefined,
            savingsPercent: undefined,
            isCompressing: false,
          };
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
      if (!normalizeBrazilPhone(data.whatsapp)) {
        setError("Digite um WhatsApp válido com DDD e número completo. Se colar com +55, inclua o telefone inteiro.");
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
      if (!data.storage || !data.color) {
        setError("Escolha a capacidade e a cor do aparelho para continuar.");
        return false;
      }
    } else if (step === 2) {
      if (!data.purchaseLocation) {
        setError("Selecione onde comprou o aparelho.");
        return false;
      }
      if (declaredLojinhaPurchase(data.purchaseLocation) && data.cpf && !isValidCpf(data.cpf)) {
        setError("Esse CPF não parece válido. Confira os números ou toque em “Prefiro não informar”.");
        return false;
      }
    } else if (step === 3) {
      if (data.icloudFree === "Não") {
        setError("Não conseguimos avaliar aparelhos com bloqueio de iCloud.");
        return false;
      }
    } else if (step === 5) {
      if (!data.targetModel) {
        setError("Selecione o modelo que deseja ou escolha apenas vender.");
        return false;
      }
    } else if (step === STEP.functioning || step === STEP.history) {
      const fields = diagnosisFieldsOf(step - STEP.functioning);
      if (fields.some(field => !data[field])) {
        setError("Responda todas as perguntas para continuar. Na dúvida, escolha “Não sei”.");
        return false;
      }
    } else if (step === STEP.photos) {
      const frontSlot = photoSlots.find(s => s.key === "front");
      const backSlot = photoSlots.find(s => s.key === "back");
      if (!frontSlot?.file || !backSlot?.file) {
        setError(
          "As fotos da Frente e da Traseira do seu aparelho são obrigatórias para realizar a pré-avaliação."
        );
        return false;
      }
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

  async function submitEvaluation() {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const batteryText = data.batteryUnknown ? "Não sei informar" : `${data.batteryPercent}%`;

    // Processa fotos anexadas para envio e armazenamento
    const photosPayload: {
      key: string;
      label: string;
      url: string;
      storage?: "inline" | "s3";
      objectKey?: string;
      name?: string;
      size?: number;
    }[] = [];
    for (const slot of photoSlots) {
      // Somente fotos já comprimidas entram no request. Enviar o original
      // do iPhone em base64 pode estourar o limite de 10 MB no Safari.
      if (slot.dataUrl) {
        try {
          const upload = await preparePhotoUploadMutation.mutateAsync({
            contentType: slot.file?.type || "image/jpeg",
            size: slot.file?.size || 0,
          });

          if (upload.configured && slot.file) {
            const response = await fetch(upload.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": upload.contentType },
              body: slot.file,
            });
            if (!response.ok) {
              throw new Error(`Upload da foto recusado (${response.status})`);
            }
            photosPayload.push({
              key: slot.key,
              label: slot.label,
              url: `s3://${upload.objectKey}`,
              storage: "s3",
              objectKey: upload.objectKey,
              name: slot.file.name,
              size: slot.compressedSize || slot.file.size,
            });
          } else {
            photosPayload.push({
              key: slot.key,
              label: slot.label,
              url: slot.dataUrl,
              storage: "inline",
              name: slot.file?.name,
              size: slot.compressedSize || slot.file?.size,
            });
          }
        } catch (photoError) {
          console.error("Falha ao enviar foto para o armazenamento:", photoError);
          setPhotoWarning(
            "Uma foto não pôde ser enviada para o armazenamento. A avaliação será registrada, mas essa foto deverá ser enviada pelo WhatsApp."
          );
        }
      }
    }

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
      `📍 *Loja:* ${unitLabel || "Não informada"}`,
      "",
      ...(showPrices ? [`✨ *Classificação Preliminar:* ${gradeConfig.label} (${valuation.grade})`] : []),
      ...(!showPrices
        ? [
            "💬 *Proposta:* Aguardando análise técnica e cotação da equipe Lojinha do Celular",
          ]
        : [
            `💰 *Estimativa de Avaliação:* ${formatBRL(valuation.minEstimatedValue)} a ${formatBRL(valuation.maxEstimatedValue)}`,
            valuation.targetModelName && valuation.minTradeDelta !== undefined
              ? `🎯 *Volta Estimada (${valuation.targetModelName}):* ${formatBRL(valuation.minTradeDelta)} a ${formatBRL(valuation.maxTradeDelta ?? valuation.minTradeDelta)}`
              : "",
          ]),
      loyaltyDeclared ? "🎁 *Declarou compra na Lojinha do Celular (conferir cadastro para o bônus de fidelidade)*" : "",
      "",
      "🔍 *Diagnóstico Rápido:*",
      `• iCloud livre: ${data.icloudFree || "Não informado"}`,
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
      `📸 *Fotos anexadas:* ${photosPayload.length} de 5 selecionadas`,
      data.notes ? `📝 *Obs:* ${data.notes}` : "",
      "",
      "Enviado pelo site https://lojinhadocelular.com",
    ]
      .filter(Boolean)
      .join("\n");

    // 1. Salva no banco de dados via tRPC com fotos (garante upload completo no servidor)
    try {
      const result = await submitMutation.mutateAsync({
        name: data.name.trim(),
        whatsapp: normalizeBrazilPhone(data.whatsapp)!,
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
        icloudFree: data.icloudFree,
        cpf:
          declaredLojinhaPurchase(data.purchaseLocation) && isValidCpf(data.cpf) ? data.cpf : undefined,
        visualCondition: data.visualCondition,
        condition: data.visualCondition || "Em análise",
        battery: batteryText,
        notes: data.notes.trim() || undefined,
        photosCount: photosPayload.length,
        photos: photosPayload,
        unit: data.unit || undefined,
      });
      if (!result.ok) {
        throw new Error("O servidor não confirmou o registro da avaliação.");
      }
    } catch (err) {
      console.error("Erro ao salvar proposta via tRPC:", err);
      setError("Não foi possível registrar sua avaliação agora. Confira sua conexão e tente novamente.");
      return;
    } finally {
      setIsSubmitting(false);
    }

    // 2. Histórico local de segurança (preserva fotos para os registros mais recentes)
    try {
      const history = JSON.parse(safeStorage.getItem("lojinha_evaluations_history") || "[]");
      // O CPF nunca é guardado no navegador.
      const { cpf: _cpf, ...dataWithoutCpf } = data;
      const newEntry = {
        ...dataWithoutCpf,
        battery: batteryText,
        photosCount: photosPayload.length,
        photos: photosPayload,
        date: new Date().toISOString(),
      };
      // Limita fotos nos registros mais antigos para não estourar a cota de 5MB do localStorage
      const sanitizedHistory = [newEntry, ...history.slice(0, 9)].map((entry: any, idx: number) => {
        if (idx >= 3 && entry.photos) {
          const { photos: _photos, ...rest } = entry;
          return rest;
        }
        return entry;
      });
      safeStorage.setItem("lojinha_evaluations_history", JSON.stringify(sanitizedHistory));
    } catch {}

    // 3. Prepara a conversa com o atendente para abertura explícita pelo cliente.
    // Não abrimos uma aba provisória antes do envio: isso deixava about:blank
    // aberto quando o navegador bloqueava a navegação após uma operação assíncrona.
    const whatsappUrl = waLink(destination, summaryText);
    setWhatsappUrl(whatsappUrl);
    safeSessionStorage.removeItem(PROGRESS_KEY);
    setSent(true);
  }

  // TELA DE SUCESSO APÓS ENVIO
  if (sent) {
    return (
      <SuccessScreen
        data={data}
        previewImage={previewImage}
        showPrices={showPrices}
        gradeConfig={gradeConfig}
        valuation={valuation}
        photoWarning={photoWarning}
        customerHighlights={customerHighlights}
        whatsappUrl={whatsappUrl}
        destination={destination}
        mainStoreUrl={mainStoreUrl}
        onReset={() => {
          safeSessionStorage.removeItem(PROGRESS_KEY);
          setSent(false);
          setStep(0);
          setData(INITIAL_EVALUATION);
          setLgpdConsent(false);
        }}
      />
    );
  }

  // Progresso relativo (etapas 0 a 16)
  const totalSteps = TOTAL_STEPS;
  const progressPercent = Math.min(100, Math.round(((step + 1) / totalSteps) * 100));

  return (
    <main className="min-h-[100dvh] overflow-x-hidden [overflow-x:clip] bg-[#fbfbfd] text-[#1d1d1f]">
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
            href={mainStoreUrl}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#86868b] transition hover:text-[#1d1d1f]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para loja
          </a>
        </header>

        {/* CORPO DO CARD PRINCIPAL */}
        <div className="my-auto py-2">
          {/* ETAPA 0: VAMOS COMEÇAR (NOME E WHATSAPP) */}
          {step === 0 && (
            <IdentityStep
              data={data}
              updateField={updateField}
              lgpdConsent={lgpdConsent}
              setLgpdConsent={setLgpdConsent}
              error={error}
              goNext={goNext}
            />
          )}

          {/* ETAPA 1: MODELO ATUAL */}
          {step === 1 && (
            <ModelStep
              data={data}
              updateField={updateField}
              selectPopularModel={selectPopularModel}
              detectedModel={detectedModel}
              previewImage={previewImage}
              storageOptions={storageOptions}
              colorOptions={colorOptions}
              error={error}
              goNext={goNext}
              goBack={goBack}
            />
          )}

          {/* ETAPA 2: ONDE VOCÊ COMPROU ESSE IPHONE? */}
          {step === 2 && (
            <PurchaseStep
              data={data}
              updateField={updateField}
              autoAdvance={autoAdvance}
              animatingSelection={animatingSelection}
              setStep={setStep}
              error={error}
              goNext={goNext}
              goBack={goBack}
            />
          )}

          {/* ETAPA 3: ICLOUD / BUSCAR IPHONE (ELIMINATÓRIA) */}
          {step === 3 && (
            <IcloudStep
              data={data}
              updateField={updateField}
              autoAdvance={autoAdvance}
              animatingSelection={animatingSelection}
              mainStoreUrl={mainStoreUrl}
              goBack={goBack}
            />
          )}

          {/* ETAPA 4: SAÚDE DA BATERIA (SLIDER VISUAL) */}
          {step === 4 && <BatteryStep data={data} updateField={updateField} goNext={goNext} goBack={goBack} />}

          {/* ETAPA 5: PRA QUAL IPHONE VOCÊ QUER TROCAR? */}
          {step === 5 && (
            <TargetModelStep
              data={data}
              autoAdvance={autoAdvance}
              animatingSelection={animatingSelection}
              error={error}
              goBack={goBack}
            />
          )}

          {/* ETAPAS 6 E 7: DIAGNÓSTICO SIM / NÃO / NÃO SEI (4 PERGUNTAS POR TELA) */}
          {(step === STEP.functioning || step === STEP.history) && (
            <DiagnosisStep
              group={step - STEP.functioning}
              data={data}
              updateField={updateField}
              error={error}
              goNext={goNext}
              goBack={goBack}
            />
          )}

          {/* ETAPA 8: COMO ESTÁ O VISUAL DELE? */}
          {step === STEP.visual && (
            <VisualConditionStep
              data={data}
              autoAdvance={autoAdvance}
              animatingSelection={animatingSelection}
              goBack={goBack}
            />
          )}

          {/* ETAPA 9: AGORA AS FOTOS (5 SLOTS DEDICADOS) */}
          {step === STEP.photos && (
            <PhotosStep
              data={data}
              updateField={updateField}
              photoSlots={photoSlots}
              fileInputRefs={fileInputRefs}
              handlePhotoUpload={handlePhotoUpload}
              removePhoto={removePhoto}
              goNext={goNext}
              goBack={goBack}
            />
          )}

          {/* ETAPA 10: QUAL LOJA FICA MELHOR? */}
          {step === STEP.unit && (
            <UnitStep
              data={data}
              autoAdvance={autoAdvance}
              animatingSelection={animatingSelection}
              settings={settings}
              goBack={goBack}
            />
          )}

          {/* ETAPA 11: ÚLTIMA OLHADA ANTES DE ENVIAR (RESUMO & ENVIO) */}
          {step === STEP.summary && (
            <SummaryStep
              data={data}
              photoSlots={photoSlots}
              filledPhotosCount={filledPhotosCount}
              unitLabel={unitLabel}
              showPrices={showPrices}
              loyaltyDeclared={loyaltyDeclared}
              gradeConfig={gradeConfig}
              valuation={valuation}
              isSubmitting={isSubmitting}
              setStep={setStep}
              goBack={goBack}
              submitEvaluation={submitEvaluation}
            />
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
            <a
              href={mainStoreUrl}
              className="hover:text-black transition underline underline-offset-2 font-medium"
            >
              Vitrine da Loja
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
