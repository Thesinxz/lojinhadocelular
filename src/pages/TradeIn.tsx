import { useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  FileImage,
  Phone,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import { Link } from "react-router";
import SEO from "@/components/SEO";
import { useShopSettings, waLink } from "@/lib/shop";

const STEPS = ["Você", "Aparelho", "Estado", "Fotos"];
const STORAGE_OPTIONS = [
  "64 GB",
  "128 GB",
  "256 GB",
  "512 GB",
  "1 TB",
  "Não sei",
];
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
  condition: string;
  battery: string;
  notes: string;
};

const INITIAL_EVALUATION: Evaluation = {
  name: "",
  whatsapp: "",
  model: "",
  storage: "",
  condition: "",
  battery: "",
  notes: "",
};

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
      className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left text-sm font-semibold transition ${
        selected
          ? "border-ink bg-brand text-ink shadow-[3px_3px_0_0_#141414]"
          : "border-[#e5e5e7] bg-[#f5f5f7] text-ink hover:border-ink hover:bg-white"
      }`}
    >
      {label}
      {selected && <Check className="h-4 w-4 shrink-0" />}
    </button>
  );
}

export default function TradeIn() {
  const settings = useShopSettings();
  const [step, setStep] = useState(0);
  const [evaluation, setEvaluation] = useState(INITIAL_EVALUATION);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function updateField(field: keyof Evaluation, value: string) {
    setEvaluation(current => ({ ...current, [field]: value }));
    setError("");
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
      `Estado: ${evaluation.condition}`,
      `Saúde da bateria: ${evaluation.battery}`,
      `Fotos selecionadas: ${photos.length ? photos.join(", ") : "Ainda vou anexar"}`,
      `Observações: ${evaluation.notes || "Nenhuma"}`,
      "",
      "Enviado pelo site da Lojinha do Celular.",
    ].join("\n");

    window.open(waLink(destination, message), "_blank", "noopener,noreferrer");
    setSent(true);
  }

  if (sent) {
    return (
      <main className="min-h-[100dvh] bg-[#fafafa] px-4 py-8 text-ink sm:py-12">
        <SEO
          title="Avaliação de aparelho"
          description="Faça uma pré-avaliação do seu celular para vender ou trocar na Lojinha do Celular."
        />
        <div className="mx-auto flex min-h-[80dvh] w-full max-w-[560px] flex-col items-center justify-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink bg-brand shadow-[4px_4px_0_0_#141414]">
            <Check className="h-8 w-8" />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-neutral-500">
            Avaliação enviada
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Agora é com a nossa equipe.
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-neutral-600">
            O WhatsApp foi aberto com os seus dados. Anexe as fotos do aparelho
            na conversa para agilizar a pré-avaliação.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-ink px-5 py-3 font-display font-bold text-brand"
          >
            Voltar para a loja <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#fafafa] px-4 py-6 text-ink sm:py-10">
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
              className="h-10 w-auto object-contain"
            />
            <div className="leading-tight">
              <span className="block font-display text-sm font-bold">
                Lojinha
              </span>
              <span className="block font-display text-xs font-semibold text-neutral-500">
                do Celular
              </span>
            </div>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-500 transition hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar para loja
          </Link>
        </header>

        <section className="pt-8 text-center sm:pt-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-500">
            Troca Fácil Lojinha
          </p>
          <h1 className="mt-2 max-w-full break-words font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Venda ou troque seu celular{" "}
            <span className="text-[#b7aa00]">com segurança</span>
          </h1>
          <p className="mx-auto mt-3 max-w-[440px] text-sm leading-6 text-neutral-600">
            Conte sobre o seu aparelho e receba uma pré-avaliação da nossa
            equipe pelo WhatsApp.
          </p>
        </section>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-4 py-3 text-xs leading-5 text-neutral-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#9b9000]" />
          <span>
            Esta é uma <b className="text-ink">pré-avaliação online</b>. O valor
            final é confirmado após a conferência presencial do aparelho na
            loja.
          </span>
        </div>

        <div className="mt-5 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index <= step ? "bg-brand text-ink" : "bg-[#e5e5e7] text-neutral-500"}`}
              >
                {index < step ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </div>
              <span
                className={`hidden text-[11px] font-bold uppercase tracking-wide sm:block ${index === step ? "text-ink" : "text-neutral-400"}`}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <div
                  className={`h-px flex-1 ${index < step ? "bg-ink" : "bg-[#e5e5e7]"}`}
                />
              )}
            </div>
          ))}
        </div>

        <section className="mt-4 rounded-2xl border border-[#e5e5e7] bg-white p-5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.18)] sm:p-6">
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
                  />
                </Field>
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
                  />
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <StepHeading
                title="Qual aparelho você tem?"
                description="Pode ser um iPhone ou Android. Digite o modelo que está com você hoje."
              />
              <div className="mt-5 space-y-4">
                <Field
                  label="Modelo do aparelho"
                  icon={<Smartphone className="h-4 w-4" />}
                >
                  <input
                    value={evaluation.model}
                    onChange={event => updateField("model", event.target.value)}
                    placeholder="Ex.: iPhone 13 Pro"
                    autoComplete="off"
                  />
                </Field>
                <div>
                  <span className="mb-2 block text-xs font-medium tracking-wide text-neutral-500">
                    Armazenamento
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {STORAGE_OPTIONS.map(option => (
                      <ChoiceButton
                        key={option}
                        label={option}
                        selected={evaluation.storage === option}
                        onClick={() => updateField("storage", option)}
                      />
                    ))}
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
                  <span className="mb-2 block text-xs font-medium tracking-wide text-neutral-500">
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
                  <span className="mb-2 block text-xs font-medium tracking-wide text-neutral-500">
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
                  <p className="mt-2 text-xs text-neutral-500">
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
              <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#d5d5d7] bg-[#f5f5f7] px-5 py-8 text-center transition hover:border-ink hover:bg-white">
                <Camera className="h-7 w-7 text-[#9b9000]" />
                <span className="mt-3 text-sm font-bold">
                  Selecionar fotos do aparelho
                </span>
                <span className="mt-1 text-xs text-neutral-500">
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
                      className="flex items-center gap-2 rounded-lg bg-[#f5f5f7] px-3 py-2 text-xs text-neutral-600"
                    >
                      <FileImage className="h-4 w-4 text-[#9b9000]" />{" "}
                      <span className="truncate">{photo}</span>
                    </div>
                  ))}
                </div>
              )}
              <Field
                label="Alguma observação? (opcional)"
                icon={<Smartphone className="h-4 w-4" />}
              >
                <textarea
                  value={evaluation.notes}
                  onChange={event => updateField("notes", event.target.value)}
                  placeholder="Ex.: tenho caixa e acessórios"
                  rows={3}
                />
              </Field>
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
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-[#e5e5e7] px-4 text-sm font-bold text-neutral-600 transition hover:border-ink hover:text-ink"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            )}
            <button
              type="button"
              onClick={step === STEPS.length - 1 ? submitEvaluation : nextStep}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-ink px-4 text-sm font-bold text-brand shadow-[0_10px_30px_-12px_rgba(0,0,0,0.5)] transition hover:bg-black active:scale-[0.99]"
            >
              {step === STEPS.length - 1
                ? "Enviar para avaliação"
                : "Continuar"}{" "}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <p className="mx-auto mt-5 max-w-md text-center text-[11px] leading-5 text-neutral-500">
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
      <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
        {title}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-neutral-500">{description}</p>
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
      <span className="mb-2 block text-xs font-medium tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="group flex items-start gap-3 rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] px-3.5 py-3 transition-colors focus-within:border-ink focus-within:bg-white">
        <span className="mt-1 text-neutral-400 transition-colors group-focus-within:text-[#9b9000]">
          {icon}
        </span>
        <span className="flex-1 [&_input]:w-full [&_input]:bg-transparent [&_input]:text-base [&_input]:text-ink [&_input]:placeholder:text-neutral-400 [&_input]:focus:outline-none [&_textarea]:w-full [&_textarea]:resize-none [&_textarea]:bg-transparent [&_textarea]:text-sm [&_textarea]:text-ink [&_textarea]:placeholder:text-neutral-400 [&_textarea]:focus:outline-none">
          {children}
        </span>
      </span>
    </label>
  );
}
