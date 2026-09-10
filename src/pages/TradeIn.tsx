import { useState, useMemo, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FileImage,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";
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


const STEPS = ["Você", "Aparelho", "Estado", "Fotos"];
const CONDITION_OPTIONS = [
  "Novo ou sem marcas",
  "Bem conservado",
  "Com marcas de uso",
  "Precisa de reparos",
];
const BATTERY_OPTIONS = [
  "90% a 100%",
  "80% a 89%",
  "Abaixo de 80%",
  "Não sei informar",
];

type Evaluation = {
  name: string;
  whatsapp: string;
  model: string;
  storage: string;
  color: string;
  condition: string;
  battery: string;
  notes: string;
};

const INITIAL_EVALUATION: Evaluation = {
  name: "",
  whatsapp: "",
  model: "",
  storage: "",
  color: "",
  condition: "",
  battery: "",
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

function ChoiceButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold transition-all duration-200 ${
        selected
          ? "border-[#0071e3] bg-[#0071e3]/8 text-[#0071e3] ring-2 ring-[#0071e3]/20 shadow-xs"
          : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:border-neutral-300 hover:bg-white"
      }`}
    >
      <span>{label}</span>
      {selected && <Check className="h-4 w-4 shrink-0 text-[#0071e3]" />}
    </button>
  );
}

export default function TradeIn() {
  const settings = useShopSettings();
  const submitMutation = trpc.shop.submitEvaluation.useMutation();
  const [step, setStep] = useState(0);
  const [evaluation, setEvaluation] = useState(INITIAL_EVALUATION);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const detectedModel = useMemo(
    () => detectIphoneModel(evaluation.model),
    [evaluation.model]
  );

  const previewImage = useMemo(
    () => getIphoneModelColorImage(detectedModel, evaluation.color),
    [detectedModel, evaluation.color]
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

  function updateField(field: keyof Evaluation, value: string) {
    const finalValue = field === "whatsapp" ? formatPhoneInput(value) : value;
    setEvaluation(current => ({ ...current, [field]: finalValue }));
    setError("");
  }

  function selectPopularModel(popName: string) {
    updateField("model", popName);
    const found = detectIphoneModel(popName);
    if (found && found.colors.length > 0) {
      const hasCurrent = found.colors.some(
        c => c.name.toLowerCase() === evaluation.color.toLowerCase()
      );
      if (!hasCurrent) {
        updateField("color", found.colors[0].name);
      }
    }
  }

  function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setPhotos(files.map(file => file.name));
  }

  function nextStep() {
    if (step === 0) {
      if (!evaluation.name.trim())
        return setError("Digite seu primeiro nome para continuar.");
      if (evaluation.whatsapp.replace(/\D/g, "").length < 10) {
        return setError("Digite um WhatsApp válido para receber a proposta.");
      }
    }
    if (step === 1 && !evaluation.model.trim())
      return setError("Informe o modelo do seu aparelho.");
    if (step === 2 && (!evaluation.condition || !evaluation.battery)) {
      return setError("Responda as duas perguntas para continuar.");
    }

    setError("");
    setStep(current => Math.min(current + 1, STEPS.length - 1));
  }

  function submitEvaluation() {
    const destination = settings.whatsappJardim || "5567992086012";
    const message = [
      "Olá! Quero fazer uma avaliação para vender ou trocar meu aparelho.",
      "",
      `Nome: ${evaluation.name}`,
      `WhatsApp: ${evaluation.whatsapp}`,
      `Modelo: ${evaluation.model}`,
      `Armazenamento: ${evaluation.storage || "Não informado"}`,
      `Cor: ${evaluation.color || "Não informada"}`,
      `Estado: ${evaluation.condition}`,
      `Saúde da bateria: ${evaluation.battery}`,
      `Fotos selecionadas: ${photos.length ? photos.join(", ") : "Ainda vou anexar"}`,
      `Observações: ${evaluation.notes || "Nenhuma"}`,
      "",
      "Enviado pelo site da Lojinha do Celular.",
    ].join("\n");

    // 1. Salva no banco de dados via tRPC
    submitMutation.mutate({
      name: evaluation.name,
      whatsapp: evaluation.whatsapp,
      model: evaluation.model,
      storage: evaluation.storage,
      color: evaluation.color,
      condition: evaluation.condition,
      battery: evaluation.battery,
      notes: evaluation.notes,
      photosCount: photos.length,
    });

    // 2. Salva no histórico local de segurança
    try {
      const history = JSON.parse(safeStorage.getItem("lojinha_evaluations_history") || "[]");
      safeStorage.setItem(
        "lojinha_evaluations_history",
        JSON.stringify([
          { ...evaluation, photosCount: photos.length, date: new Date().toISOString() },
          ...history.slice(0, 19),
        ])
      );
    } catch {}

    // 3. Abre conversa com o atendente
    window.open(waLink(destination, message), "_blank", "noopener,noreferrer");
    setSent(true);
  }


  if (sent) {
    return (
      <main className="min-h-[100dvh] bg-[#fbfbfd] px-4 py-8 text-[#1d1d1f] sm:py-12">
        <SEO
          title="Avaliação de aparelho"
          description="Faça uma pré-avaliação do seu celular para vender ou trocar na Lojinha do Celular."
        />
        <div className="mx-auto flex min-h-[80dvh] w-full max-w-[560px] flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#0071e3] text-white shadow-md">
            <Check className="h-8 w-8" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-[#86868b]">
            Avaliação enviada
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#1d1d1f] sm:text-4xl">
            Agora é com a nossa equipe.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
            O WhatsApp foi aberto com os seus dados. Anexe as fotos do aparelho
            na conversa para agilizar a pré-avaliação.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black px-6 py-3 font-display font-semibold text-white transition shadow-sm"
          >
            Voltar para a loja <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#fbfbfd] px-4 py-6 text-[#1d1d1f] sm:py-10">
      <SEO
        title="Troque seu aparelho"
        description="Envie os dados do seu celular e receba uma pré-avaliação rápida da Lojinha do Celular."
      />
      <div className="mx-auto w-full max-w-[560px]">
        <header className="flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2"
            aria-label="Voltar para a página inicial"
          >
            <img
              src="/images/logo-icon.png"
              alt="Lojinha do Celular"
              className="h-9 w-auto object-contain"
            />
            <div className="leading-tight">
              <span className="block font-display text-sm font-bold text-[#1d1d1f]">
                Lojinha
              </span>
              <span className="block font-display text-xs font-semibold text-[#86868b]">
                do Celular
              </span>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#86868b] transition hover:text-[#1d1d1f]"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para loja
          </Link>
        </header>

        <section className="pt-8 text-center sm:pt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#86868b]">
            Troca Fácil Lojinha
          </p>
          <h1 className="mt-2 max-w-full break-words font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl text-[#1d1d1f]">
            Venda ou troque seu celular{" "}
            <span className="text-[#0071e3]">com segurança</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[440px] text-sm leading-6 text-[#6e6e73]">
            Conte sobre o seu aparelho e receba uma pré-avaliação da nossa
            equipe pelo WhatsApp.
          </p>
        </section>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-3 text-xs leading-5 text-[#6e6e73]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0071e3]" />
          <span>
            Esta é uma <b className="text-[#1d1d1f]">pré-avaliação online</b>. O valor
            final é confirmado após a conferência presencial do aparelho na
            loja.
          </span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                  index <= step
                    ? "bg-[#0071e3] text-white shadow-xs"
                    : "bg-[#e5e5e7] text-neutral-500"
                }`}
              >
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span
                className={`hidden text-[11px] font-bold uppercase tracking-wide sm:block ${
                  index === step ? "text-[#1d1d1f]" : "text-neutral-400"
                }`}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 transition-colors ${
                    index < step ? "bg-[#0071e3]" : "bg-[#e5e5e7]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <section className="mt-4 rounded-2xl border border-[#e5e5e7] bg-white p-5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.08)] sm:p-6">
          {step === 0 && (
            <>
              <StepHeading
                title="Vamos começar"
                description="Primeiro, conta pra gente quem é você — é por aqui que enviamos sua pré-proposta."
              />
              <div className="mt-5 space-y-4">
                <Field
                  label="Primeiro nome"
                  icon={<UserRound className="h-4 w-4" />}
                >
                  <input
                    value={evaluation.name}
                    onChange={event => updateField("name", event.target.value)}
                    placeholder="Seu nome"
                    autoComplete="name"
                    className="w-full bg-transparent text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:outline-none focus:ring-0 border-none shadow-none ring-0"
                  />
                </Field>
                <div>
                  <Field
                    label="WhatsApp para receber a proposta"
                    icon={<Phone className="h-4 w-4" />}
                  >
                    <input
                      value={evaluation.whatsapp}
                      onChange={event =>
                        updateField("whatsapp", event.target.value)
                      }
                      placeholder="(67) 99999-9999"
                      inputMode="tel"
                      autoComplete="tel"
                      className="w-full bg-transparent text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:outline-none focus:ring-0 border-none shadow-none ring-0"
                    />
                  </Field>
                  <p className="mt-2.5 text-[11.5px] leading-relaxed text-[#86868b]">
                    Usamos seu WhatsApp apenas para enviar a avaliação do seu aparelho. Não enviamos spam.
                  </p>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <StepHeading
                title="Qual aparelho você tem?"
                description="Selecione um modelo popular ou digite o nome do seu iPhone ou celular."
              />
              <div className="mt-5 space-y-5">
                <Field
                  label="Modelo do aparelho"
                  icon={<Smartphone className="h-4 w-4" />}
                >
                  <input
                    value={evaluation.model}
                    onChange={event => updateField("model", event.target.value)}
                    placeholder="Ex.: iPhone 15 Pro, iPhone 13, Galaxy S23..."
                    autoComplete="off"
                    className="w-full bg-transparent text-[15px] sm:text-[16px] text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:outline-none focus:ring-0 border-none shadow-none ring-0"
                  />
                </Field>

                {/* Pílulas de seleção rápida de modelos populares */}
                <div>
                  <span className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[#86868b]">
                    Toque para selecionar seu modelo
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {POPULAR_IPHONE_MODELS.map(popName => {
                      const isSelected =
                        detectedModel?.name.toLowerCase() === popName.toLowerCase() ||
                        evaluation.model.toLowerCase().trim() === popName.toLowerCase();
                      return (
                        <button
                          key={popName}
                          type="button"
                          onClick={() => selectPopularModel(popName)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
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
                  <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 via-white to-neutral-50 p-4 sm:p-5 shadow-xs transition-all animate-fadeIn">
                    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                      {previewImage ? (
                        <div className="relative flex h-36 w-36 sm:h-40 sm:w-40 shrink-0 items-center justify-center rounded-2xl bg-white p-2.5 shadow-sm border border-neutral-100/80">
                          <img
                            key={previewImage}
                            src={previewImage}
                            alt={detectedModel.name}
                            className="h-full w-full object-contain drop-shadow-md transition-all duration-300 animate-fadeIn"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-white p-4 shadow-sm border border-neutral-100">
                          <Smartphone className="h-12 w-12 text-[#0071e3]" />
                        </div>
                      )}
                      <div className="flex-1 text-center sm:text-left min-w-0">
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-[#0071e3]">
                          <Sparkles className="h-3 w-3" /> Modelo reconhecido
                        </div>
                        <h3 className="font-display text-lg sm:text-xl font-bold text-[#1d1d1f] mt-1">
                          {detectedModel.name}
                        </h3>
                        <div className="mt-2.5 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 text-xs text-[#6e6e73]">
                          <span className="rounded-md bg-white border border-neutral-200/70 px-2.5 py-1 font-medium">
                            Ano {detectedModel.year}
                          </span>
                          <span className="rounded-md bg-white border border-neutral-200/70 px-2.5 py-1 font-medium">
                            Tela {detectedModel.screen}
                          </span>
                          {evaluation.color && (
                            <span className="rounded-md bg-white border border-neutral-200/70 px-2.5 py-1 font-medium inline-flex items-center gap-1.5">
                              <span
                                className="h-2.5 w-2.5 rounded-full border border-black/15 shrink-0"
                                style={{
                                  backgroundColor:
                                    colorOptions.find((c) => c.name === evaluation.color)?.hex ?? "#999",
                                }}
                              />
                              {evaluation.color}
                            </span>
                          )}
                          {evaluation.storage && (
                            <span className="rounded-md bg-[#0071e3]/10 border border-[#0071e3]/20 px-2.5 py-1 font-semibold text-[#0071e3]">
                              {evaluation.storage}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[11.5px] text-[#86868b]">
                          Selecione abaixo a capacidade e a cor exata para visualizar o seu aparelho.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Armazenamento dinâmico */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide text-[#6e6e73]">
                      Armazenamento
                    </span>
                    {evaluation.storage && (
                      <span className="text-xs font-bold text-[#0071e3]">
                        {evaluation.storage}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {storageOptions.map(option => (
                      <ChoiceButton
                        key={option}
                        label={option}
                        selected={evaluation.storage === option}
                        onClick={() => updateField("storage", option)}
                      />
                    ))}
                  </div>
                </div>

                {/* Cores oficiais */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-wide text-[#6e6e73]">
                      Cor do aparelho
                    </span>
                    {evaluation.color && (
                      <span className="text-xs font-bold text-[#0071e3]">
                        {evaluation.color}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {colorOptions.map(c => {
                      const isSelected = evaluation.color === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => updateField("color", c.name)}
                          className={`flex min-h-11 items-center gap-2.5 rounded-xl border px-3 text-left text-xs font-semibold transition-all duration-200 ${
                            isSelected
                              ? "border-[#0071e3] bg-[#0071e3]/8 text-[#0071e3] ring-2 ring-[#0071e3]/20 shadow-xs"
                              : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:border-neutral-300 hover:bg-white"
                          }`}
                        >
                          <span
                            className="h-4 w-4 shrink-0 rounded-full border border-black/15 shadow-2xs"
                            style={{ backgroundColor: c.hex }}
                          />
                          <span className="truncate flex-1">{c.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[#0071e3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepHeading
                title="Como está o aparelho?"
                description="Responda com transparência para a equipe fazer uma análise mais próxima."
              />
              <div className="mt-5 space-y-5">
                <div>
                  <span className="mb-2 block text-xs font-semibold tracking-wide text-[#6e6e73]">
                    Estado geral
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CONDITION_OPTIONS.map(option => (
                      <ChoiceButton
                        key={option}
                        label={option}
                        selected={evaluation.condition === option}
                        onClick={() => updateField("condition", option)}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-2 block text-xs font-semibold tracking-wide text-[#6e6e73]">
                    Saúde da bateria
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {BATTERY_OPTIONS.map(option => (
                      <ChoiceButton
                        key={option}
                        label={option}
                        selected={evaluation.battery === option}
                        onClick={() => updateField("battery", option)}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-[#86868b]">
                    No iPhone, veja em Ajustes › Bateria › Saúde da bateria.
                  </p>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepHeading
                title="Agora as fotos"
                description="Frente e traseira já ajudam bastante. Você poderá anexá-las na conversa do WhatsApp."
              />
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d5d5d7] bg-[#f5f5f7] px-5 py-8 text-center transition-all hover:border-[#0071e3] hover:bg-white">
                <Camera className="h-7 w-7 text-[#0071e3]" />
                <span className="mt-3 text-sm font-semibold text-[#1d1d1f]">
                  Selecionar fotos do aparelho
                </span>
                <span className="mt-1 text-xs text-[#86868b]">
                  Frente, traseira, laterais e tela ligada
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handlePhotos}
                />
              </label>
              {photos.length > 0 && (
                <div className="mt-3 space-y-2">
                  {photos.map(photo => (
                    <div
                      key={photo}
                      className="flex items-center gap-2 rounded-lg bg-[#f5f5f7] px-3 py-2 text-xs text-neutral-700"
                    >
                      <FileImage className="h-4 w-4 text-[#0071e3]" />{" "}
                      <span className="truncate">{photo}</span>
                    </div>
                  ))}
                </div>
              )}
              <TextareaField
                label="Alguma observação? (opcional)"
                icon={<Smartphone className="h-4 w-4" />}
              >
                <textarea
                  value={evaluation.notes}
                  onChange={event => updateField("notes", event.target.value)}
                  placeholder="Ex.: tenho caixa e acessórios originais"
                  rows={3}
                  className="w-full bg-transparent text-sm text-[#1d1d1f] placeholder:text-[#86868b] outline-none focus:outline-none focus:ring-0 border-none resize-none shadow-none ring-0"
                />
              </TextareaField>
            </>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center gap-2.5">
            {step > 0 && (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(current => current - 1);
                }}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#e5e5e7] px-5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-[#f5f5f7]"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            )}
            <button
              type="button"
              onClick={step === STEPS.length - 1 ? submitEvaluation : nextStep}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1d1d1f] hover:bg-black px-5 text-sm sm:text-base font-semibold text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.4)] transition-all active:scale-[0.99]"
            >
              {step === STEPS.length - 1
                ? "Enviar para avaliação"
                : "Continuar"}{" "}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <p className="mx-auto mt-5 max-w-md text-center text-[11.5px] leading-5 text-[#86868b]">
          Seus dados serão usados apenas para entrarmos em contato sobre esta
          avaliação.
        </p>
      </div>
    </main>
  );
}

function StepHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight text-[#1d1d1f]">
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-[#6e6e73]">{description}</p>
    </div>
  );
}

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
      <span className="mb-2 block text-xs font-semibold tracking-wide text-[#6e6e73]">
        {label}
      </span>
      <div className="group flex h-12 items-center gap-3 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 transition-all duration-200 focus-within:border-[#0071e3] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0071e3]/15">
        <span className="shrink-0 text-[#86868b] transition-colors group-focus-within:text-[#0071e3]">
          {icon}
        </span>
        <div className="flex-1 min-w-0 [&_input]:w-full [&_input]:bg-transparent [&_input]:text-[15px] sm:[&_input]:text-[16px] [&_input]:text-[#1d1d1f] [&_input]:placeholder:text-[#86868b] [&_input]:outline-none [&_input]:focus:outline-none [&_input]:focus:ring-0 [&_input]:border-none [&_input]:shadow-none [&_input]:ring-0">
          {children}
        </div>
      </div>
    </label>
  );
}

function TextareaField({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block mt-4">
      <span className="mb-2 block text-xs font-semibold tracking-wide text-[#6e6e73]">
        {label}
      </span>
      <div className="group flex items-start gap-3 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-3.5 transition-all duration-200 focus-within:border-[#0071e3] focus-within:bg-white focus-within:ring-4 focus-within:ring-[#0071e3]/15">
        <span className="mt-0.5 shrink-0 text-[#86868b] transition-colors group-focus-within:text-[#0071e3]">
          {icon}
        </span>
        <div className="flex-1 min-w-0 [&_textarea]:w-full [&_textarea]:bg-transparent [&_textarea]:text-sm [&_textarea]:text-[#1d1d1f] [&_textarea]:placeholder:text-[#86868b] [&_textarea]:outline-none [&_textarea]:focus:outline-none [&_textarea]:focus:ring-0 [&_textarea]:border-none [&_textarea]:resize-none [&_textarea]:shadow-none [&_textarea]:ring-0">
          {children}
        </div>
      </div>
    </label>
  );
}
