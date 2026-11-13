import { normalizeSearchText, sliceVitrineBatch } from "./vitrineFilters";

export const ADMIN_PRODUCTS_BATCH_SIZE = 24;

export type AdminProductStatusFilter =
  | "todos"
  | "visiveis"
  | "ocultos"
  | "destaques";

export interface AdminProductVariantLike {
  sku?: string | null;
  storage?: string | null;
}

export interface AdminProductLike {
  id: string | number;
  externalId?: string | null;
  name: string;
  category: string;
  active?: boolean;
  featured?: boolean;
  variants: AdminProductVariantLike[];
}

export interface AdminProductCounts {
  all: number;
  visible: number;
  hidden: number;
  featured: number;
}

export function sliceAdminBatch<T>(
  items: readonly T[],
  visibleCount: number,
): T[] {
  return sliceVitrineBatch(items, visibleCount);
}

export function filterAdminProducts<T extends AdminProductLike>(
  products: readonly T[],
  options: {
    issueIds?: ReadonlySet<string> | null;
    statusFilter: AdminProductStatusFilter;
    search: string;
  },
): { filtered: T[]; counts: AdminProductCounts } {
  let visible = 0;
  let hidden = 0;
  let featured = 0;

  for (const p of products) {
    if (p.active !== false) visible += 1;
    else hidden += 1;
    if (p.featured) featured += 1;
  }

  const term = normalizeSearchText(options.search);
  const filtered = products.filter((p) => {
    if (options.issueIds && !options.issueIds.has(String(p.id))) return false;
    if (options.statusFilter === "visiveis" && p.active === false) return false;
    if (options.statusFilter === "ocultos" && p.active !== false) return false;
    if (options.statusFilter === "destaques" && !p.featured) return false;

    if (term) {
      const matchName = normalizeSearchText(p.name).includes(term);
      const matchCategory = normalizeSearchText(p.category).includes(term);
      const matchVariant = p.variants.some(
        (v) =>
          normalizeSearchText(v.sku || "").includes(term) ||
          normalizeSearchText(v.storage || "").includes(term),
      );
      return matchName || matchCategory || matchVariant;
    }
    return true;
  });

  return {
    filtered,
    counts: {
      all: products.length,
      visible,
      hidden,
      featured,
    },
  };
}

function matchesProductKey(
  product: Pick<AdminProductLike, "id" | "externalId">,
  targetKey: string,
): boolean {
  return (
    String(product.id) === targetKey ||
    (product.externalId != null && String(product.externalId) === targetKey)
  );
}

export function applyOptimisticProductToggle<
  T extends Pick<AdminProductLike, "id" | "externalId" | "active" | "featured">,
>(
  products: readonly T[] | undefined,
  targetId: string | number,
  patch: { active?: boolean; featured?: boolean },
): T[] {
  if (!products) return [];
  const key = String(targetId);
  return products.map((p) => {
    if (!matchesProductKey(p, key)) return p;
    return {
      ...p,
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
    };
  });
}

export function applyOptimisticBulkProducts<
  T extends Pick<AdminProductLike, "id" | "externalId" | "active" | "featured">,
>(
  products: readonly T[] | undefined,
  targetIds: readonly (string | number)[],
  patch: { active?: boolean; featured?: boolean },
): T[] {
  if (!products) return [];
  const targetSet = new Set(targetIds.map(String));
  return products.map((p) => {
    const idStr = String(p.id);
    const extStr = p.externalId != null ? String(p.externalId) : null;
    if (!targetSet.has(idStr) && !(extStr && targetSet.has(extStr))) return p;
    return {
      ...p,
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.featured !== undefined ? { featured: patch.featured } : {}),
    };
  });
}

export interface EvaluationPageLike<TItem> {
  items: TItem[];
  total: number;
  hasMore: boolean;
}

export function applyOptimisticEvaluationClaim<
  TItem extends {
    id: number;
    assignedUserId: number | null;
    assignedUserName: string | null;
    status: string;
  },
  TPage extends EvaluationPageLike<TItem>,
>(
  pageData: TPage | undefined,
  evaluationId: number,
  user: { id: number; name: string },
): TPage | undefined {
  if (!pageData) return pageData;
  return {
    ...pageData,
    items: pageData.items.map((item) => {
      if (item.id !== evaluationId) return item;
      return {
        ...item,
        assignedUserId: user.id,
        assignedUserName: user.name,
        status: item.status === "pendente" ? "atendimento" : item.status,
      };
    }),
  };
}

export function applyOptimisticEvaluationDetailPatch<
  TEval extends {
    status: string;
    unit: string;
    assignedUserId: number | null;
    assignedUserName: string | null;
  },
  TDetail extends { evaluation: TEval },
>(
  detailData: TDetail | undefined,
  patch: Partial<Pick<TEval, "status" | "unit" | "assignedUserId" | "assignedUserName">>,
): TDetail | undefined {
  if (!detailData) return detailData;
  return {
    ...detailData,
    evaluation: {
      ...detailData.evaluation,
      ...patch,
    },
  };
}
