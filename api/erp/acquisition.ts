/**
 * Entrada de celular seminovo no ERP (compra de cliente), a partir de uma troca concluída no painel.
 * Valores em REAIS no ERP (o painel guarda centavos).
 */
import { z } from "zod";
import { isValidCep, isValidCpfOrCnpj, isValidImei, onlyDigits } from "@contracts/brDocs";
import { erpRequest, resolveErpUnitId, ErpApiError } from "./client";

export const GRADES = ["A+", "A", "B", "C"] as const;

const text = (max: number) => z.string().trim().max(max);

export const acquisitionInputSchema = z
  .object({
    brandName: text(60).min(1, "Informe a marca"),
    modelName: text(120).min(1, "Informe o modelo"),
    imei1: z.string().refine(isValidImei, "IMEI 1 inválido (15 dígitos)"),
    imei2: z.string().optional().default("").refine((v) => !v || isValidImei(v), "IMEI 2 inválido (15 dígitos)"),
    cor: text(60).min(1, "Informe a cor"),
    capacidade: text(20).min(1, "Informe a capacidade"),
    batteryHealth: z.number().int("Bateria deve ser um número inteiro").min(0, "Bateria de 0 a 100").max(100, "Bateria de 0 a 100"),
    grade: z.enum(GRADES),
    /** Centavos pagos ao cliente. */
    costCents: z.number().int().min(0).max(100_000_000),
    /** Centavos do preço de venda do aparelho. */
    saleCents: z.number().int().min(1, "Informe o preço de venda").max(100_000_000),
    observacoes: text(500).optional().default(""),
    necessitaReparo: z.boolean(),
    emitirNfe: z.boolean(),
    /** Resultado que a pessoa conferiu no portal oficial da ANATEL (obrigatório se o ERP não consultar sozinho). */
    anatelManual: z.enum(["REGULAR", "NAO_CONSTA", "IMPEDIDO"]).optional(),
    cliente: z.object({
      nome: text(120).min(3, "Informe o nome completo"),
      cpfCnpj: z.string().refine(isValidCpfOrCnpj, "CPF/CNPJ inválido"),
      telefone: text(30).optional().default(""),
      email: text(120).optional().default(""),
      endereco: z.object({
        cep: z.string().refine(isValidCep, "CEP inválido"),
        logradouro: text(120).min(1, "Informe a rua"),
        numero: text(20).min(1, "Informe o número"),
        complemento: text(60).optional().default(""),
        bairro: text(80).min(1, "Informe o bairro"),
        codigoMunicipio: text(10).min(7, "Código IBGE do município inválido"),
        nomeMunicipio: text(80).min(1, "Informe a cidade"),
        uf: z.string().trim().length(2, "UF com 2 letras"),
      }),
    }),
  })
  .refine((v) => !v.imei2 || onlyDigits(v.imei2) !== onlyDigits(v.imei1), {
    message: "IMEI 2 não pode ser igual ao IMEI 1",
    path: ["imei2"],
  });

export type AcquisitionInput = z.infer<typeof acquisitionInputSchema>;

const reais = (cents: number) => Math.round(cents) / 100;

/** Chaves que o ERP aceita em `celular.anatelResult` (ele rejeita qualquer chave extra). */
const ANATEL_KEYS = [
  "status",
  "origem",
  "isBlacklistedLocal",
  "blacklistMotivo",
  "brand",
  "model",
  "consultadoAnatel",
  "success",
  "isValid",
  "pdfUrl",
  "consultaOficialUrl",
  "verificacaoManual",
] as const;

type AnatelResult = Partial<Record<(typeof ANATEL_KEYS)[number], unknown>>;

function unwrap(body: unknown): Record<string, unknown> {
  const root = (body ?? {}) as Record<string, unknown>;
  const data = root.data;
  return data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : root;
}

const BLOCKED_STATUS = /IMPEDIDO|ROUBADO|FURTADO|BLOQUEADO/i;

/**
 * Consulta o IMEI no ERP (validação, lista de bloqueados da loja e ANATEL quando ativa) e
 * recusa aparelho impedido. O ERP espera que quem chama faça essa consulta e repasse o resultado.
 */
