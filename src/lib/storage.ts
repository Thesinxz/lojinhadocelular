/**
 * Utilitários defensivos para acesso a localStorage e sessionStorage.
 * Previne falhas fatais (DOMException: SecurityError) em modo privado/anônimo do Safari,
 * WebViews restritas (Instagram, WhatsApp, TikTok) ou navegadores com cookies desabilitados.
 */

// Armazenamento em memória como fallback transparente caso o browser bloqueie o Storage nativo
const memoryStore = new Map<string, string>();

function isStorageAvailable(type: "localStorage" | "sessionStorage"): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storage = window[type];
    if (!storage) return false;
    const testKey = `__test_${type}__`;
    storage.setItem(testKey, "1");
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

const hasLocalStorage = isStorageAvailable("localStorage");
const hasSessionStorage = isStorageAvailable("sessionStorage");

export const safeStorage = {
  getItem(key: string): string | null {
    if (hasLocalStorage) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        // Fallback para memória se o acesso for revogado em runtime
      }
    }
    return memoryStore.get(`local:${key}`) ?? null;
  },

  setItem(key: string, value: string): void {
    if (hasLocalStorage) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch {
        // Fallback para memória se quota exceder ou permissão for negada
      }
    }
    memoryStore.set(`local:${key}`, value);
  },

  removeItem(key: string): void {
    if (hasLocalStorage) {
      try {
        window.localStorage.removeItem(key);
      } catch {}
    }
    memoryStore.delete(`local:${key}`);
  },

  clear(): void {
    if (hasLocalStorage) {
      try {
        window.localStorage.clear();
      } catch {}
    }
    memoryStore.clear();
  },
};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    if (hasSessionStorage) {
      try {
        return window.sessionStorage.getItem(key);
      } catch {}
    }
    return memoryStore.get(`session:${key}`) ?? null;
  },

  setItem(key: string, value: string): void {
    if (hasSessionStorage) {
      try {
        window.sessionStorage.setItem(key, value);
        return;
      } catch {}
    }
    memoryStore.set(`session:${key}`, value);
  },

  removeItem(key: string): void {
    if (hasSessionStorage) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {}
    }
    memoryStore.delete(`session:${key}`);
  },

  clear(): void {
    if (hasSessionStorage) {
      try {
        window.sessionStorage.clear();
      } catch {}
    }
    memoryStore.clear();
  },
};
