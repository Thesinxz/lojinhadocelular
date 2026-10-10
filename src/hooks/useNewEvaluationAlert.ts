import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "admin:newEvaluationSound";
const BASE_TITLE = "Painel da Loja | Lojinha do Celular";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      const start = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.start(start);
      osc.stop(start + 0.17);
    });
    window.setTimeout(() => void ctx.close(), 700);
  } catch {
    // Sem áudio liberado pelo navegador: o aviso fica só no título da aba.
  }
}

/**
 * Avisa quando chega avaliação nova: número no título da aba e som (se ligado).
 * `pending` é a contagem de pendentes; um aumento depois da primeira leitura conta como "nova".
 */
export function useNewEvaluationAlert(pending: number | undefined, onNew?: (added: number) => void) {
  const [soundOn, setSoundOn] = useState(readStored);
  const previous = useRef<number | null>(null);
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  }, [onNew]);

  useEffect(() => {
    if (pending === undefined) return;
    document.title = pending > 0 ? `(${pending}) ${BASE_TITLE}` : BASE_TITLE;
    if (previous.current !== null && pending > previous.current) {
      if (soundOn) beep();
      onNewRef.current?.(pending - previous.current);
    }
    previous.current = pending;
  }, [pending, soundOn]);

  const toggleSound = useCallback(() => {
    setSoundOn((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {}
      if (next) beep();
      return next;
    });
  }, []);

  return { soundOn, toggleSound };
}
