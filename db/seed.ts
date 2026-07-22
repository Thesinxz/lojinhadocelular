import { getDb } from "../api/queries/connection";
import { products, variants, settings } from "./schema";
import { DEFAULT_SETTINGS } from "../contracts/types";

async function seed() {
  const db = getDb();
  console.log("Seeding database...");

  // Configurações padrão da loja
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db
      .insert(settings)
      .values({ key, value })
      .onDuplicateKeyUpdate({ set: { key } });
  }

  const existing = await db.select().from(products);
  if (existing.length === 0) {
    const sample = [
      {
        product: {
          name: "iPhone 15",
          brand: "Apple",
          category: "iphone_lacrado" as const,
          condition: "lacrado",
          description:
            "iPhone 15 lacrado, importado diretamente dos Estados Unidos. Garantia de 1 ano pela Lojinha do Celular.",
          imageUrl:
            "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=800&q=80",
          warranty: "1 ano de garantia",
          featured: true,
          active: true,
        },
        variants: [
          { version: "", storage: "128GB", color: "Preto", colorHex: "#1d1d1f", priceCash: 489900, available: true },
          { version: "", storage: "128GB", color: "Azul", colorHex: "#a7c1d9", priceCash: 489900, available: true },
          { version: "", storage: "256GB", color: "Preto", colorHex: "#1d1d1f", priceCash: 539900, available: true },
          { version: "", storage: "256GB", color: "Azul", colorHex: "#a7c1d9", priceCash: 539900, available: false },
        ],
      },
      {
        product: {
          name: "iPhone 13",
          brand: "Apple",
          category: "iphone_seminovo" as const,
          condition: "seminovo",
          description:
            "iPhone 13 seminovo em excelente estado, importado dos EUA. Bateria acima de 85%. Garantia de 1 ano.",
          imageUrl:
            "https://images.unsplash.com/photo-1632661674596-df8be070a5c5?w=800&q=80",
          warranty: "1 ano de garantia",
          featured: true,
          active: true,
        },
        variants: [
          { version: "", storage: "128GB", color: "Meia-noite", colorHex: "#232a31", priceCash: 289900, available: true },
          { version: "", storage: "128GB", color: "Estelar", colorHex: "#f4e8ce", priceCash: 289900, available: true },
          { version: "", storage: "256GB", color: "Meia-noite", colorHex: "#232a31", priceCash: 319900, available: false },
        ],
      },
      {
        product: {
          name: "Xiaomi Redmi Note 13",
          brand: "Xiaomi",
          category: "android" as const,
          condition: "novo",
          description:
            "Redmi Note 13 novo, lacrado, versão global. Câmera de 108MP e tela AMOLED 120Hz.",
          imageUrl:
            "https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=800&q=80",
          warranty: "1 ano de garantia",
          featured: true,
          active: true,
        },
        variants: [
          { version: "", storage: "128GB", color: "Preto", colorHex: "#111111", priceCash: 119900, available: true },
          { version: "", storage: "256GB", color: "Preto", colorHex: "#111111", priceCash: 139900, available: true },
          { version: "", storage: "256GB", color: "Azul", colorHex: "#7fb3d5", priceCash: 139900, available: true },
        ],
      },
      {
        product: {
          name: "Realme C67",
          brand: "Realme",
          category: "android" as const,
          condition: "novo",
          description: "Realme C67 novo e lacrado. Ótimo custo-benefício.",
          imageUrl:
            "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
          warranty: "1 ano de garantia",
          featured: false,
          active: true,
        },
        variants: [
          { version: "", storage: "128GB", color: "Verde", colorHex: "#2e5e4e", priceCash: 99900, available: true },
        ],
      },
      {
        product: {
          name: "Tecno Spark 20",
          brand: "Tecno",
          category: "android" as const,
          condition: "novo",
          description: "Tecno Spark 20 novo, bateria de longa duração.",
          imageUrl:
            "https://images.unsplash.com/photo-1580910051074-3eb694886505?w=800&q=80",
          warranty: "1 ano de garantia",
          featured: false,
          active: true,
        },
        variants: [
          { version: "", storage: "128GB", color: "Preto", colorHex: "#111111", priceCash: 79900, available: true },
          { version: "", storage: "128GB", color: "Dourado", colorHex: "#d4af37", priceCash: 79900, available: false },
        ],
      },
    ];

    for (const item of sample) {
      const result = await db.insert(products).values(item.product);
      const productId = Number(result[0].insertId);
      await db.insert(variants).values(
        item.variants.map((v) => ({ ...v, productId })),
      );
    }
    console.log("Produtos de exemplo inseridos.");
  }

  console.log("Done.");
  process.exit(0);
}

seed();
