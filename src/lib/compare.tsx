import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { safeStorage } from "./storage";

export const COMPARE_MAX = 3;
const STORAGE_KEY = "lojinha_compare_ids_v1";

interface CompareContextType {
  ids: string[];
  has: (id: string | number) => boolean;
  toggle: (id: string | number) => void;
  remove: (id: string | number) => void;
  clear: () => void;
  isFull: boolean;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

function readIds(): string[] {
  try {
    const raw = safeStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>(readIds);

  useEffect(() => {
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, [ids]);

  const has = useCallback((id: string | number) => ids.includes(String(id)), [ids]);
  const toggle = useCallback((id: string | number) => {
    const key = String(id);
    setIds((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : prev.length >= COMPARE_MAX ? prev : [...prev, key],
    );
  }, []);
  const remove = useCallback((id: string | number) => setIds((prev) => prev.filter((x) => x !== String(id))), []);
  const clear = useCallback(() => setIds([]), []);

  const value = useMemo(
    () => ({ ids, has, toggle, remove, clear, isFull: ids.length >= COMPARE_MAX }),
    [ids, has, toggle, remove, clear],
  );
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare deve ser usado dentro de CompareProvider");
  return ctx;
}
