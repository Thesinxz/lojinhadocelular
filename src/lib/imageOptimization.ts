/**
 * Utilitários puros para seleção de variantes responsivas e otimização de URLs
 * de imagens locais (`/images/iphones/*.webp`), Cloudflare R2 e externas.
 */

const LOCAL_OR_R2_IPHONE_RE = /^(https?:\/\/[^?#]+\/images\/iphones\/|\/images\/iphones\/)([^/?#]+?)(-360w)?(\.webp)([?#].*)?$/i;

function isOwnOrR2IphoneAsset(url: string): boolean {
  const match = url.match(LOCAL_OR_R2_IPHONE_RE);
  if (!match) return false;
  const prefix = match[1];
  if (prefix.startsWith("/")) return true;

  const r2Env =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_CLOUDFLARE_R2_URL
      : undefined;
  if (r2Env && url.startsWith(r2Env.replace(/\/+$/, ""))) {
    return true;
  }

  return (
    /^https:\/\/[^/]*r2\.dev\//i.test(url) ||
    /^https:\/\/cdn\.lojinhadocelular\.com\//i.test(url)
  );
}

function formatOwnIphoneVariantUrl(url: string, compact: boolean): string | null {
  const match = url.match(LOCAL_OR_R2_IPHONE_RE);
  if (!match) return null;
  const [, prefix, baseName, , ext, suffix = ""] = match;
  return `${prefix}${baseName}${compact ? "-360w" : ""}${ext}${suffix}`;
}

/**
 * Normaliza URLs de imagem para a largura desejada:
 * - Imagens locais/R2 `/images/iphones/*.webp` usam variante pré-gerada `-360w.webp` quando `width <= 400`.
 * - Outras imagens locais, data URIs e domínios `.br` (que bloqueiam proxy) mantêm a URL original.
 * - Demais URLs externas usam `wsrv.nl` como proxy de borda.
 */
export function optimizeImageUrl(
  url: string | null | undefined,
  width = 360,
  quality = 75,
): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (isOwnOrR2IphoneAsset(trimmed)) {
    return formatOwnIphoneVariantUrl(trimmed, width <= 400) ?? trimmed;
  }

  if (trimmed.startsWith("/") || trimmed.startsWith("data:")) return trimmed;

  if (
    trimmed.includes("gestaocelular.com.br") ||
    trimmed.includes(".br/") ||
    trimmed.includes("wsrv.nl")
  ) {
    return trimmed;
  }

  // Recorte cirúrgico para imagens oficiais da Apple que possuem caixas 16:9 ou margens vazias
  let cropParams = "";
  if (trimmed.includes("finish-select")) {
    cropParams = "&precrop&cx=340&cy=300&cw=320&ch=380";
  } else if (trimmed.includes("MHXH3")) {
    cropParams = "&precrop&cx=200&cy=80&cw=600&ch=650";
  }

  return `https://wsrv.nl/?url=${encodeURIComponent(trimmed)}${cropParams}&w=${width}&output=webp&q=${quality}&il&af&n=-1`;
}

/**
 * Gera `srcSet` responsivo real para imagens locais/R2 (`360w` e `612w`)
 * e para URLs externas otimizadas via `wsrv.nl`.
 */
export function getImageSrcSet(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  if (isOwnOrR2IphoneAsset(trimmed)) {
    const w360 = formatOwnIphoneVariantUrl(trimmed, true);
    const wFull = formatOwnIphoneVariantUrl(trimmed, false);
    if (!w360 || !wFull) return undefined;
    return `${w360} 360w, ${wFull} 612w`;
  }

  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:") ||
    trimmed.includes("gestaocelular.com.br") ||
    trimmed.includes(".br/") ||
    trimmed.includes("wsrv.nl")
  ) {
    return undefined;
  }

  const w320 = optimizeImageUrl(trimmed, 320, 75);
  const w480 = optimizeImageUrl(trimmed, 480, 75);
  const w640 = optimizeImageUrl(trimmed, 640, 75);

  return `${w320} 320w, ${w480} 480w, ${w640} 640w`;
}
