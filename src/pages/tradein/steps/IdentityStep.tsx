import { ArrowRight, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Field } from "../parts";
import type { EvaluationData } from "../constants";

interface IdentityStepProps {
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  lgpdConsent: boolean;
  setLgpdConsent: (value: boolean) => void;
  error: string;
  goNext: () => void;
}

export default function IdentityStep({ data, updateField, lgpdConsent, setLgpdConsent, error, goNext }: IdentityStepProps) {
  return (
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

          <Field
            label="WhatsApp para receber a proposta"
            icon={<Phone className="h-4 w-4" />}
            hint="Se colar com +55, o código do país é removido automaticamente. Celulares no formato antigo recebem o 9º dígito."
          >
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
          className="mt-5 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#1d1d1f] hover:bg-black font-semibold text-white transition-all shadow-md shadow-black/10 active:scale-[0.99]"
        >
          Receber minha pré-avaliação <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
