import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/providers/trpc";
import { safeStorage } from "@/lib/storage";
import {
  ADMIN_TOKEN_KEY,
  ADMIN_UNIT_FILTER_KEY,
  AdminSessionContext,
  AdminUnitContext,
  useAdminSession,
} from "@/lib/adminSession";
import type { AdminSessionValue, AdminUnitValue, UnitFilter } from "@/lib/adminSession";
import { can as canUser } from "@contracts/permissions";

function errorStatus(error: unknown): number | undefined {
  return (error as { data?: { httpStatus?: number } } | null)?.data?.httpStatus;
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const utils = trpc.useUtils();
  const [token, setToken] = useState(() => safeStorage.getItem(ADMIN_TOKEN_KEY) ?? "");
  const [sessionMessage, setSessionMessage] = useState("");

  const me = trpc.admin.me.useQuery(undefined, {
    enabled: !!token,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const { mutateAsync: loginAsync } = trpc.admin.login.useMutation();

  const logout = useCallback(() => {
    safeStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    queryClient.clear();
  }, [queryClient]);

  // Token inválido, expirado ou usuário desativado: volta para o login.
  useEffect(() => {
    if (me.error && errorStatus(me.error) === 401) {
      logout();
      setSessionMessage("Sessão expirada. Entre novamente com seu usuário e senha.");
    }
  }, [me.error, logout]);

  const login = useCallback(
    async (username: string, password: string) => {
      safeStorage.removeItem(ADMIN_TOKEN_KEY);
      setSessionMessage("");
      const data = await loginAsync({ username, password });
      safeStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      queryClient.clear();
      utils.admin.me.setData(undefined, data.user);
      setToken(data.token);
    },
    [loginAsync, queryClient, utils],
  );

  const user = token ? (me.data ?? null) : null;
  const { refetch } = me;

  const value = useMemo<AdminSessionValue>(
    () => ({
      user,
      hasToken: !!token,
      isLoading: !!token && !user && me.isLoading,
      isError: !!token && !user && me.isError && errorStatus(me.error) !== 401,
      retry: () => void refetch(),
      sessionMessage,
      can: (cap) => canUser(user, cap),
      login,
      logout,
    }),
    [user, token, me.isLoading, me.isError, me.error, refetch, sessionMessage, login, logout],
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

function readStoredUnit(): UnitFilter | null {
  const raw = safeStorage.getItem(ADMIN_UNIT_FILTER_KEY);
  return raw === "jardim" || raw === "gll" || raw === "todas" ? raw : null;
}

/** Filtro global de unidade (Todas / Jardim / Guia Lopes), lembrado no navegador. */
export function AdminUnitProvider({ children }: { children: ReactNode }) {
  const { user } = useAdminSession();
  const [stored, setStored] = useState<UnitFilter | null>(readStoredUnit);

  const setUnit = useCallback((next: UnitFilter) => {
    safeStorage.setItem(ADMIN_UNIT_FILTER_KEY, next);
    setStored(next);
  }, []);

  const unit: UnitFilter = stored ?? user?.unit ?? "todas";
  const value = useMemo<AdminUnitValue>(() => ({ unit, setUnit }), [unit, setUnit]);

  return <AdminUnitContext.Provider value={value}>{children}</AdminUnitContext.Provider>;
}
