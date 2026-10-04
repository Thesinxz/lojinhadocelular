import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { getSessionUser } from "./auth";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const createRouter = t.router;
export const publicQuery = t.procedure;

/**
 * Procedimento autenticado do painel: valida o token e recarrega o usuário
 * a cada requisição (inativo/inexistente → UNAUTHORIZED). Injeta `ctx.user`.
 */
export const adminProcedure = t.procedure.use(async ({ ctx, next }) => {
  const user = await getSessionUser(ctx.req);
  if (!user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Não autorizado" });
  }
  return next({ ctx: { ...ctx, user } });
});
