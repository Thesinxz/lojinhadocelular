import { createContext, useContext } from "react";
import type { Capability, SessionUser, StoreUnit } from "@contracts/permissions";

export const ADMIN_TOKEN_KEY = "admin_token";
export const ADMIN_UNIT_FILTER_KEY = "admin_unit_filter";

export interface AdminSessionValue {
  user: SessionUser | null;
  /** Existe um token salvo neste navegador. */
  hasToken: boolean;
  /** Há token salvo e a sessão ainda está sendo validada. */
  isLoading: boolean;
  /** Falha ao validar a sessão por motivo diferente de 401 (ex.: sem internet). */
  isError: boolean;
  retry: () => void;
  /** Mensagem exibida na tela de login (ex.: sessão expirada). */
  sessionMessage: string;
  can: (cap: Capability) => boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AdminSessionContext = createContext<AdminSessionValue | null>(null);

export function useAdminSession(): AdminSessionValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error("useAdminSession precisa estar dentro de AdminSessionProvider");
  return ctx;
}

export type UnitFilter = StoreUnit | "todas";

export interface AdminUnitValue {
  unit: UnitFilter;
  setUnit: (unit: UnitFilter) => void;
}

export const AdminUnitContext = createContext<AdminUnitValue | null>(null);

export function useAdminUnit(): AdminUnitValue {
  const ctx = useContext(AdminUnitContext);
  if (!ctx) throw new Error("useAdminUnit precisa estar dentro de AdminUnitProvider");
  return ctx;
}
