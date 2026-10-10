import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { sanitizeExtraCaps, type AdminRole, type Capability, type SessionUser, type StoreUnit } from "@contracts/permissions";
import { DEFAULT_SETTINGS, SETTING_KEYS } from "@contracts/types";
import { adminUsers } from "@db/schema";
import { ensureTables, getDb } from "../queries/connection";
import { getSingleSetting } from "./settingsStore";
import { hashPassword } from "../lib/password";

export interface AdminUserRecord extends SessionUser {
  passwordHash: string;
  active: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  /** Tokens emitidos antes deste instante deixam de valer (encerrar sessões). */
  sessionsValidAfter: Date | null;
}

export interface CreateUserInput {
  username: string;
  name: string;
  password: string;
  role: AdminRole;
  unit: StoreUnit | null;
  canEditPrices: boolean;
  extraCaps?: Capability[];
}

export interface UpdateUserPatch {
  name?: string;
  role?: AdminRole;
  unit?: StoreUnit | null;
  canEditPrices?: boolean;
  extraCaps?: Capability[];
  active?: boolean;
}

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;
export const MIN_PASSWORD_LENGTH = 6;
const ROLES: AdminRole[] = ["dono", "vendedor"];
const UNITS: StoreUnit[] = ["jardim", "gll"];

function isMemoryMode(): boolean {
  return process.env.NODE_ENV === "test" || !process.env.DATABASE_URL;
}

// ===== Armazenamento em memória (testes / sem banco) =====
let memoryUsers: AdminUserRecord[] = [];
let memoryNextId = 1;

export function resetUserStoreForTesting(): void {
  memoryUsers = [];
  memoryNextId = 1;
  bootstrapPromise = null;
}

// ===== Helpers =====
export function normalizeUsername(username: string): string {
  return (username || "").trim().toLowerCase();
}

function badRequest(message: string): TRPCError {
  return new TRPCError({ code: "BAD_REQUEST", message });
}

function normalizeUnit(unit: unknown): StoreUnit | null {
  return UNITS.includes(unit as StoreUnit) ? (unit as StoreUnit) : null;
}

function validateName(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed || trimmed.length > 80) {
    throw badRequest("Informe um nome com até 80 caracteres");
  }
  return trimmed;
}

