/** Rotas do painel para ligar/desligar a notificação push neste navegador. */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure } from "./middleware";
import { assertCan } from "./permissions";
import {
  getVapidPublicKey,
  isValidPushEndpoint,
  removeSubscription,
  saveSubscription,
} from "./services/pushNotifications";

const endpointSchema = z.string().min(10).max(2000);

export const pushProcedures = {
  /** Chave pública VAPID (null = o servidor não tem push configurado). */
  pushConfig: adminProcedure.query(({ ctx }) => {
    assertCan(ctx.user, "evaluations.manage");
    return { publicKey: getVapidPublicKey() };
  }),

  pushSubscribe: adminProcedure
    .input(
      z.object({
        endpoint: endpointSchema,
        keys: z.object({ p256dh: z.string().min(10).max(255), auth: z.string().min(10).max(255) }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "evaluations.manage");
      if (!getVapidPublicKey()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Notificação push não está configurada no servidor." });
      }
      if (!isValidPushEndpoint(input.endpoint)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Endereço de notificação inválido." });
      }
      await saveSubscription(
        ctx.user.id,
        { endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth },
        ctx.req.headers.get("user-agent") ?? "",
      );
      return { ok: true };
    }),

  pushUnsubscribe: adminProcedure.input(z.object({ endpoint: endpointSchema })).mutation(async ({ ctx, input }) => {
    assertCan(ctx.user, "evaluations.manage");
    await removeSubscription(input.endpoint);
    return { ok: true };
  }),
};
