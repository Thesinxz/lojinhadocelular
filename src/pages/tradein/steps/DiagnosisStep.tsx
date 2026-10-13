import { StepActions } from "../parts";
import { SIMPLE_TRI_OPTIONS, type EvaluationData } from "../constants";

export type DiagnosisField =
  | "faceId"
  | "screenOriginal"
  | "batteryOriginal"
  | "camerasOk"
  | "audioOk"
  | "chargingPortOk"
  | "openedBefore"
  | "hasBox";

interface DiagnosisQuestion {
  field: DiagnosisField;
  label: string;
  hint: string;
}

interface DiagnosisGroup {
  title: string;
  subtitle: string;
  questions: DiagnosisQuestion[];
}

/** As perguntas Sim / Não / Não sei, reunidas em duas telas (antes eram oito, uma por tela). */
export const DIAGNOSIS_GROUPS: DiagnosisGroup[] = [
  {
    title: "O aparelho funciona direitinho?",
    subtitle: "Marque uma opção em cada item. Na dúvida, escolha “Não sei”.",
    questions: [
      { field: "faceId", label: "Face ID funciona?", hint: "Desbloqueia o aparelho com o rosto." },
      { field: "camerasOk", label: "Câmeras funcionando?", hint: "Traseiras e frontal tiram foto normalmente." },
      { field: "audioOk", label: "Áudio funcionando?", hint: "Alto-falante, microfone e áudio das chamadas." },
      { field: "chargingPortOk", label: "Conector de carga funcionando?", hint: "Carrega e reconhece o cabo normalmente." },
    ],
  },
  {
    title: "Peças e histórico",
    subtitle: "Última parte do diagnóstico. Na dúvida, escolha “Não sei”.",
    questions: [
      { field: "screenOriginal", label: "Tela original?", hint: "Nunca foi trocada." },
      { field: "batteryOriginal", label: "Bateria original?", hint: "Nunca foi trocada." },
      { field: "openedBefore", label: "Aparelho já foi aberto?", hint: "Por exemplo, em reparo ou assistência técnica." },
      { field: "hasBox", label: "Tem caixa?", hint: "A caixa original do iPhone." },
    ],
  },
];

/** Campos de cada tela de diagnóstico (usado na validação: todas as perguntas são obrigatórias). */
export function diagnosisFieldsOf(groupIndex: number): DiagnosisField[] {
  return (DIAGNOSIS_GROUPS[groupIndex]?.questions ?? []).map(q => q.field);
}

interface DiagnosisStepProps {
  /** 0 = funcionamento, 1 = peças e histórico. */
  group: number;
  data: EvaluationData;
  updateField: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  error: string;
  goNext: () => void;
  goBack: () => void;
}

export default function DiagnosisStep({ group, data, updateField, error, goNext, goBack }: DiagnosisStepProps) {
  const { title, subtitle, questions } = DIAGNOSIS_GROUPS[group];
  const answered = questions.filter(q => data[q.field]).length;

  return (
    <div className="rounded-3xl border border-[#e5e5e7] bg-white p-5 sm:p-6 shadow-[0_15px_40px_-15px_rgba(0,0,0,0.06)] animate-fadeIn">
      <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#1d1d1f]">{title}</h2>
      <p className="mt-1 text-xs sm:text-sm text-[#6e6e73]">{subtitle}</p>

      <div className="mt-5 space-y-4">
        {questions.map(({ field, label, hint }) => (
          <div key={field}>
            <p className="text-sm font-semibold text-[#1d1d1f]">{label}</p>
            <p className="text-[11px] text-[#86868b]">{hint}</p>
            <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={label}>
              {SIMPLE_TRI_OPTIONS.map(option => {
                const isSelected = data[field] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => updateField(field, option)}
                    className={`h-11 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                      isSelected
                        ? "border-[#1d1d1f] bg-[#1d1d1f] text-white shadow-xs"
                        : "border-[#e5e5e7] bg-[#f5f5f7] text-[#1d1d1f] hover:bg-white"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-[11px] text-[#86868b]">
        {answered} de {questions.length} respondidas
      </p>


      <StepActions onBack={goBack} onNext={goNext} error={error} />
    </div>
  );
}
