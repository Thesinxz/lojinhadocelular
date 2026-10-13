import { TriChoiceStep } from "../parts";
import type { EvaluationData } from "../constants";

type DiagnosisField =
  | "faceId"
  | "screenOriginal"
  | "batteryOriginal"
  | "camerasOk"
  | "audioOk"
  | "chargingPortOk"
  | "openedBefore"
  | "hasBox";

/** Etapas 6 a 13 do wizard: perguntas Sim / Não / Não sei. */
const DIAGNOSIS_STEPS: Record<number, { field: DiagnosisField; title: string }> = {
  6: { field: "faceId", title: "Face ID funciona?" },
  7: { field: "screenOriginal", title: "Tela original?" },
  8: { field: "batteryOriginal", title: "Bateria original?" },
  9: { field: "camerasOk", title: "Câmeras funcionando?" },
  10: { field: "audioOk", title: "Áudio funcionando?" },
  11: { field: "chargingPortOk", title: "Conector de carga funcionando?" },
  12: { field: "openedBefore", title: "Aparelho já foi aberto?" },
  13: { field: "hasBox", title: "Tem caixa?" },
};

export const DIAGNOSIS_FIRST_STEP = 6;
export const DIAGNOSIS_LAST_STEP = 13;

interface DiagnosisStepProps {
  step: number;
  data: EvaluationData;
  autoAdvance: <K extends keyof EvaluationData>(field: K, value: EvaluationData[K]) => void;
  animatingSelection: string | null;
  goBack: () => void;
}

export default function DiagnosisStep({ step, data, autoAdvance, animatingSelection, goBack }: DiagnosisStepProps) {
  const { field, title } = DIAGNOSIS_STEPS[step];
  return (
    <TriChoiceStep
      title={title}
      subtitle="Só marcar — Sim, Não ou Não sei."
      value={data[field]}
      animating={animatingSelection}
      onSelect={val => autoAdvance(field, val)}
      onBack={goBack}
    />
  );
}
