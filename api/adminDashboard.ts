/**
 * Procedimento do dashboard do painel (`admin.dashboard`).
 */
import { z } from "zod";
import { can } from "@contracts/permissions";
import { DEFAULT_EVALUATION_SLA_HOURS, SETTING_KEYS } from "@contracts/types";
import { adminProcedure } from "./middleware";
import { computeCatalogIssues, computeEvaluationStats, type CatalogIssueProduct } from "./dashboard";
import { parseSlaHours } from "./evaluationWorkflow";
import { listAudit } from "./services/auditLog";
import { findEvaluationStatRows } from "./services/evaluationStore";
import { getSingleSetting } from "./services/settingsStore";
import { getErpStatus, loadAdminProducts } from "./services/adminCatalog";

/** Limite de itens por lista de pendência devolvidos ao painel. */
const ISSUE_LIST_LIMIT = 30;

export const dashboardProcedures = {
  dashboard: adminProcedure
    .input(z.object({ unit: z.enum(["jardim", "gll"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const user = ctx.user;
      const canSeeEvaluations = can(user, "evaluations.manage");
      const canSeeProducts = can(user, "products.editMedia");
      const now = new Date();

      const [evalRows, slaRaw, products, erp, activity] = await Promise.all([
        canSeeEvaluations
          ? findEvaluationStatRows(input?.unit).catch((err) => {
              console.error("Dashboard: falha ao ler avaliações:", err);
              return [];
            })
          : Promise.resolve([]),
        getSingleSetting(SETTING_KEYS.evaluationSlaHours),
        canSeeProducts ? loadAdminProducts().catch(() => []) : Promise.resolve([]),
        getErpStatus().catch(() => ({
          enabled: true,
          status: "offline" as const,
          count: 0,
          message: "Não foi possível consultar o ERP",
          lastSyncAt: null,
        })),
        listAudit({
          limit: 15,
          entityType: can(user, "users.manage") ? undefined : "evaluation",
        }).catch(() => []),
      ]);

      const slaHours = parseSlaHours(slaRaw, DEFAULT_EVALUATION_SLA_HOURS);
      const stats = computeEvaluationStats(evalRows, now, slaHours);
      const issues = computeCatalogIssues(products as unknown as CatalogIssueProduct[]);
      const clip = (list: typeof issues.noPhoto) => ({
        total: list.length,
        items: list.slice(0, ISSUE_LIST_LIMIT),
      });

      return {
        generatedAt: now.toISOString(),
        slaHours,
        now: stats.now,
        month: stats.month,
        ranking: can(user, "reports.team") ? stats.ranking : null,
        catalogIssues: {
          noPhoto: clip(issues.noPhoto),
          noBattery: clip(issues.noBattery),
          soldOutVisible: clip(issues.soldOutVisible),
        },
        erp,
        activity,
      };
    }),
};
