import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  int,
  boolean,
  timestamp,
  bigint,
  index,
} from "drizzle-orm/mysql-core";

export const products = mysqlTable(
  "products",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    brand: varchar("brand", { length: 60 }).notNull(), // Apple, Xiaomi, Realme, Tecno...
    category: mysqlEnum("category", [
      "iphone_lacrado",
      "iphone_seminovo",
      "android",
      "acessorio",
    ]).notNull(),
    condition: varchar("condition", { length: 30 }).notNull().default("lacrado"), // lacrado | seminovo | novo
    description: text("description"),
    imageUrl: text("image_url"),
    warranty: varchar("warranty", { length: 120 }).default("1 ano de garantia"),
    featured: boolean("featured").notNull().default(false),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    activeFeaturedIdx: index("idx_products_active_featured").on(table.active, table.featured),
    activeCategoryIdx: index("idx_products_active_category").on(table.active, table.category),
    createdAtIdx: index("idx_products_created_at").on(table.createdAt),
  }),
);

export const variants = mysqlTable(
  "variants",
  {
    id: serial("id").primaryKey(),
    productId: bigint("product_id", { mode: "number", unsigned: true }).notNull(),
    version: varchar("version", { length: 120 }).notNull().default(""), // ex: "15 Pro Max", "Note 13 Pro"
    storage: varchar("storage", { length: 20 }).notNull(), // ex: "128GB"
    color: varchar("color", { length: 60 }).notNull(), // ex: "Preto"
    colorHex: varchar("color_hex", { length: 9 }).default("#111111"),
    imageUrl: text("image_url"), // URL da foto específica desta variante/cor
    batteryHealth: varchar("battery_health", { length: 30 }).default(""), // ex: "85%", "100%", "Bateria Nova"
    warranty: varchar("warranty", { length: 120 }).default(""), // ex: "3 meses", "1 ano", "Garantia Apple Nov/2026"
    condition: varchar("condition", { length: 30 }).default(""), // ex: "lacrado", "seminovo_eua", "seminovo_entrada"
    notes: text("notes"), // Observações/detalhes ex: "Sem marcas", "Com caixa e cabo"
    priceCash: int("price_cash").notNull(), // em centavos
    quantity: int("quantity").notNull().default(1), // Quantidade de unidades em estoque
    available: boolean("available").notNull().default(true),
  },
  (table) => ({
    productIdIdx: index("idx_variants_product_id").on(table.productId),
  }),
);

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 60 }).primaryKey(),
  value: text("value"),
});
