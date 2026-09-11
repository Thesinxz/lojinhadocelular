import { MySql2Database, drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: MySql2Database<typeof fullSchema>;
let pool: mysql.Pool | undefined;
let tablesEnsured = false;

async function ensureColumnExists(
  p: mysql.Pool,
  table: string,
  column: string,
  columnDef: string
) {
  try {
    const [rows]: any = await p.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return;
    }
  } catch {}

  try {
    await p.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${columnDef}`);
  } catch (err: any) {
    if (err?.errno === 1060 || err?.code === "ER_DUP_FIELDNAME") {
      return;
    }
  }
}

export async function ensureTables() {
  if (tablesEnsured || !pool) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        brand VARCHAR(60) NOT NULL,
        category ENUM('iphone_lacrado', 'iphone_seminovo', 'android', 'acessorio') NOT NULL,
        \`condition\` VARCHAR(30) NOT NULL DEFAULT 'lacrado',
        description TEXT,
        image_url TEXT,
        video_url TEXT,
        warranty VARCHAR(120) DEFAULT '1 ano de garantia',
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_products_active_featured (active, featured),
        INDEX idx_products_active_category (active, category),
        INDEX idx_products_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS variants (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_id BIGINT UNSIGNED NOT NULL,
        version VARCHAR(120) NOT NULL DEFAULT '',
        storage VARCHAR(20) NOT NULL,
        color VARCHAR(60) NOT NULL,
        color_hex VARCHAR(9) DEFAULT '#111111',
        image_url TEXT,
        video_url TEXT,
        sku VARCHAR(60) DEFAULT '',
        battery_health VARCHAR(30) DEFAULT '',
        warranty VARCHAR(120) DEFAULT '',
        \`condition\` VARCHAR(30) DEFAULT '',
        notes TEXT,
        price_cash INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        available BOOLEAN NOT NULL DEFAULT TRUE,
        INDEX idx_variants_product_id (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Migrações incrementais seguras compatíveis com todas as versões de MySQL
    await ensureColumnExists(pool, "products", "video_url", "TEXT");
    await ensureColumnExists(pool, "variants", "sku", "VARCHAR(60) DEFAULT ''");
    await ensureColumnExists(pool, "variants", "video_url", "TEXT");
    await ensureColumnExists(pool, "variants", "battery_health", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "variants", "image_url", "TEXT");
    await ensureColumnExists(pool, "variants", "warranty", "VARCHAR(120) DEFAULT ''");
    await ensureColumnExists(pool, "variants", "condition", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "variants", "notes", "TEXT");
    await ensureColumnExists(pool, "variants", "quantity", "INT NOT NULL DEFAULT 1");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(60) PRIMARY KEY,
        \`value\` TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        whatsapp VARCHAR(30) NOT NULL,
        model VARCHAR(120) NOT NULL,
        storage VARCHAR(30) DEFAULT '',
        color VARCHAR(60) DEFAULT '',
        purchase_location VARCHAR(100) DEFAULT '',
        target_model VARCHAR(120) DEFAULT '',
        face_id VARCHAR(30) DEFAULT '',
        screen_original VARCHAR(30) DEFAULT '',
        battery_original VARCHAR(30) DEFAULT '',
        cameras_ok VARCHAR(30) DEFAULT '',
        audio_ok VARCHAR(30) DEFAULT '',
        charging_port_ok VARCHAR(30) DEFAULT '',
        opened_before VARCHAR(30) DEFAULT '',
        has_box VARCHAR(30) DEFAULT '',
        visual_condition VARCHAR(100) DEFAULT '',
        \`condition\` VARCHAR(60) NOT NULL,
        battery VARCHAR(60) NOT NULL,
        notes TEXT,
        photos_count INT NOT NULL DEFAULT 0,
        photos MEDIUMTEXT,
        status ENUM('pendente', 'atendimento', 'concluido', 'recusado') NOT NULL DEFAULT 'pendente',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_evaluations_status (status),
        INDEX idx_evaluations_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumnExists(pool, "evaluations", "photos", "MEDIUMTEXT");
    await ensureColumnExists(pool, "evaluations", "photos_count", "INT NOT NULL DEFAULT 0");
    await ensureColumnExists(pool, "evaluations", "purchase_location", "VARCHAR(100) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "target_model", "VARCHAR(120) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "face_id", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "screen_original", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "battery_original", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "cameras_ok", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "audio_ok", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "charging_port_ok", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "opened_before", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "has_box", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "visual_condition", "VARCHAR(100) DEFAULT ''");

    tablesEnsured = true;
  } catch (err) {
    console.error("Erro ao verificar/criar tabelas no banco MySQL:", err);
  }

}

export function getPool(): mysql.Pool | undefined {
  if (!pool) {
    getDb();
  }
  return pool;
}

export function getDb(): MySql2Database<typeof fullSchema> {
  if (!instance) {
    if (!env.databaseUrl) {
      console.warn("Aviso: DATABASE_URL não configurada no servidor. O catálogo ERP continuará funcionando em modo leitura.");
    }
    pool = mysql.createPool({
      uri: env.databaseUrl || "mysql://localhost:3306/dummy",
      waitForConnections: true,
      connectionLimit: 15,
      maxIdle: 10,
      idleTimeout: 60000,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
    ensureTables().catch(() => {});
    instance = drizzle(pool, {
      mode: "default",
      schema: fullSchema,
    });
  }
  return instance;
}
