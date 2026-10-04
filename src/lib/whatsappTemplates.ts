/**
 * Mensagens prontas de WhatsApp do atendimento (Troca Fácil).
 * Funções puras, usadas no painel e testadas a partir de `api/`.
 */
import { DEFAULT_WHATSAPP_TEMPLATES, formatBRL, type WhatsappTemplate } from "@contracts/types";
import { STORE_UNITS } from "@contracts/permissions";

export { DEFAULT_WHATSAPP_TEMPLATES } from "@contracts/types";
export type { WhatsappTemplate } from "@contracts/types";

export type TemplateVarName = "nome" | "modelo" | "loja" | "endereco" | "vendedor" | "valor_oferecido";
export type TemplateVars = Partial<Record<TemplateVarName, string>>;

const KNOWN_VARS: readonly TemplateVarName[] = [
  "nome",
  "modelo",
  "loja",
  "endereco",
  "vendedor",
  "valor_oferecido",
];

/** Lê o JSON salvo nas configurações; inválido/vazio → modelos padrão. */
export function parseTemplates(raw: string | undefined | null): WhatsappTemplate[] {
  if (!raw) return DEFAULT_WHATSAPP_TEMPLATES;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return DEFAULT_WHATSAPP_TEMPLATES;
  }
  if (!Array.isArray(data)) return DEFAULT_WHATSAPP_TEMPLATES;
  const templates: WhatsappTemplate[] = [];
  data.forEach((item, idx) => {
    if (!item || typeof item !== "object") return;
    const { id, label, body } = item as Record<string, unknown>;
    if (typeof label !== "string" || !label.trim()) return;
    if (typeof body !== "string" || !body.trim()) return;
    templates.push({
      id: typeof id === "string" && id.trim() ? id.trim() : `tpl-${idx + 1}`,
      label: label.trim(),
      body,
    });
  });
  return templates.length ? templates : DEFAULT_WHATSAPP_TEMPLATES;
}

/** Substitui `{placeholder}`; conhecidos sem valor viram "", desconhecidos ficam como estão. */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{([a-z_]+)\}/g, (match, name: string) => {
    if (!(KNOWN_VARS as readonly string[]).includes(name)) return match;
    return vars[name as TemplateVarName] ?? "";
  });
}

/** Link wa.me com o número normalizado para 55 + DDD + número. */
export function buildWhatsappLink(phone: string, text: string): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits && !digits.startsWith("55")) digits = `55${digits}`;
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

export interface TemplateContext {
  evaluation: {
    name: string;
    model: string;
    storage?: string | null;
    unit?: string | null;
    offeredValue?: number | null;
  };
  sellerName: string;
  addresses: { jardim: string; gll: string };
}

/** Variáveis dos modelos a partir da avaliação, do atendente e das configurações da loja. */
export function buildTemplateVars({ evaluation, sellerName, addresses }: TemplateContext): Required<TemplateVars> {
  const unit = evaluation.unit === "jardim" || evaluation.unit === "gll" ? evaluation.unit : null;
  const firstName = String(evaluation.name || "").trim().split(/\s+/)[0] ?? "";
  const model = [evaluation.model, evaluation.storage].map((v) => String(v ?? "").trim()).filter(Boolean).join(" ");
  return {
    nome: firstName,
    modelo: model,
    loja: unit ? (STORE_UNITS.find((u) => u.value === unit)?.label ?? "") : "",
    endereco: unit ? addresses[unit] || "" : "",
    vendedor: sellerName.trim(),
    valor_oferecido:
      typeof evaluation.offeredValue === "number" ? formatBRL(evaluation.offeredValue).replace(/\u00a0/g, " ") : "",
  };
}
