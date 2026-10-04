/**
 * Pendências da vitrine (compartilhado entre o dashboard no servidor e o filtro da tela de produtos).
 */
export interface IssueItem {
  id: string;
  name: string;
}

export interface CatalogIssues {
  noPhoto: IssueItem[];
  noBattery: IssueItem[];
  soldOutVisible: IssueItem[];
}

export interface CatalogIssueVariant {
  imageUrl?: string | null;
  batteryHealth?: string | null;
  available: boolean;
  quantity?: number | null;
}

export interface CatalogIssueProduct {
  id: string | number;
  name: string;
  category: string;
  condition: string;
  active: boolean;
  imageUrl?: string | null;
  batteryHealth?: string | null;
  variants: CatalogIssueVariant[];
}

const filled = (v: string | null | undefined) => typeof v === "string" && v.trim().length > 0;

function isSeminovo(p: CatalogIssueProduct): boolean {
  return p.category === "iphone_seminovo" || p.condition.toLowerCase().startsWith("seminovo");
}

/** Pendências da vitrine (somente produtos visíveis). */
export function computeCatalogIssues(products: CatalogIssueProduct[]): CatalogIssues {
  const issues: CatalogIssues = { noPhoto: [], noBattery: [], soldOutVisible: [] };
  for (const p of products) {
    if (!p.active) continue;
    const item = { id: String(p.id), name: p.name };
    const variants = p.variants ?? [];

    if (!filled(p.imageUrl) && !variants.some((v) => filled(v.imageUrl))) {
      issues.noPhoto.push(item);
    }

    if (isSeminovo(p) && !filled(p.batteryHealth)) {
      const sellable = variants.filter((v) => v.available);
      if (variants.length === 0 || sellable.some((v) => !filled(v.batteryHealth))) {
        issues.noBattery.push(item);
      }
    }

    if (variants.length > 0 && variants.every((v) => !v.available || (v.quantity ?? 1) <= 0)) {
      issues.soldOutVisible.push(item);
    }
  }
  return issues;
}
