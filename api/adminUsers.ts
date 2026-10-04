import { z } from "zod";
import { STORE_UNITS, type SessionUser } from "@contracts/permissions";
import { adminProcedure, createRouter } from "./middleware";
import { assertCan } from "./permissions";
import { logAction } from "./services/auditLog";
import {
  createUser,
  getUserById,
  listUsers,
  setUserPassword,
  toSessionUser,
  updateUser,
  type AdminUserRecord,
} from "./services/userStore";
import { TRPCError } from "@trpc/server";

export interface PublicAdminUser extends SessionUser {
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/** Remove o hash de senha antes de enviar ao cliente. */
export function toPublicUser(r: AdminUserRecord): PublicAdminUser {
  return {
    ...toSessionUser(r),
    active: r.active,
    lastLoginAt: r.lastLoginAt,
    createdAt: r.createdAt,
  };
}

const roleSchema = z.enum(["dono", "vendedor"]);
const unitSchema = z.enum(["jardim", "gll"]).nullable();
const passwordSchema = z.string().min(6, "A senha deve ter pelo menos 6 caracteres").max(128);

const ROLE_LABEL: Record<string, string> = { dono: "Dono", vendedor: "Vendedor" };

function unitLabel(unit: string | null): string {
  return STORE_UNITS.find((u) => u.value === unit)?.label ?? "Todas as unidades";
}

function describeUserChanges(before: AdminUserRecord, after: AdminUserRecord): string[] {
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`nome: "${before.name}" → "${after.name}"`);
  if (before.role !== after.role) changes.push(`nível: ${ROLE_LABEL[before.role]} → ${ROLE_LABEL[after.role]}`);
  if (before.unit !== after.unit) changes.push(`unidade: ${unitLabel(before.unit)} → ${unitLabel(after.unit)}`);
  if (before.canEditPrices !== after.canEditPrices) {
    changes.push(after.canEditPrices ? "pode editar preços" : "não pode mais editar preços");
  }
  if (before.active !== after.active) changes.push(after.active ? "reativado" : "desativado");
  return changes;
}

export const adminUsersRouter = createRouter({
  list: adminProcedure.query(async ({ ctx }) => {
    assertCan(ctx.user, "users.manage");
    return (await listUsers()).map(toPublicUser);
  }),

  create: adminProcedure
    .input(
      z.object({
        username: z.string().min(1).max(60),
        name: z.string().min(1).max(80),
        password: passwordSchema,
        role: roleSchema,
        unit: unitSchema.default(null),
        canEditPrices: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "users.manage");
      const created = await createUser(input);
      await logAction(ctx.user, {
        action: "user.create",
        entityType: "user",
        entityId: created.id,
        summary: `Criou o usuário ${created.name} (@${created.username}, ${ROLE_LABEL[created.role]}, ${unitLabel(created.unit)})`,
      });
      return toPublicUser(created);
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(80).optional(),
        role: roleSchema.optional(),
        unit: unitSchema.optional(),
        canEditPrices: z.boolean().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "users.manage");
      const { id, ...patch } = input;
      const before = await getUserById(id);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      const updated = await updateUser(ctx.user, id, patch);
      const changes = describeUserChanges(before, updated);
      if (changes.length) {
        const action =
          before.active && !updated.active
            ? "user.deactivate"
            : !before.active && updated.active
              ? "user.activate"
              : "user.update";
        await logAction(ctx.user, {
          action,
          entityType: "user",
          entityId: id,
          summary: `${updated.name}: ${changes.join("; ")}`,
        });
      }
      return toPublicUser(updated);
    }),

  resetPassword: adminProcedure
    .input(z.object({ id: z.number().int().positive(), password: passwordSchema }))
    .mutation(async ({ ctx, input }) => {
      assertCan(ctx.user, "users.manage");
      const target = await getUserById(input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      await setUserPassword(input.id, input.password);
      await logAction(ctx.user, {
        action: "user.resetPassword",
        entityType: "user",
        entityId: input.id,
        summary: `Redefiniu a senha de ${target.name}`,
      });
      return { ok: true };
    }),
});
