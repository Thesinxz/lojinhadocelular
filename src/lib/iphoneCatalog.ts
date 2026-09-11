export type IphoneColorSpec = {
  name: string;
  hex: string;
  imageUrl?: string;
};

export type IphoneModelSpec = {
  name: string;
  year: number;
  screen: string;
  capacities: string[];
  colors: IphoneColorSpec[];
  defaultImageUrl?: string;
};

export function resolveIphoneImageUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return "";
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  let clean = pathOrUrl.startsWith("/") ? pathOrUrl : "/" + pathOrUrl;

  // Usa WebP ultra-otimizado (~25KB vs ~350KB PNG)
  if (clean.includes("/images/iphones/") && clean.endsWith(".png")) {
    clean = clean.replace(/\.png$/, ".webp");
  }

  // 1. Suporte a Cloudflare R2 / S3 custom endpoint via variável de ambiente (Vite e Node)
  const r2BaseUrl =
    (typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_CLOUDFLARE_R2_URL) ||
    (typeof process !== "undefined" && process.env?.CLOUDFLARE_R2_URL) ||
    (typeof process !== "undefined" && process.env?.VITE_CLOUDFLARE_R2_URL) ||
    "";

  if (r2BaseUrl) {
    const baseClean = r2BaseUrl.endsWith("/") ? r2BaseUrl.slice(0, -1) : r2BaseUrl;
    return `${baseClean}${clean}`;
  }

  return clean;
}

