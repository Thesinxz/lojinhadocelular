/**
 * Conferência do bônus de fidelidade: procura o cliente pelo CPF no ERP (Gestão Celular)
 * e vê se há compra anterior. O CPF só passa por aqui: nada dele é gravado, só o resultado.
 * O Swagger do ERP não tipa as respostas, então a leitura é tolerante a formatos diferentes.
 */
import { isValidCpf, onlyDigits } from "@contracts/brDocs";
import type { LoyaltyStatus } from "@contracts/loyalty";
import { ErpApiError, erpRequest, isErpServiceConfigured } from "./client";

export interface LoyaltyResult {
  status: LoyaltyStatus;
  note: string;
  erpCustomerId: string;
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Lista de clientes em formatos usuais: [..], {data:[..]}, {data:{items:[..]}}, {items|clientes|results:[..]}. */
export function extractList(body: unknown): Json[] {
  const candidates: unknown[] = [body];
  if (isObject(body)) {
    candidates.push(body.data, body.items, body.clientes, body.results, body.rows);
    // Formato real do ERP: { success, data: { data: [clientes], meta, summary } }
    if (isObject(body.data)) candidates.push(body.data.data, body.data.items, body.data.clientes, body.data.results, body.data.rows);
  }
  const list = candidates.find(Array.isArray) as unknown[] | undefined;
  return (list ?? []).filter(isObject);
}

function countOf(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

const CANCELLED = /cancel/i;

/** Conta vendas que valem como compra: vendas canceladas não contam. */
function countSales(value: unknown): number | null {
  if (!Array.isArray(value)) return countOf(value);
  return value.filter((sale) => !(isObject(sale) && CANCELLED.test(String(sale.status ?? "")))).length;
}

/**
 * Quantas vendas e OS aparecem no histórico do cliente (null = não deu para ler).
 * Formato real do ERP: { success, data: { service_orders: [...], sales: [...] } }.
 */
export function summarizeHistory(body: unknown): { sales: number | null; os: number | null } {
  const root = isObject(body) && (isObject(body.data) || Array.isArray(body.data)) ? body.data : body;

  if (Array.isArray(root)) {
    const items = root.filter(isObject);
    const kind = (item: Json) => String(item.tipo ?? item.type ?? item.origem ?? "").toLowerCase();
    return {
      sales: items.filter((i) => (kind(i).includes("venda") || kind(i).includes("sale")) && !CANCELLED.test(String(i.status ?? ""))).length,
      os: items.filter((i) => /^os$|ordem|servi/.test(kind(i))).length,
    };
  }
  if (!isObject(root)) return { sales: null, os: null };

  const keyFor = (re: RegExp) => Object.keys(root).find((k) => re.test(k));
  const salesKey = keyFor(/^(vendas?|sales|purchases|compras?)$|total_?vendas|vendas_?count/i);
  const osKey = keyFor(/^(os|ordens?|ordens_?servico|service_?orders?|servicos?)$|total_?os/i);
  return {
    sales: salesKey ? countSales(root[salesKey]) : null,
    os: osKey ? countOf(root[osKey]) : null,
  };
}

function formatCpf(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function documentOf(client: Json): string | null {
  const raw = client.cpf ?? client.cnpj ?? client.cpf_cnpj ?? client.cpfCnpj ?? client.documento;
  return typeof raw === "string" ? onlyDigits(raw) : null;
}

/**
 * Endpoint mínimo do ERP: GET /api/clientes/fidelidade → { found, customer_id?, completed_sales_count, last_sale_at? }.
 * Devolve `null` quando o ERP ainda não tem o endpoint (404) ou responde num formato desconhecido,
 * para o chamador usar a leitura antiga (lista de clientes + histórico).
 */
async function viaFidelityEndpoint(digits: string): Promise<LoyaltyResult | null> {
  let body: unknown;
  try {
    body = await erpRequest(`/api/clientes/fidelidade?cpf_cnpj=${encodeURIComponent(formatCpf(digits))}`);
  } catch (err) {
    if (err instanceof ErpApiError && err.status === 404) return null;
    throw err;
  }
  const root = isObject(body) && isObject(body.data) ? body.data : body;
  if (!isObject(root) || typeof root.found !== "boolean") return null;

  if (!root.found) return { status: "not_found", note: "Nenhum cadastro com esse CPF no ERP", erpCustomerId: "" };

  const sales = Number(root.completed_sales_count);
  const count = Number.isFinite(sales) && sales > 0 ? Math.trunc(sales) : 0;
  const parts = ["Cadastro encontrado", `${count} compra(s)`];
  if (typeof root.last_sale_at === "string") {
    const last = new Date(root.last_sale_at);
    if (!Number.isNaN(last.getTime())) {
      parts.push(`última em ${last.toLocaleDateString("pt-BR", { timeZone: "America/Campo_Grande" })}`);
    }
  }
  return {
    status: count > 0 ? "verified" : "found",
    note: parts.join(" · ").slice(0, 200),
    erpCustomerId: String(root.customer_id ?? "").slice(0, 80),
  };
}

export async function lookupLoyaltyByCpf(cpfRaw: string): Promise<LoyaltyResult> {
  const unavailable = (note: string): LoyaltyResult => ({ status: "unavailable", note: note.slice(0, 200), erpCustomerId: "" });
  const digits = onlyDigits(cpfRaw);
  if (!isValidCpf(digits)) return unavailable("CPF inválido");
  if (!isErpServiceConfigured()) return unavailable("Usuário de serviço do ERP não configurado");

  try {
    const fast = await viaFidelityEndpoint(digits);
    if (fast) return fast;

    let clients: Json[] = [];
    // O ERP pode guardar o CPF com ou sem máscara: tenta os dois formatos.
    for (const term of [formatCpf(digits), digits]) {
      clients = extractList(await erpRequest(`/api/clientes?cpf_cnpj=${encodeURIComponent(term)}&limit=5`));
      clients = clients.filter((c) => {
        const doc = documentOf(c);
        return doc === null || doc === digits;
      });
      if (clients.length) break;
    }
    if (!clients.length) return { status: "not_found", note: "Nenhum cadastro com esse CPF no ERP", erpCustomerId: "" };

    const client = clients[0];
    const id = String(client.id ?? "");
    if (!id) return unavailable("O ERP devolveu um cliente sem identificador");

    let history: { sales: number | null; os: number | null } = { sales: null, os: null };
    try {
      history = summarizeHistory(await erpRequest(`/api/clientes/${encodeURIComponent(id)}/historico-atendimento`));
    } catch {
      // Sem histórico legível: usa a contagem que já vem na lista de clientes.
    }
    if (history.sales === null && isObject(client._count)) history.sales = countOf(client._count.sales);

    const parts = ["Cadastro encontrado"];
    if (history.sales !== null) parts.push(`${history.sales} compra(s)`);
    if (history.os !== null) parts.push(`${history.os} OS`);
    if (history.sales === null) parts.push("histórico não pôde ser lido, confira no ERP");
    return {
      status: history.sales !== null && history.sales > 0 ? "verified" : "found",
      note: parts.join(" · ").slice(0, 200),
      erpCustomerId: id.slice(0, 80),
    };
  } catch (err) {
    return unavailable(err instanceof ErpApiError || err instanceof Error ? err.message : "Erro ao consultar o ERP");
  }
}
