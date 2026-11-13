import { useSyncExternalStore } from "react";

let productStickyCtaVisible = false;
const listeners = new Set<() => void>();

/** Informa se a barra fixa mobile de compra da página de produto está visível. */
export function setProductStickyCtaVisible(visible: boolean): void {
  if (productStickyCtaVisible === visible) return;
  productStickyCtaVisible = visible;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot síncrono da visibilidade da barra sticky (compatível com SSR/Node). */
export function getProductStickyCtaVisibleSnapshot(): boolean {
  return productStickyCtaVisible;
}

function getServerSnapshot(): boolean {
  return false;
}

/** Hook reativo usado por overlays inferiores (`CompareBar`) para evitar sobreposição no mobile. */
export function useProductStickyCtaVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    getProductStickyCtaVisibleSnapshot,
    getServerSnapshot,
  );
}
