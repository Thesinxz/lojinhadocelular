export type AdminRole = "dono" | "vendedor";
export type StoreUnit = "jardim" | "gll";

export const STORE_UNITS: { value: StoreUnit; label: string }[] = [
  { value: "jardim", label: "Jardim" },
  { value: "gll", label: "Guia Lopes da Laguna" },
];

export const ADMIN_ROLES: { value: AdminRole; label: string }[] = [
  { value: "dono", label: "Dono" },
  { value: "vendedor", label: "Vendedor" },
];

export interface SessionUser {
  id: number;
  username: string;
  name: string;
  role: AdminRole;
  unit: StoreUnit | null;
  canEditPrices: boolean;
}

export type Capability =
  | "evaluations.manage" // todos
  | "evaluations.assign" // dono: atribuir avaliação a outro usuário
  | "products.editMedia" // todos: fotos, vídeos, bateria, observações, disponível/quantidade, ocultar/mostrar
  | "products.editPrice" // dono, ou vendedor com canEditPrices
  | "products.manage" // dono: criar, excluir, destacar, dados cadastrais, variantes
  | "settings.manage" // dono
  | "users.manage" // dono
  | "reports.team"; // dono: ranking por vendedor

export function can(user: SessionUser | null | undefined, cap: Capability): boolean {
  if (!user) return false;
  if (user.role === "dono") return true;
  if (user.role !== "vendedor") return false;
  switch (cap) {
    case "evaluations.manage":
    case "products.editMedia":
      return true;
    case "products.editPrice":
      return user.canEditPrices === true;
    default:
      return false;
  }
}