export const IPHONE_CATALOG: IphoneModelSpec[] = [
  // ===== 2026 =====
  {
    name: "iPhone 17e",
    year: 2026,
    screen: "6.1\"",
    capacities: ["256GB", "512GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-17e-black.webp" },
      { name: "White", hex: "#f5f5f7", imageUrl: "/images/iphones/iphone-17e-white.webp" },
      { name: "Soft Pink", hex: "#faddd7", imageUrl: "/images/iphones/iphone-17e-pink.webp" },
    ],
  },

  // ===== 2025 =====
  {
    name: "iPhone 17 Pro Max",
    year: 2025,
    screen: "6.9\"",
    capacities: ["256GB", "512GB", "1TB", "2TB"],
    colors: [
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-17-pro-max-silver.webp" },
      { name: "Cosmic Orange", hex: "#ff6f3c", imageUrl: "/images/iphones/iphone-17-pro-max-cosmic-orange.webp" },
      { name: "Deep Blue", hex: "#1a365d", imageUrl: "/images/iphones/iphone-17-pro-max-deep-blue.webp" },
    ],
  },
  {
    name: "iPhone 17 Pro",
    year: 2025,
    screen: "6.3\"",
    capacities: ["256GB", "512GB", "1TB"],
    colors: [
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-17-pro-silver.webp" },
      { name: "Cosmic Orange", hex: "#ff6f3c", imageUrl: "/images/iphones/iphone-17-pro-cosmic-orange.webp" },
      { name: "Deep Blue", hex: "#1a365d", imageUrl: "/images/iphones/iphone-17-pro-deep-blue.webp" },
    ],
  },
  {
    name: "iPhone 17",
    year: 2025,
    screen: "6.3\"",
    capacities: ["256GB", "512GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-17-black.webp" },
      { name: "White", hex: "#f5f5f7", imageUrl: "/images/iphones/iphone-17-white.webp" },
      { name: "Mist Blue", hex: "#9bb7d4", imageUrl: "/images/iphones/iphone-17-mist-blue.webp" },
      { name: "Sage", hex: "#9caf88", imageUrl: "/images/iphones/iphone-17-sage.webp" },
      { name: "Lavender", hex: "#b8a9c9", imageUrl: "/images/iphones/iphone-17-lavender.webp" },
    ],
  },
  {
    name: "iPhone Air",
    year: 2025,
    screen: "6.5\"",
    capacities: ["256GB", "512GB", "1TB"],
    colors: [
      { name: "Space Black", hex: "#2e2c2e", imageUrl: "/images/iphones/iphone-air-space-black.webp" },
      { name: "Cloud White", hex: "#f7f7f7", imageUrl: "/images/iphones/iphone-air-cloud-white.webp" },
      { name: "Light Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-air-light-gold.webp" },
      { name: "Sky Blue", hex: "#7eb0d5", imageUrl: "/images/iphones/iphone-air-sky-blue.webp" },
    ],
  },
  {
    name: "iPhone 16e",
    year: 2025,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-16e-black.webp" },
      { name: "White", hex: "#f5f5f7", imageUrl: "/images/iphones/iphone-16e-white.webp" },
    ],
  },

  // ===== 2024 =====
  {
    name: "iPhone 16 Pro Max",
    year: 2024,
    screen: "6.9\"",
    capacities: ["256GB", "512GB", "1TB"],
    colors: [
      { name: "Natural Titanium", hex: "#bebaa7", imageUrl: "/images/iphones/iphone-16-pro-max-natural-titanium.webp" },
      { name: "Black Titanium", hex: "#3c3b37", imageUrl: "/images/iphones/iphone-16-pro-max-black-titanium.webp" },
      { name: "White Titanium", hex: "#f2f1ed", imageUrl: "/images/iphones/iphone-16-pro-max-white-titanium.webp" },
      { name: "Desert Titanium", hex: "#c6aa91", imageUrl: "/images/iphones/iphone-16-pro-max-desert-titanium.webp" },
    ],
  },
  {
    name: "iPhone 16 Pro",
    year: 2024,
    screen: "6.3\"",
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Natural Titanium", hex: "#bebaa7", imageUrl: "/images/iphones/iphone-16-pro-natural-titanium.webp" },
      { name: "Black Titanium", hex: "#3c3b37", imageUrl: "/images/iphones/iphone-16-pro-black-titanium.webp" },
      { name: "White Titanium", hex: "#f2f1ed", imageUrl: "/images/iphones/iphone-16-pro-white-titanium.webp" },
      { name: "Desert Titanium", hex: "#c6aa91", imageUrl: "/images/iphones/iphone-16-pro-desert-titanium.webp" },
    ],
  },
  {
    name: "iPhone 16 Plus",
    year: 2024,
    screen: "6.7\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Ultramarine", hex: "#42506e", imageUrl: "/images/iphones/iphone-16-plus-ultramarine.webp" },
      { name: "Teal", hex: "#8ab4ac", imageUrl: "/images/iphones/iphone-16-plus-teal.webp" },
      { name: "Pink", hex: "#faddd7", imageUrl: "/images/iphones/iphone-16-plus-pink.webp" },
      { name: "White", hex: "#f7f7f7", imageUrl: "/images/iphones/iphone-16-plus-white.webp" },
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-16-plus-black.webp" },
    ],
  },
  {
    name: "iPhone 16",
    year: 2024,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Ultramarine", hex: "#42506e", imageUrl: "/images/iphones/iphone-16-ultramarine.webp" },
      { name: "Teal", hex: "#8ab4ac", imageUrl: "/images/iphones/iphone-16-teal.webp" },
      { name: "Pink", hex: "#faddd7", imageUrl: "/images/iphones/iphone-16-pink.webp" },
      { name: "White", hex: "#f7f7f7", imageUrl: "/images/iphones/iphone-16-white.webp" },
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-16-black.webp" },
    ],
  },

  // ===== 2023 =====
  {
    name: "iPhone 15 Pro Max",
    year: 2023,
    screen: "6.7\"",
    capacities: ["256GB", "512GB", "1TB"],
    colors: [
      { name: "Natural Titanium", hex: "#bebaa7", imageUrl: "/images/iphones/iphone-15-pro-max-natural-titanium.webp" },
      { name: "Blue Titanium", hex: "#3b4453", imageUrl: "/images/iphones/iphone-15-pro-max-blue-titanium.webp" },
      { name: "White Titanium", hex: "#f2f1ed", imageUrl: "/images/iphones/iphone-15-pro-max-white-titanium.webp" },
      { name: "Black Titanium", hex: "#3c3b37", imageUrl: "/images/iphones/iphone-15-pro-max-black-titanium.webp" },
    ],
  },
  {
    name: "iPhone 15 Pro",
    year: 2023,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Natural Titanium", hex: "#bebaa7", imageUrl: "/images/iphones/iphone-15-pro-natural-titanium.webp" },
      { name: "Blue Titanium", hex: "#3b4453", imageUrl: "/images/iphones/iphone-15-pro-blue-titanium.webp" },
      { name: "White Titanium", hex: "#f2f1ed", imageUrl: "/images/iphones/iphone-15-pro-white-titanium.webp" },
      { name: "Black Titanium", hex: "#3c3b37", imageUrl: "/images/iphones/iphone-15-pro-black-titanium.webp" },
    ],
  },
  {
    name: "iPhone 15 Plus",
    year: 2023,
    screen: "6.7\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Pink", hex: "#faddd7", imageUrl: "/images/iphones/iphone-15-plus-pink.webp" },
      { name: "Yellow", hex: "#f3e08c", imageUrl: "/images/iphones/iphone-15-plus-yellow.webp" },
      { name: "Green", hex: "#b4caa4", imageUrl: "/images/iphones/iphone-15-plus-green.webp" },
      { name: "Blue", hex: "#a7c1d9", imageUrl: "/images/iphones/iphone-15-plus-blue.webp" },
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-15-plus-black.webp" },
    ],
  },
  {
    name: "iPhone 15",
    year: 2023,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-15-black.webp" },
      { name: "Blue", hex: "#a7c1d9", imageUrl: "/images/iphones/iphone-15-blue.webp" },
      { name: "Green", hex: "#b4caa4", imageUrl: "/images/iphones/iphone-15-green.webp" },
      { name: "Yellow", hex: "#f3e08c", imageUrl: "/images/iphones/iphone-15-yellow.webp" },
      { name: "Pink", hex: "#faddd7", imageUrl: "/images/iphones/iphone-15-pink.webp" },
    ],
  },

  // ===== 2022 =====
  {
    name: "iPhone 14 Pro Max",
    year: 2022,
    screen: "6.7\"",
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Deep Purple", hex: "#483d8b", imageUrl: "/images/iphones/iphone-14-pro-max-deep-purple.webp" },
      { name: "Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-14-pro-max-gold.webp" },
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-14-pro-max-silver.webp" },
      { name: "Space Black", hex: "#2e2c2e", imageUrl: "/images/iphones/iphone-14-pro-max-space-black.webp" },
    ],
  },
  {
    name: "iPhone 14 Pro",
    year: 2022,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Deep Purple", hex: "#483d8b", imageUrl: "/images/iphones/iphone-14-pro-deep-purple.webp" },
      { name: "Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-14-pro-gold.webp" },
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-14-pro-silver.webp" },
      { name: "Space Black", hex: "#2e2c2e", imageUrl: "/images/iphones/iphone-14-pro-space-black.webp" },
    ],
  },
  {
    name: "iPhone 14 Plus",
    year: 2022,
    screen: "6.7\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Blue", hex: "#a7c1d9", imageUrl: "/images/iphones/iphone-14-plus-blue.webp" },
      { name: "Purple", hex: "#b5a7cb", imageUrl: "/images/iphones/iphone-14-plus-purple.webp" },
      { name: "Yellow", hex: "#f3e08c", imageUrl: "/images/iphones/iphone-14-plus-yellow.webp" },
      { name: "Midnight", hex: "#1b242d", imageUrl: "/images/iphones/iphone-14-plus-midnight.webp" },
      { name: "Starlight", hex: "#f0e9d7", imageUrl: "/images/iphones/iphone-14-plus-starlight.webp" },
      { name: "Product Red", hex: "#e30016", imageUrl: "/images/iphones/iphone-14-plus-red.webp" },
    ],
  },
  {
    name: "iPhone 14",
    year: 2022,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Blue", hex: "#a7c1d9", imageUrl: "/images/iphones/iphone-14-blue.webp" },
      { name: "Purple", hex: "#b5a7cb", imageUrl: "/images/iphones/iphone-14-purple.webp" },
      { name: "Yellow", hex: "#f3e08c", imageUrl: "/images/iphones/iphone-14-yellow.webp" },
      { name: "Midnight", hex: "#1b242d", imageUrl: "/images/iphones/iphone-14-midnight.webp" },
      { name: "Starlight", hex: "#f0e9d7", imageUrl: "/images/iphones/iphone-14-starlight.webp" },
      { name: "Product Red", hex: "#e30016", imageUrl: "/images/iphones/iphone-14-red.webp" },
    ],
  },
  {
    name: "iPhone SE (3ª geração)",
    year: 2022,
    screen: "4.7\"",
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Midnight", hex: "#1b242d", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-se-finish-select-202207-midnight?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Starlight", hex: "#f0e9d7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-se-finish-select-202207-starlight?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Product Red", hex: "#e30016", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-se-finish-select-202207-red?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },

  // ===== 2021 =====
  {
    name: "iPhone 13 Pro Max",
    year: 2021,
    screen: "6.7\"",
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Sierra Blue", hex: "#9bb0c1", imageUrl: "/images/iphones/iphone-13-pro-max-sierra-blue.webp" },
      { name: "Alpine Green", hex: "#475c4d", imageUrl: "/images/iphones/iphone-13-pro-max-alpine-green.webp" },
      { name: "Graphite", hex: "#545351", imageUrl: "/images/iphones/iphone-13-pro-max-graphite.webp" },
      { name: "Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-13-pro-max-gold.webp" },
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-13-pro-max-silver.webp" },
    ],
  },
  {
    name: "iPhone 13 Pro",
    year: 2021,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Sierra Blue", hex: "#9bb0c1", imageUrl: "/images/iphones/iphone-13-pro-sierra-blue.webp" },
      { name: "Alpine Green", hex: "#475c4d", imageUrl: "/images/iphones/iphone-13-pro-alpine-green.webp" },
      { name: "Graphite", hex: "#545351", imageUrl: "/images/iphones/iphone-13-pro-graphite.webp" },
      { name: "Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-13-pro-gold.webp" },
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-13-pro-silver.webp" },
    ],
  },
  {
    name: "iPhone 13",
    year: 2021,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Blue", hex: "#42506e", imageUrl: "/images/iphones/iphone-13-blue.webp" },
      { name: "Pink", hex: "#faddd7", imageUrl: "/images/iphones/iphone-13-pink.webp" },
      { name: "Midnight", hex: "#1b242d", imageUrl: "/images/iphones/iphone-13-midnight.webp" },
      { name: "Starlight", hex: "#f0e9d7", imageUrl: "/images/iphones/iphone-13-starlight.webp" },
      { name: "Green", hex: "#475c4d", imageUrl: "/images/iphones/iphone-13-green.webp" },
      { name: "Product Red", hex: "#e30016", imageUrl: "/images/iphones/iphone-13-red.webp" },
    ],
  },
  {
    name: "iPhone 13 mini",
    year: 2021,
    screen: "5.4\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Blue", hex: "#42506e", imageUrl: "/images/iphones/iphone-13-blue.webp" },
      { name: "Pink", hex: "#faddd7", imageUrl: "/images/iphones/iphone-13-pink.webp" },
      { name: "Midnight", hex: "#1b242d", imageUrl: "/images/iphones/iphone-13-midnight.webp" },
      { name: "Starlight", hex: "#f0e9d7", imageUrl: "/images/iphones/iphone-13-starlight.webp" },
      { name: "Green", hex: "#475c4d", imageUrl: "/images/iphones/iphone-13-green.webp" },
      { name: "Product Red", hex: "#e30016", imageUrl: "/images/iphones/iphone-13-red.webp" },
    ],
  },

  // ===== 2020 =====
  {
    name: "iPhone 12 Pro Max",
    year: 2020,
    screen: "6.7\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Pacific Blue", hex: "#2c4d5e", imageUrl: "/images/iphones/iphone-12-pro-max-pacific-blue.webp" },
      { name: "Graphite", hex: "#545351", imageUrl: "/images/iphones/iphone-12-pro-max-graphite.webp" },
      { name: "Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-12-pro-max-gold.webp" },
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-12-pro-max-silver.webp" },
    ],
  },
  {
    name: "iPhone 12 Pro",
    year: 2020,
    screen: "6.1\"",
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Pacific Blue", hex: "#2c4d5e", imageUrl: "/images/iphones/iphone-12-pro-pacific-blue.webp" },
      { name: "Graphite", hex: "#545351", imageUrl: "/images/iphones/iphone-12-pro-graphite.webp" },
      { name: "Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-12-pro-gold.webp" },
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-12-pro-silver.webp" },
    ],
  },
  {
    name: "iPhone 12",
    year: 2020,
    screen: "6.1\"",
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Blue", hex: "#1d3557", imageUrl: "/images/iphones/iphone-12-blue.webp" },
      { name: "Green", hex: "#b4caa4", imageUrl: "/images/iphones/iphone-12-green.webp" },
      { name: "White", hex: "#f7f7f7", imageUrl: "/images/iphones/iphone-12-white.webp" },
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-12-black.webp" },
      { name: "Purple", hex: "#b5a7cb", imageUrl: "/images/iphones/iphone-12-purple.webp" },
      { name: "Product Red", hex: "#e30016", imageUrl: "/images/iphones/iphone-12-red.webp" },
    ],
  },
  {
    name: "iPhone 12 mini",
    year: 2020,
    screen: "5.4\"",
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Blue", hex: "#1d3557", imageUrl: "/images/iphones/iphone-12-blue.webp" },
      { name: "Green", hex: "#b4caa4", imageUrl: "/images/iphones/iphone-12-green.webp" },
      { name: "White", hex: "#f7f7f7", imageUrl: "/images/iphones/iphone-12-white.webp" },
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-12-black.webp" },
      { name: "Purple", hex: "#b5a7cb", imageUrl: "/images/iphones/iphone-12-purple.webp" },
      { name: "Product Red", hex: "#e30016", imageUrl: "/images/iphones/iphone-12-red.webp" },
    ],
  },
  {
    name: "iPhone SE (2ª geração)",
    year: 2020,
    screen: "4.7\"",
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-se-finish-select-202207-midnight?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "White", hex: "#f7f7f7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-se-finish-select-202207-starlight?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Product Red", hex: "#e30016", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-se-finish-select-202207-red?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },

  // ===== 2019 =====
  {
    name: "iPhone 11 Pro Max",
    year: 2019,
    screen: "6.5\"",
    capacities: ["64GB", "256GB", "512GB"],
    colors: [
      { name: "Midnight Green", hex: "#4e5851", imageUrl: "/images/iphones/iphone-11-pro-max-midnight-green.webp" },
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-11-pro-max-silver.webp" },
      { name: "Space Gray", hex: "#4b4a4e", imageUrl: "/images/iphones/iphone-11-pro-max-space-grey.webp" },
      { name: "Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-11-pro-max-gold.webp" },
    ],
  },
  {
    name: "iPhone 11 Pro",
    year: 2019,
    screen: "5.8\"",
    capacities: ["64GB", "256GB", "512GB"],
    colors: [
      { name: "Midnight Green", hex: "#4e5851", imageUrl: "/images/iphones/iphone-11-pro-midnight-green.webp" },
      { name: "Silver", hex: "#e2e4e1", imageUrl: "/images/iphones/iphone-11-pro-silver.webp" },
      { name: "Space Gray", hex: "#4b4a4e", imageUrl: "/images/iphones/iphone-11-pro-space-grey.webp" },
      { name: "Gold", hex: "#fae7cf", imageUrl: "/images/iphones/iphone-11-pro-gold.webp" },
    ],
  },
  {
    name: "iPhone 11",
    year: 2019,
    screen: "6.1\"",
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Purple", hex: "#d1c4e9", imageUrl: "/images/iphones/iphone-11-purple.webp" },
      { name: "Yellow", hex: "#fff59d", imageUrl: "/images/iphones/iphone-11-yellow.webp" },
      { name: "Green", hex: "#b2dfdb", imageUrl: "/images/iphones/iphone-11-green.webp" },
      { name: "Black", hex: "#1d1d1f", imageUrl: "/images/iphones/iphone-11-black.webp" },
      { name: "White", hex: "#f7f7f7", imageUrl: "/images/iphones/iphone-11-white.webp" },
      { name: "Product Red", hex: "#e30016", imageUrl: "/images/iphones/iphone-11-red.webp" },
    ],
  },

  // ===== 2018 =====
  {
    name: "iPhone XS Max",
    year: 2018,
    screen: "6.5\"",
    capacities: ["64GB", "256GB", "512GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
    ],
  },
  {
    name: "iPhone XS",
    year: 2018,
    screen: "5.8\"",
    capacities: ["64GB", "256GB", "512GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
    ],
  },
  {
    name: "iPhone XR",
    year: 2018,
    screen: "6.1\"",
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f" },
      { name: "White", hex: "#f7f7f7" },
      { name: "Blue", hex: "#42a5f5" },
      { name: "Yellow", hex: "#ffee58" },
      { name: "Coral", hex: "#ff7043" },
      { name: "Product Red", hex: "#e30016" },
    ],
  },

  // ===== 2017 =====
  {
    name: "iPhone X",
    year: 2017,
    screen: "5.8\"",
    capacities: ["64GB", "256GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
    ],
  },
  {
    name: "iPhone 8 Plus",
    year: 2017,
    screen: "5.5\"",
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
      { name: "Product Red", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone 8",
    year: 2017,
    screen: "4.7\"",
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
      { name: "Product Red", hex: "#e30016" },
    ],
  },

  // ===== 2016 =====
  {
    name: "iPhone 7 Plus",
    year: 2016,
    screen: "5.5\"",
    capacities: ["32GB", "128GB", "256GB"],
    colors: [
      { name: "Matte Black", hex: "#1d1d1f" },
      { name: "Jet Black", hex: "#0a0a0a" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
      { name: "Rose Gold", hex: "#e7b4b6" },
      { name: "Product Red", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone 7",
    year: 2016,
    screen: "4.7\"",
    capacities: ["32GB", "128GB", "256GB"],
    colors: [
      { name: "Matte Black", hex: "#1d1d1f" },
      { name: "Jet Black", hex: "#0a0a0a" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
      { name: "Rose Gold", hex: "#e7b4b6" },
      { name: "Product Red", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone SE (1ª geração)",
    year: 2016,
    screen: "4\"",
    capacities: ["16GB", "32GB", "64GB", "128GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
      { name: "Rose Gold", hex: "#e7b4b6" },
    ],
  },

  // ===== 2015 =====
  {
    name: "iPhone 6s Plus",
    year: 2015,
    screen: "5.5\"",
    capacities: ["16GB", "32GB", "64GB", "128GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
      { name: "Rose Gold", hex: "#e7b4b6" },
    ],
  },
  {
    name: "iPhone 6s",
    year: 2015,
    screen: "4.7\"",
    capacities: ["16GB", "32GB", "64GB", "128GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
      { name: "Rose Gold", hex: "#e7b4b6" },
    ],
  },

  // ===== 2014 =====
  {
    name: "iPhone 6 Plus",
    year: 2014,
    screen: "5.5\"",
    capacities: ["16GB", "64GB", "128GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
    ],
  },
  {
    name: "iPhone 6",
    year: 2014,
    screen: "4.7\"",
    capacities: ["16GB", "32GB", "64GB", "128GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
    ],
  },

  // ===== 2013-2007 Clássicos =====
  {
    name: "iPhone 5s",
    year: 2013,
    screen: "4\"",
    capacities: ["16GB", "32GB", "64GB"],
    colors: [
      { name: "Space Gray", hex: "#4b4a4e" },
      { name: "Silver", hex: "#e2e4e1" },
      { name: "Gold", hex: "#fae7cf" },
    ],
  },
  {
    name: "iPhone 5c",
    year: 2013,
    screen: "4\"",
    capacities: ["8GB", "16GB", "32GB"],
    colors: [
      { name: "White", hex: "#f7f7f7" },
      { name: "Blue", hex: "#42a5f5" },
      { name: "Pink", hex: "#f06292" },
      { name: "Green", hex: "#81c784" },
      { name: "Yellow", hex: "#fff176" },
    ],
  },
  {
    name: "iPhone 5",
    year: 2012,
    screen: "4\"",
    capacities: ["16GB", "32GB", "64GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f" },
      { name: "White", hex: "#f7f7f7" },
    ],
  },
  {
    name: "iPhone 4s",
    year: 2011,
    screen: "3.5\"",
    capacities: ["8GB", "16GB", "32GB", "64GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f" },
      { name: "White", hex: "#f7f7f7" },
    ],
  },
  {
    name: "iPhone 4",
    year: 2010,
    screen: "3.5\"",
    capacities: ["8GB", "16GB", "32GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f" },
      { name: "White", hex: "#f7f7f7" },
    ],
  },
  {
    name: "iPhone 3GS",
    year: 2009,
    screen: "3.5\"",
    capacities: ["8GB", "16GB", "32GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f" },
      { name: "White", hex: "#f7f7f7" },
    ],
  },
  {
    name: "iPhone 3G",
    year: 2008,
    screen: "3.5\"",
    capacities: ["8GB", "16GB"],
    colors: [
      { name: "Black", hex: "#1d1d1f" },
      { name: "White", hex: "#f7f7f7" },
    ],
  },
  {
    name: "iPhone (1ª geração)",
    year: 2007,
    screen: "3.5\"",
    capacities: ["4GB", "8GB", "16GB"],
    colors: [
      { name: "Silver", hex: "#c0c0c0" },
      { name: "Black", hex: "#1d1d1f" },
    ],
  },
];

export function detectIphoneModel(query: string): IphoneModelSpec | null {
  const raw = String(query || "").trim();
  if (!raw) return null;

  const q = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // 1. Busca exata por nome
  for (const model of IPHONE_CATALOG) {
    const mName = model.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (q === mName || q === mName.replace(/^iphone\s*/, "")) {
      return model;
    }
  }

  // 2. Busca por substring decrescente para não confundir "iPhone 16 Pro Max" com "iPhone 16"
  const sorted = [...IPHONE_CATALOG].sort((a, b) => b.name.length - a.name.length);
  for (const model of sorted) {
    const mName = model.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const shortName = mName.replace(/^iphone\s*/, "");
    if (q === mName || q === shortName || q.includes(mName) || q.includes(shortName)) {
      return model;
    }
  }

  return null;
}

export function getIphoneModelColorImage(
  modelSpec: IphoneModelSpec | null | undefined,
  colorName?: string,
): string {
  if (!modelSpec) return "";

  if (colorName) {
    const cleanColor = colorName.toLowerCase().trim();
    const match = modelSpec.colors.find((c) => {
      const cLower = c.name.toLowerCase().trim();
      return cLower === cleanColor || cLower.includes(cleanColor) || cleanColor.includes(cLower);
    });
    if (match?.imageUrl) {
      return resolveIphoneImageUrl(match.imageUrl);
    }
  }

  const firstWithImage = modelSpec.colors.find((c) => c.imageUrl);
  if (firstWithImage?.imageUrl) {
    return resolveIphoneImageUrl(firstWithImage.imageUrl);
  }

  if (modelSpec.defaultImageUrl) {
    return resolveIphoneImageUrl(modelSpec.defaultImageUrl);
  }

  return "";
}

export function resolveProductImage(
  name: string,
  currentImageUrl?: string | null,
  colorName?: string,
): string {
  const cleanUrl = (currentImageUrl ?? "").trim();
  if (
    cleanUrl &&
    !cleanUrl.includes("unsplash.com") &&
    !cleanUrl.includes("placeholder")
  ) {
    const match = cleanUrl.match(/\/images\/iphones\/[a-zA-Z0-9_-]+\.(png|webp)/);
    if (match) {
      return resolveIphoneImageUrl(match[0]);
    }
    return cleanUrl;
  }

  const cleanName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  // Acessórios
  if (cleanName.includes("magsafe")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MHXH3?wid=1000&hei=1000&fmt=png-alpha";
  }
  if (cleanName.includes("airpods")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MTJV3?wid=1000&hei=1000&fmt=png-alpha";
  }

  const match = detectIphoneModel(cleanName);
  if (match) {
    const resolved = getIphoneModelColorImage(match, colorName);
    if (resolved) return resolved;
  }

  // Fallbacks elegantes por geração
  if (cleanName.includes("16 pro")) {
    return resolveIphoneImageUrl("/images/iphones/iphone-16-pro-natural-titanium.webp");
  }
  if (cleanName.includes("16")) {
    return resolveIphoneImageUrl("/images/iphones/iphone-16-white.webp");
  }
  if (cleanName.includes("15 pro")) {
    return resolveIphoneImageUrl("/images/iphones/iphone-15-pro-natural-titanium.webp");
  }
  if (cleanName.includes("15")) {
    return resolveIphoneImageUrl("/images/iphones/iphone-15-blue.webp");
  }
  if (cleanName.includes("14 pro")) {
    return resolveIphoneImageUrl("/images/iphones/iphone-14-pro-deep-purple.webp");
  }
  if (cleanName.includes("14")) {
    return resolveIphoneImageUrl("/images/iphones/iphone-14-starlight.webp");
  }
  if (cleanName.includes("13")) {
    return resolveIphoneImageUrl("/images/iphones/iphone-13-midnight.webp");
  }

  return cleanUrl || "/images/logo.png";
}

export const POPULAR_IPHONE_MODELS = [
  "iPhone 16 Pro Max",
  "iPhone 16 Pro",
  "iPhone 16",
  "iPhone 15 Pro Max",
  "iPhone 15 Pro",
  "iPhone 15",
  "iPhone 14 Pro Max",
  "iPhone 14",
  "iPhone 13 Pro Max",
  "iPhone 13",
  "iPhone 12",
  "iPhone 11",
];

export const FALLBACK_STORAGE_OPTIONS = [
  "64 GB",
  "128 GB",
  "256 GB",
  "512 GB",
  "1 TB",
  "Não sei",
];

export const FALLBACK_COLOR_OPTIONS: IphoneColorSpec[] = [
  { name: "Preto", hex: "#1d1d1f" },
  { name: "Branco / Prateado", hex: "#f5f5f7" },
  { name: "Azul", hex: "#2c4d5e" },
  { name: "Dourado", hex: "#fae7cf" },
  { name: "Verde", hex: "#475c4d" },
  { name: "Rosa / Roxo", hex: "#b5a7cb" },
  { name: "Outra cor", hex: "#888888" },
];

export function detectColorHex(name?: string | null): string | null {
  if (!name) return null;
  const n = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!n) return null;

  // Busca no catálogo oficial Apple
  for (const model of IPHONE_CATALOG) {
    for (const c of model.colors) {
      const cNorm = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (cNorm === n || n.includes(cNorm) || cNorm.includes(n)) {
        return c.hex;
      }
    }
  }

  // Titânios do iPhone
  if (n.includes("natural titanium") || n.includes("titanio natural")) return "#bebaa7";
  if (n.includes("desert titanium") || n.includes("titanio deserto") || n.includes("deserto")) return "#c6aa91";
  if (n.includes("white titanium") || n.includes("titanio branco")) return "#f2f1ed";
  if (n.includes("black titanium") || n.includes("titanio preto")) return "#3c3b37";
  if (n.includes("blue titanium") || n.includes("titanio azul")) return "#3b4453";

  // Cores comuns e da Apple
  if (n.includes("dourado") || n.includes("gold")) return "#fae7cf";
  if (n.includes("prateado") || n.includes("silver") || n.includes("prata")) return "#e2e4e1";
  if (n.includes("grafite") || n.includes("graphite")) return "#545351";
  if (n.includes("espaco") || n.includes("space gray") || n.includes("cinza espacial")) return "#4b4a4e";
  if (n.includes("space black") || n.includes("preto espacial")) return "#2e2c2e";
  if (n.includes("midnight") || n.includes("meia-noite") || n.includes("meia noite")) return "#1b242d";
  if (n.includes("starlight") || n.includes("estelar")) return "#f0e9d7";
  if (n.includes("red") || n.includes("vermelho")) return "#e30016";
  if (n.includes("rosa") || n.includes("pink") || n.includes("rose")) return "#faddd7";
  if (n.includes("azul") || n.includes("blue") || n.includes("sierra")) return "#a7c1d9";
  if (n.includes("verde") || n.includes("green") || n.includes("alpine")) return "#475c4d";
  if (n.includes("roxo") || n.includes("purple") || n.includes("violeta")) return "#63587b";
  if (n.includes("amarelo") || n.includes("yellow")) return "#f3e08c";
  if (n.includes("laranja") || n.includes("orange")) return "#ff8c00";
  if (n.includes("preto") || n.includes("black") || n.includes("dark")) return "#1d1d1f";
  if (n.includes("branco") || n.includes("white")) return "#f7f7f7";
  if (n.includes("cinza") || n.includes("gray") || n.includes("grey")) return "#8e8e93";

  return null;
}
