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
  /** Permissões extras concedidas pelo dono a um vendedor (somente as delegáveis). */
  extraCaps?: Capability[];
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

/** Permissões que o dono pode conceder a um vendedor (gestão de usuários e configurações nunca). */
export const DELEGABLE_CAPABILITIES: { value: Capability; label: string; hint: string }[] = [
  { value: "evaluations.assign", label: "Atribuir avaliações", hint: "Passar uma avaliação para outro atendente." },
  { value: "reports.team", label: "Ver ranking da equipe", hint: "Enxergar o desempenho de cada atendente." },
  { value: "products.manage", label: "Gerenciar produtos", hint: "Criar, excluir e destacar produtos." },
];

/** Mantém só permissões delegáveis, sem repetição. */
export function sanitizeExtraCaps(value: unknown): Capability[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(DELEGABLE_CAPABILITIES.map((c) => c.value));
  return [...new Set(value.filter((v): v is Capability => typeof v === "string" && allowed.has(v)))];
}

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
      return Array.isArray(user.extraCaps) && sanitizeExtraCaps(user.extraCaps).includes(cap);
  }
}
