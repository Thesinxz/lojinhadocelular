import { createRouter, publicQuery } from "./middleware";
import { shopRouter } from "./shop";
import { adminRouter } from "./admin";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  shop: shopRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
