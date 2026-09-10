export type IphoneModelSpec = {
  name: string;
  year: number;
  capacities: string[];
  colors: { name: string; hex: string; imageUrl?: string }[];
  defaultImageUrl?: string;
};

export const IPHONE_CATALOG: IphoneModelSpec[] = [
  {
    name: "iPhone 17 Pro Max",
    year: 2025,
    capacities: ["256GB", "512GB", "1TB", "2TB"],
    colors: [
      { name: "Prateado", hex: "#e2e4e1", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Laranja-cósmico", hex: "#e65c00", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Azul-intenso", hex: "#1d3557", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 17 Pro",
    year: 2025,
    capacities: ["256GB", "512GB", "1TB"],
    colors: [
      { name: "Prateado", hex: "#e2e4e1", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Laranja-cósmico", hex: "#e65c00", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Azul-intenso", hex: "#1d3557", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 17",
    year: 2025,
    capacities: ["256GB", "512GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-black?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Branco", hex: "#f7f7f7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-white?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Azul-névoa", hex: "#a7c1d9", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-ultramarine?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Sálvia", hex: "#778e78", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-teal?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Lavanda", hex: "#b5a7cb", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-pink?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone Air",
    year: 2025,
    capacities: ["256GB", "512GB", "1TB"],
    colors: [
      { name: "Preto-espacial", hex: "#2e2c2e" },
      { name: "Branco-nuvem", hex: "#f2f1ed" },
      { name: "Dourado-claro", hex: "#fae7cf" },
      { name: "Azul-céu", hex: "#87ceeb" },
    ],
  },
  {
    name: "iPhone 17e",
    year: 2026,
    capacities: ["256GB", "512GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f" },
      { name: "Branco", hex: "#f7f7f7" },
      { name: "Rosa-pálido", hex: "#faddd7" },
    ],
  },
  {
    name: "iPhone 16 Pro Max",
    year: 2024,
    capacities: ["256GB", "512GB", "1TB"],
    colors: [
      { name: "Titânio-deserto", hex: "#c6aa91", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio natural", hex: "#bebaa7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-naturaltitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio branco", hex: "#f2f1ed", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio preto", hex: "#3c3b37", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 16 Pro",
    year: 2024,
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Titânio-deserto", hex: "#c6aa91", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio natural", hex: "#bebaa7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-naturaltitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio branco", hex: "#f2f1ed", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-whitetitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio preto", hex: "#3c3b37", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-blacktitanium?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 16 Plus",
    year: 2024,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f" },
      { name: "Branco", hex: "#f7f7f7" },
      { name: "Rosa", hex: "#faddd7" },
      { name: "Verde-acinzentado", hex: "#8ab4ac" },
      { name: "Ultramarino", hex: "#42506e" },
    ],
  },
  {
    name: "iPhone 16",
    year: 2024,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-black?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Branco", hex: "#f7f7f7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-white?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Rosa", hex: "#faddd7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-pink?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Verde-acinzentado", hex: "#8ab4ac", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-teal?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Ultramarino", hex: "#42506e", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-ultramarine?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 16e",
    year: 2025,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f" },
      { name: "Branco", hex: "#f7f7f7" },
    ],
  },
  {
    name: "iPhone 15 Pro Max",
    year: 2023,
    capacities: ["256GB", "512GB", "1TB"],
    colors: [
      { name: "Titânio natural", hex: "#bebaa7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio azul", hex: "#3b4453", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-bluetitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio branco", hex: "#f2f1ed", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-whitetitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio preto", hex: "#3c3b37", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-blacktitanium?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 15 Pro",
    year: 2023,
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Titânio natural", hex: "#bebaa7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio azul", hex: "#3b4453", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-bluetitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio branco", hex: "#f2f1ed", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-whitetitanium?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Titânio preto", hex: "#3c3b37", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-blacktitanium?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 15 Plus",
    year: 2023,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f" },
      { name: "Azul", hex: "#a7c1d9" },
      { name: "Verde", hex: "#b4caa4" },
      { name: "Amarelo", hex: "#f3e08c" },
      { name: "Rosa", hex: "#faddd7" },
    ],
  },
  {
    name: "iPhone 15",
    year: 2023,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-black?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Azul", hex: "#a7c1d9", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-blue?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Verde", hex: "#b4caa4", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-green?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Amarelo", hex: "#f3e08c", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-yellow?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Rosa", hex: "#faddd7", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-pink?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 14 Pro Max",
    year: 2022,
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Roxo-profundo", hex: "#483d8b", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-pro-finish-select-202209-6-1inch-deeppurple?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Preto-espacial", hex: "#2e2c2e", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-pro-finish-select-202209-6-1inch-spaceblack?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Dourado", hex: "#fae7cf", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-pro-finish-select-202209-6-1inch-gold?wid=1000&hei=1000&fmt=png-alpha" },
      { name: "Prateado", hex: "#e2e4e1", imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-pro-finish-select-202209-6-1inch-silver?wid=1000&hei=1000&fmt=png-alpha" },
    ],
  },
  {
    name: "iPhone 14 Pro",
    year: 2022,
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Roxo-profundo", hex: "#483d8b" },
      { name: "Preto-espacial", hex: "#2e2c2e" },
      { name: "Dourado", hex: "#fae7cf" },
      { name: "Prateado", hex: "#e2e4e1" },
    ],
  },
  {
    name: "iPhone 14 Plus",
    year: 2022,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Meia-noite", hex: "#1b242d" },
      { name: "Estelar", hex: "#f0e9d7" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
      { name: "Azul", hex: "#a7c1d9" },
      { name: "Roxo", hex: "#b5a7cb" },
      { name: "Amarelo", hex: "#f3e08c" },
    ],
  },
  {
    name: "iPhone 14",
    year: 2022,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Meia-noite", hex: "#1b242d" },
      { name: "Estelar", hex: "#f0e9d7" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
      { name: "Azul", hex: "#a7c1d9" },
      { name: "Roxo", hex: "#b5a7cb" },
      { name: "Amarelo", hex: "#f3e08c" },
    ],
  },
  {
    name: "iPhone SE (3ª geração)",
    year: 2022,
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Meia-noite", hex: "#1b242d" },
      { name: "Estelar", hex: "#f0e9d7" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone 13 Pro Max",
    year: 2021,
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Azul-Sierra", hex: "#9bb0c1" },
      { name: "Verde-alpino", hex: "#475c4d" },
      { name: "Grafite", hex: "#545351" },
      { name: "Dourado", hex: "#fae7cf" },
      { name: "Prateado", hex: "#e2e4e1" },
    ],
  },
  {
    name: "iPhone 13 Pro",
    year: 2021,
    capacities: ["128GB", "256GB", "512GB", "1TB"],
    colors: [
      { name: "Azul-Sierra", hex: "#9bb0c1" },
      { name: "Verde-alpino", hex: "#475c4d" },
      { name: "Grafite", hex: "#545351" },
      { name: "Dourado", hex: "#fae7cf" },
      { name: "Prateado", hex: "#e2e4e1" },
    ],
  },
  {
    name: "iPhone 13",
    year: 2021,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Meia-noite", hex: "#1b242d" },
      { name: "Estelar", hex: "#f0e9d7" },
      { name: "Azul", hex: "#42506e" },
      { name: "Rosa", hex: "#faddd7" },
      { name: "Verde", hex: "#475c4d" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone 13 mini",
    year: 2021,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Meia-noite", hex: "#1b242d" },
      { name: "Estelar", hex: "#f0e9d7" },
      { name: "Azul", hex: "#42506e" },
      { name: "Rosa", hex: "#faddd7" },
      { name: "Verde", hex: "#475c4d" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone 12 Pro Max",
    year: 2020,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Azul-Pacífico", hex: "#2c4d5e" },
      { name: "Grafite", hex: "#545351" },
      { name: "Dourado", hex: "#fae7cf" },
      { name: "Prateado", hex: "#e2e4e1" },
    ],
  },
  {
    name: "iPhone 12 Pro",
    year: 2020,
    capacities: ["128GB", "256GB", "512GB"],
    colors: [
      { name: "Azul-Pacífico", hex: "#2c4d5e" },
      { name: "Grafite", hex: "#545351" },
      { name: "Dourado", hex: "#fae7cf" },
      { name: "Prateado", hex: "#e2e4e1" },
    ],
  },
  {
    name: "iPhone 12",
    year: 2020,
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f" },
      { name: "Branco", hex: "#f7f7f7" },
      { name: "Azul", hex: "#1d3557" },
      { name: "Verde", hex: "#b4caa4" },
      { name: "Roxo", hex: "#b5a7cb" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone 12 mini",
    year: 2020,
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f" },
      { name: "Branco", hex: "#f7f7f7" },
      { name: "Azul", hex: "#1d3557" },
      { name: "Verde", hex: "#b4caa4" },
      { name: "Roxo", hex: "#b5a7cb" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone 11 Pro Max",
    year: 2019,
    capacities: ["64GB", "256GB", "512GB"],
    colors: [
      { name: "Verde meia-noite", hex: "#4e5851" },
      { name: "Cinza-espacial", hex: "#4b4a4e" },
      { name: "Dourado", hex: "#fae7cf" },
      { name: "Prateado", hex: "#e2e4e1" },
    ],
  },
  {
    name: "iPhone 11 Pro",
    year: 2019,
    capacities: ["64GB", "256GB", "512GB"],
    colors: [
      { name: "Verde meia-noite", hex: "#4e5851" },
      { name: "Cinza-espacial", hex: "#4b4a4e" },
      { name: "Dourado", hex: "#fae7cf" },
      { name: "Prateado", hex: "#e2e4e1" },
    ],
  },
  {
    name: "iPhone 11",
    year: 2019,
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f" },
      { name: "Branco", hex: "#f7f7f7" },
      { name: "Roxo", hex: "#d1c4e9" },
      { name: "Verde", hex: "#b2dfdb" },
      { name: "Amarelo", hex: "#fff59d" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
    ],
  },
  {
    name: "iPhone XR",
    year: 2018,
    capacities: ["64GB", "128GB", "256GB"],
    colors: [
      { name: "Preto", hex: "#1d1d1f" },
      { name: "Branco", hex: "#f7f7f7" },
      { name: "Azul", hex: "#42a5f5" },
      { name: "Amarelo", hex: "#ffee58" },
      { name: "Coral", hex: "#ff7043" },
      { name: "(PRODUCT)RED", hex: "#e30016" },
    ],
  },
];

/**
 * Resolve imagens oficiais transparentes da Apple para evitar fotos genéricas de mesas ou fundos pretos
 */
export function resolveProductImage(
  name: string,
  currentImageUrl?: string | null,
  colorName?: string,
): string {
  const cleanUrl = (currentImageUrl ?? "").trim();
  // Se já for uma imagem oficial Apple CDN ou PNG transparente válida, mantém
  if (
    cleanUrl &&
    !cleanUrl.includes("unsplash.com") &&
    !cleanUrl.includes("placeholder") &&
    (cleanUrl.includes("apple.com") || cleanUrl.includes(".png") || cleanUrl.includes("png-alpha"))
  ) {
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

  // Modelos de iPhone
  const match = IPHONE_CATALOG.find((m) => {
    const mName = m.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    return cleanName.includes(mName);
  });

  if (match) {
    if (colorName) {
      const cLower = colorName.toLowerCase();
      const col = match.colors.find(
        (c) =>
          c.name.toLowerCase().includes(cLower) ||
          cLower.includes(c.name.toLowerCase()),
      );
      if (col?.imageUrl) return col.imageUrl;
    }
    const withImg = match.colors.find((c) => c.imageUrl);
    if (withImg?.imageUrl) return withImg.imageUrl;
  }

  // Fallbacks elegantes por geração
  if (cleanName.includes("16 pro")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-pro-finish-select-202409-6-3inch-deserttitanium?wid=1000&hei=1000&fmt=png-alpha";
  }
  if (cleanName.includes("16")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-16-finish-select-202409-6-1inch-white?wid=1000&hei=1000&fmt=png-alpha";
  }
  if (cleanName.includes("15 pro")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-1inch-naturaltitanium?wid=1000&hei=1000&fmt=png-alpha";
  }
  if (cleanName.includes("15")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-finish-select-202309-6-1inch-blue?wid=1000&hei=1000&fmt=png-alpha";
  }
  if (cleanName.includes("14 pro")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-pro-finish-select-202209-6-1inch-deeppurple?wid=1000&hei=1000&fmt=png-alpha";
  }
  if (cleanName.includes("14")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-14-finish-select-202209-6-1inch-starlight?wid=1000&hei=1000&fmt=png-alpha";
  }
  if (cleanName.includes("13")) {
    return "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-13-finish-select-202207-6-1inch-midnight?wid=1000&hei=1000&fmt=png-alpha";
  }

  return cleanUrl || "/images/logo.png";
}

/**
 * Detecta um modelo de iPhone pelo texto digitado ou selecionado
 */
export function detectIphoneModel(query: string): IphoneModelSpec | null {
  const raw = String(query || "").trim();
  if (!raw) return null;

  const q = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Busca exata no catálogo
  for (const model of IPHONE_CATALOG) {
    const mName = model.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (q === mName || q === mName.replace(/^iphone\s*/, "")) {
      return model;
    }
  }

  // Ordena por comprimento decrescente para não confundir "iPhone 16 Pro Max" com "iPhone 16"
  const sorted = [...IPHONE_CATALOG].sort((a, b) => b.name.length - a.name.length);
  for (const model of sorted) {
    const mName = model.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const shortName = mName.replace(/^iphone\s*/, "");

    const escapedShort = shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");
    const escapedFull = mName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*");

    if (
      new RegExp(`\\b${escapedFull}\\b`, "i").test(q) ||
      new RegExp(`\\b${escapedShort}\\b`, "i").test(q)
    ) {
      return model;
    }
  }

  return null;
}

/**
 * Modelos populares para seleção rápida por pílulas
 */
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

export const FALLBACK_COLOR_OPTIONS = [
  { name: "Preto", hex: "#1d1d1f" },
  { name: "Branco / Prateado", hex: "#f5f5f7" },
  { name: "Azul", hex: "#2c4d5e" },
  { name: "Dourado", hex: "#fae7cf" },
  { name: "Verde", hex: "#475c4d" },
  { name: "Rosa / Roxo", hex: "#b5a7cb" },
  { name: "Outra cor", hex: "#888888" },
];

