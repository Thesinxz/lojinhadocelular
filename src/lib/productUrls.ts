export function slugifyProductTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function createProductShareSlug(title: string, productId: string | number): string {
  const id = String(productId).trim();
  const shortId = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)
    ? id.slice(0, 8)
    : `id-${id}`;
  const titleSlug = slugifyProductTitle(title) || "produto";
  return `${titleSlug}-${shortId}`;
}

export function extractProductIdFromShareSlug(value: string): string | null {
  const numericId = value.match(/-id-(\d+)$/i);
  if (numericId) return numericId[1];

  const uuidPrefix = value.match(/-([\da-f]{8})$/i);
  return uuidPrefix?.[1] ?? null;
}

export function extractProductUuidPrefixFromShareSlug(value: string): string | null {
  if (/-id-\d+$/i.test(value)) return null;
  return value.match(/-([\da-f]{8})$/i)?.[1] ?? null;
}
