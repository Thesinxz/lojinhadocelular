import { useSyncExternalStore } from "react";

export type StoreCartUnit = "jardim" | "gll";

let preferredStoreUnit: StoreCartUnit = "jardim";
const listeners = new Set<() => void>();

export function setPreferredStoreUnit(unit: StoreCartUnit): void {
  if (preferredStoreUnit === unit) return;
  preferredStoreUnit = unit;
  for (const listener of listeners) {
    listener();
  }
}

export function getPreferredStoreUnitSnapshot(): StoreCartUnit {
  return preferredStoreUnit;
}

function subscribePreferredStoreUnit(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function usePreferredStoreUnit(): [
  StoreCartUnit,
  (unit: StoreCartUnit) => void,
] {
  const unit = useSyncExternalStore(
    subscribePreferredStoreUnit,
    getPreferredStoreUnitSnapshot,
    getPreferredStoreUnitSnapshot,
  );
  return [unit, setPreferredStoreUnit];
}

export function resolveCartUnitFromAvailability(
  unitAvailability: string | null | undefined,
  currentUnit: StoreCartUnit,
): StoreCartUnit {
  if (unitAvailability === "guia_lopes") return "gll";
  if (unitAvailability === "jardim") return "jardim";
  return currentUnit;
}