export function validatePassword(password: string): void {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH || password.length > 128) {
    throw badRequest(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres`);
  }
}

function validateRole(role: unknown): AdminRole {
  if (!ROLES.includes(role as AdminRole)) throw badRequest("Nível de acesso inválido");
  return role as AdminRole;
}

function validateUnit(unit: unknown): StoreUnit | null {
  if (unit === null || unit === undefined || unit === "") return null;
  if (!UNITS.includes(unit as StoreUnit)) throw badRequest("Unidade inválida");
  return unit as StoreUnit;
}

type AdminUserRow = typeof adminUsers.$inferSelect;

function parseExtraCaps(raw: string | null | undefined): Capability[] {
  if (!raw) return [];
  try {
    return sanitizeExtraCaps(JSON.parse(raw));
  } catch {
    return [];
  }
}

function fromRow(row: AdminUserRow): AdminUserRecord {
  return {
    id: Number(row.id),
    username: String(row.username),
    name: String(row.name),
    role: row.role === "dono" ? "dono" : "vendedor",
    unit: normalizeUnit(row.unit),
    canEditPrices: Boolean(row.canEditPrices),
    extraCaps: parseExtraCaps(row.extraCaps),
    sessionsValidAfter: row.sessionsValidAfter ? new Date(row.sessionsValidAfter) : null,
    passwordHash: String(row.passwordHash),
    active: Boolean(row.active),
    lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt) : null,
    createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
  };
}

async function db() {
  const instance = getDb();
  await ensureTables();
  return instance;
}

function clone(record: AdminUserRecord): AdminUserRecord {
  return {
    ...record,
    lastLoginAt: record.lastLoginAt ? new Date(record.lastLoginAt) : null,
    createdAt: new Date(record.createdAt),
    sessionsValidAfter: record.sessionsValidAfter ? new Date(record.sessionsValidAfter) : null,
    extraCaps: [...(record.extraCaps ?? [])],
  };
}

export function toSessionUser(r: AdminUserRecord): SessionUser {
  const extraCaps = r.role === "vendedor" ? sanitizeExtraCaps(r.extraCaps) : [];
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    unit: r.unit,
    canEditPrices: r.canEditPrices,
    // Só aparece quando há permissões extras (o formato antigo não muda para quem não tem).
    ...(extraCaps.length ? { extraCaps } : {}),
  };
}

// ===== Consultas =====
export async function listUsers(): Promise<AdminUserRecord[]> {
  if (isMemoryMode()) {
    return memoryUsers.map(clone).sort((a, b) => a.id - b.id);
  }
  const rows = await (await db()).select().from(adminUsers).orderBy(asc(adminUsers.id));
  return rows.map(fromRow);
}

export async function getUserById(id: number): Promise<AdminUserRecord | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  if (isMemoryMode()) {
    const found = memoryUsers.find((u) => u.id === id);
    return found ? clone(found) : null;
  }
  const rows = await (await db()).select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function getUserByUsername(username: string): Promise<AdminUserRecord | null> {
  const normalized = normalizeUsername(username);
  if (!normalized) return null;
  if (isMemoryMode()) {
    const found = memoryUsers.find((u) => u.username === normalized);
    return found ? clone(found) : null;
  }
  const rows = await (await db())
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.username, normalized))
    .limit(1);
  return rows[0] ? fromRow(rows[0]) : null;
}

// ===== Escrita =====
async function insertUser(data: Omit<AdminUserRecord, "id" | "createdAt" | "lastLoginAt" | "sessionsValidAfter">): Promise<AdminUserRecord> {
  if (isMemoryMode()) {
    const record: AdminUserRecord = {
      ...data,
      id: memoryNextId++,
      lastLoginAt: null,
      createdAt: new Date(),
      sessionsValidAfter: null,
    };
    memoryUsers.push(record);
    return clone(record);
  }
  const instance = await db();
  try {
    const result = await instance.insert(adminUsers).values({
      username: data.username,
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role,
      unit: data.unit,
      canEditPrices: data.canEditPrices,
      extraCaps: data.extraCaps?.length ? JSON.stringify(data.extraCaps) : null,
      active: data.active,
    });
    const id = Number(result[0].insertId);
    const created = await getUserById(id);
    if (!created) throw new Error("Usuário criado não encontrado");
    return created;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com esse nome de usuário" });
    }
    throw err;
  }
}

function isDuplicateKeyError(err: unknown): boolean {
  const e = err as { code?: string; errno?: number; cause?: { code?: string; errno?: number } } | null;
  return (
    e?.code === "ER_DUP_ENTRY" ||
    e?.errno === 1062 ||
    e?.cause?.code === "ER_DUP_ENTRY" ||
    e?.cause?.errno === 1062
  );
}

export async function createUser(input: CreateUserInput): Promise<AdminUserRecord> {
  const username = normalizeUsername(input.username);
  if (!USERNAME_PATTERN.test(username)) {
    throw badRequest("Usuário deve ter 3 a 40 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado");
  }
  const name = validateName(input.name);
  validatePassword(input.password);
  const role = validateRole(input.role);
  const unit = validateUnit(input.unit);

  if (await getUserByUsername(username)) {
    throw new TRPCError({ code: "CONFLICT", message: "Já existe um usuário com esse nome de usuário" });
  }

  return insertUser({
    username,
    name,
    passwordHash: hashPassword(input.password),
    role,
    unit,
    canEditPrices: role === "vendedor" ? Boolean(input.canEditPrices) : false,
    extraCaps: role === "vendedor" ? sanitizeExtraCaps(input.extraCaps) : [],
    active: true,
  });
}

async function countActiveOwners(): Promise<number> {
  const users = await listUsers();
  return users.filter((u) => u.active && u.role === "dono").length;
}

export async function updateUser(
  actor: SessionUser,
  id: number,
  patch: UpdateUserPatch,
): Promise<AdminUserRecord> {
  const current = await getUserById(id);
  if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });

  const next: AdminUserRecord = { ...current };
  if (patch.name !== undefined) next.name = validateName(patch.name);
  if (patch.role !== undefined) next.role = validateRole(patch.role);
  if (patch.unit !== undefined) next.unit = validateUnit(patch.unit);
  if (patch.canEditPrices !== undefined) next.canEditPrices = Boolean(patch.canEditPrices);
  if (patch.extraCaps !== undefined) next.extraCaps = sanitizeExtraCaps(patch.extraCaps);
  if (patch.active !== undefined) next.active = Boolean(patch.active);
  if (next.role === "dono") {
    next.canEditPrices = false;
    next.extraCaps = [];
  }

  const isSelf = actor.id === current.id;
  if (isSelf && current.active && !next.active) {
    throw badRequest("Você não pode desativar a si mesmo");
  }
  if (isSelf && current.role === "dono" && next.role !== "dono") {
    throw badRequest("Você não pode rebaixar a si mesmo");
  }

  const losesOwner = current.active && current.role === "dono" && (!next.active || next.role !== "dono");
  if (losesOwner && (await countActiveOwners()) <= 1) {
    throw badRequest("Deve existir pelo menos um dono ativo");
  }

  if (isMemoryMode()) {
    const idx = memoryUsers.findIndex((u) => u.id === id);
    memoryUsers[idx] = { ...memoryUsers[idx], ...next };
    return clone(memoryUsers[idx]);
  }

  await (await db())
    .update(adminUsers)
    .set({
      name: next.name,
      role: next.role,
      unit: next.unit,
      canEditPrices: next.canEditPrices,
      extraCaps: next.extraCaps?.length ? JSON.stringify(next.extraCaps) : null,
      active: next.active,
    })
    .where(eq(adminUsers.id, id));
  return (await getUserById(id)) ?? next;
}

export async function setUserPassword(
  id: number,
  password: string,
  options: { revokeSessions?: boolean } = {},
): Promise<void> {
  validatePassword(password);
  const current = await getUserById(id);
  if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
  const passwordHash = hashPassword(password);
  const sessionsValidAfter = options.revokeSessions ? new Date() : undefined;
  if (isMemoryMode()) {
    const record = memoryUsers.find((u) => u.id === id);
    if (record) {
      record.passwordHash = passwordHash;
      if (sessionsValidAfter) record.sessionsValidAfter = sessionsValidAfter;
    }
    return;
  }
  await (await db())
    .update(adminUsers)
    .set(sessionsValidAfter ? { passwordHash, sessionsValidAfter } : { passwordHash })
    .where(eq(adminUsers.id, id));
}

/** Encerra as sessões abertas do usuário: tokens emitidos até agora deixam de valer. */
export async function revokeUserSessions(id: number): Promise<void> {
  const current = await getUserById(id);
  if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
  const now = new Date();
  if (isMemoryMode()) {
    const record = memoryUsers.find((u) => u.id === id);
    if (record) record.sessionsValidAfter = now;
    return;
  }
  await (await db()).update(adminUsers).set({ sessionsValidAfter: now }).where(eq(adminUsers.id, id));
}

export async function touchLastLogin(id: number): Promise<void> {
  const now = new Date();
  if (isMemoryMode()) {
    const record = memoryUsers.find((u) => u.id === id);
    if (record) record.lastLoginAt = now;
    return;
  }
  await (await db()).update(adminUsers).set({ lastLoginAt: now }).where(eq(adminUsers.id, id));
}

// ===== Bootstrap (spec §2.2) =====
let bootstrapPromise: Promise<void> | null = null;

async function runBootstrap(): Promise<void> {
  const users = await listUsers();
  if (users.length > 0) return;

  const stored = (await getSingleSetting(SETTING_KEYS.adminPassword)).trim();
  const fallback = (DEFAULT_SETTINGS[SETTING_KEYS.adminPassword] || "lojinha123").trim();
  const source = stored || fallback;
  const passwordHash = source.startsWith("scrypt:") ? source : hashPassword(source);

  try {
    await insertUser({
      username: "dono",
      name: "Dono",
      passwordHash,
      role: "dono",
      unit: null,
      canEditPrices: false,
      active: true,
    });
    console.info("[Admin] Usuário inicial \"dono\" criado a partir da senha de administrador existente.");
  } catch (err) {
    // Outra instância pode ter criado o dono ao mesmo tempo
    if (err instanceof TRPCError && err.code === "CONFLICT") return;
    throw err;
  }
}

/** Cria o usuário `dono` a partir da senha antiga (`admin_password`) quando não há nenhum usuário. */
export async function ensureBootstrapOwner(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = runBootstrap().catch((err) => {
      bootstrapPromise = null;
      throw err;
    });
  }
  await bootstrapPromise;
}
