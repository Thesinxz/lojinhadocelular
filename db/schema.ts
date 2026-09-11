import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  longtext,
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
    videoUrl: text("video_url"),
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
    videoUrl: text("video_url"), // URL do vídeo específico desta unidade/cor
    sku: varchar("sku", { length: 60 }).default(""), // Código de estoque/etiqueta ex: "19046F05"
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

export const evaluations = mysqlTable(
  "evaluations",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    whatsapp: varchar("whatsapp", { length: 30 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    storage: varchar("storage", { length: 30 }).default(""),
    color: varchar("color", { length: 60 }).default(""),
    purchaseLocation: varchar("purchase_location", { length: 100 }).default(""),
    targetModel: varchar("target_model", { length: 120 }).default(""),
    faceId: varchar("face_id", { length: 30 }).default(""),
    screenOriginal: varchar("screen_original", { length: 30 }).default(""),
    batteryOriginal: varchar("battery_original", { length: 30 }).default(""),
    camerasOk: varchar("cameras_ok", { length: 30 }).default(""),
    audioOk: varchar("audio_ok", { length: 30 }).default(""),
    chargingPortOk: varchar("charging_port_ok", { length: 30 }).default(""),
    openedBefore: varchar("opened_before", { length: 30 }).default(""),
    hasBox: varchar("has_box", { length: 30 }).default(""),
    visualCondition: varchar("visual_condition", { length: 100 }).default(""),
    condition: varchar("condition", { length: 60 }).notNull(),
    battery: varchar("battery", { length: 60 }).notNull(),
    notes: text("notes"),
    photosCount: int("photos_count").notNull().default(0),
    photos: longtext("photos"),
    status: mysqlEnum("status", ["pendente", "atendimento", "concluido", "recusado"]).notNull().default("pendente"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("idx_evaluations_status").on(table.status),
    createdAtIdx: index("idx_evaluations_created_at").on(table.createdAt),
  }),
);

