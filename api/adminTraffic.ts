/** Acessos ao site (`admin.traffic`): exclusivo do dono. */
import { z } from "zod";
import { adminProcedure } from "./middleware";
import { assertCan } from "./permissions";
import { getTrafficOverview } from "./services/pageViews";

export const trafficProcedures = {
  traffic: adminProcedure.input(z.object({ days: z.number().int().min(1).max(90) })).query(({ ctx, input }) => {
    assertCan(ctx.user, "settings.manage");
    return getTrafficOverview(input.days);
  }),
};