export async function checkImeiForEntry(imei: string, manual?: AcquisitionInput["anatelManual"]): Promise<AnatelResult> {
  const raw = unwrap(await erpRequest("/api/tools/imei/consultar", { method: "POST", body: { imei: onlyDigits(imei) } }));
  const status = String(raw.status ?? "");

  if (raw.isBlacklistedLocal === true || BLOCKED_STATUS.test(status) || manual === "IMPEDIDO") {
    throw new ErpApiError(`IMEI impedido ou bloqueado${raw.blacklistMotivo ? ` (${String(raw.blacklistMotivo)})` : ""}. Não dê entrada neste aparelho.`, 400);
  }
  if (raw.isValid === false) {
    throw new ErpApiError("IMEI inválido (dígito verificador). Confira o número.", 400);
  }
  if (raw.consultadoAnatel !== true && !manual) {
    const url = raw.consultaOficialUrl ? ` Portal: ${String(raw.consultaOficialUrl)}` : "";
    throw new ErpApiError(`O IMEI ainda não foi verificado na ANATEL. Consulte o portal oficial e informe o resultado no formulário.${url}`, 400);
  }

  const result: AnatelResult = {};
  for (const key of ANATEL_KEYS) if (raw[key] !== undefined && raw[key] !== null) result[key] = raw[key];
  if (manual) result.verificacaoManual = manual;
  return result;
}

export function buildEntradaSeminovoPayload(input: AcquisitionInput, unidadeId: string, anatelResult?: AnatelResult) {
  // anatelManual é só do nosso formulário; no ERP vai dentro de celular.anatelResult.verificacaoManual.
  const { cliente, anatelManual: _anatelManual, ...device } = input;
  const e = cliente.endereco;
  return {
    unidadeId,
    cliente: {
      nome: cliente.nome,
      cpfCnpj: cliente.cpfCnpj,
      ...(cliente.telefone ? { telefone: cliente.telefone } : {}),
      ...(cliente.email ? { email: cliente.email } : {}),
      endereco: {
        logradouro: e.logradouro,
        numero: e.numero,
        ...(e.complemento ? { complemento: e.complemento } : {}),
        bairro: e.bairro,
        cep: onlyDigits(e.cep),
        codigoMunicipio: e.codigoMunicipio,
        nomeMunicipio: e.nomeMunicipio,
        uf: e.uf.toUpperCase(),
      },
    },
    celular: {
      brandName: device.brandName,
      modelName: device.modelName,
      imei1: onlyDigits(device.imei1),
      ...(device.imei2 ? { imei2: onlyDigits(device.imei2) } : {}),
      cor: device.cor,
      capacidade: device.capacidade,
      battery_health: device.batteryHealth,
      grade: device.grade,
      valorCusto: reais(device.costCents),
      valorVenda: reais(device.saleCents),
      ...(device.observacoes ? { observacoes: device.observacoes } : {}),
      ...(anatelResult ? { anatelResult } : {}),
    },
    necessitaReparo: device.necessitaReparo,
    emitirNfe: device.emitirNfe,
  };
}

/** O Swagger não descreve a resposta: procura o ID do produto criado nos formatos usuais. */
export function extractCreatedId(body: unknown): string | null {
  const candidates: unknown[] = [];
  const root = body as Record<string, unknown> | null;
  if (root && typeof root === "object") {
    const data = root.data as Record<string, unknown> | undefined;
    candidates.push(root.id, data?.id, (data?.product as Record<string, unknown> | undefined)?.id, (root.product as Record<string, unknown> | undefined)?.id, (root.produto as Record<string, unknown> | undefined)?.id, (data?.produto as Record<string, unknown> | undefined)?.id);
  }
  const found = candidates.find((c) => (typeof c === "string" && c) || typeof c === "number");
  return found === undefined ? null : String(found);
}

export interface AcquisitionResult {
  erpProductId: string | null;
}

export async function createSeminovoEntry(
  input: AcquisitionInput,
  unit: "jardim" | "gll",
): Promise<AcquisitionResult> {
  const unidadeId = await resolveErpUnitId(unit);
  if (!unidadeId) {
    throw new ErpApiError("Não encontrei a unidade correspondente no ERP. Defina ERP_UNIT_ID_JARDIM / ERP_UNIT_ID_GLL.");
  }
  const anatelResult = await checkImeiForEntry(input.imei1, input.anatelManual);
  const body = await erpRequest("/api/products/entrada-seminovo", {
    method: "POST",
    body: buildEntradaSeminovoPayload(input, unidadeId, anatelResult),
  });
  return { erpProductId: extractCreatedId(body) };
}
