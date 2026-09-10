import { MySql2Database, drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: MySql2Database<typeof fullSchema>;
let pool: mysql.Pool | undefined;
let tablesEnsured = false;

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

    // Migrações incrementais seguras
    await pool.query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN IF NOT EXISTS sku VARCHAR(60) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN IF NOT EXISTS video_url TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN IF NOT EXISTS battery_health VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN IF NOT EXISTS image_url TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN IF NOT EXISTS warranty VARCHAR(120) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN IF NOT EXISTS \`condition\` VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1`).catch(() => {});

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
        status ENUM('pendente', 'atendimento', 'concluido', 'recusado') NOT NULL DEFAULT 'pendente',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_evaluations_status (status),
        INDEX idx_evaluations_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS purchase_location VARCHAR(100) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS target_model VARCHAR(120) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS face_id VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS screen_original VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS battery_original VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS cameras_ok VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS audio_ok VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS charging_port_ok VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS opened_before VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS has_box VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS visual_condition VARCHAR(100) DEFAULT ''`).catch(() => {});

    tablesEnsured = true;
  } catch (err) {
    console.error("Erro ao verificar/criar tabelas no banco MySQL:", err);
  }

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
