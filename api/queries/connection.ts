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
      CREATE TABLE IF NOT EXISTS admin_users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(40) NOT NULL,
        name VARCHAR(80) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('dono', 'vendedor') NOT NULL DEFAULT 'vendedor',
        unit VARCHAR(10) NULL,
        can_edit_prices BOOLEAN NOT NULL DEFAULT FALSE,
        extra_caps TEXT NULL,
        sessions_valid_after TIMESTAMP NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_admin_users_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumnExists(pool, "admin_users", "extra_caps", "TEXT NULL");
    await ensureColumnExists(pool, "admin_users", "sessions_valid_after", "TIMESTAMP NULL");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NULL,
        user_name VARCHAR(80) NOT NULL DEFAULT '',
        action VARCHAR(60) NOT NULL,
        entity_type VARCHAR(30) NOT NULL,
        entity_id VARCHAR(60) NULL,
        summary TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_logs_created_at (created_at),
        INDEX idx_audit_logs_entity (entity_type, entity_id)
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
        icloud_free VARCHAR(30) DEFAULT '',
        loyalty_status VARCHAR(20) DEFAULT '',
        loyalty_note VARCHAR(200) DEFAULT '',
        erp_customer_id VARCHAR(80) DEFAULT '',
        loyalty_checked_at TIMESTAMP NULL,
        visual_condition VARCHAR(100) DEFAULT '',
        \`condition\` VARCHAR(60) NOT NULL,
        battery VARCHAR(60) NOT NULL,
        notes TEXT,
        photos_count INT NOT NULL DEFAULT 0,
        photos MEDIUMTEXT,
        status ENUM('pendente', 'atendimento', 'concluido', 'recusado') NOT NULL DEFAULT 'pendente',
        notification_status VARCHAR(30) NOT NULL DEFAULT 'not_configured',
        notification_error TEXT,
        notified_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_evaluations_status (status),
        INDEX idx_evaluations_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await ensureColumnExists(pool, "evaluations", "photos", "LONGTEXT");
    try {
      await pool.query("ALTER TABLE `evaluations` MODIFY COLUMN `photos` LONGTEXT");
    } catch {}
    await ensureColumnExists(pool, "evaluations", "photos_count", "INT NOT NULL DEFAULT 0");
    await ensureColumnExists(pool, "evaluations", "notification_status", "VARCHAR(30) NOT NULL DEFAULT 'not_configured'");
    await ensureColumnExists(pool, "evaluations", "notification_error", "TEXT");
    await ensureColumnExists(pool, "evaluations", "notified_at", "TIMESTAMP NULL");
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
    await ensureColumnExists(pool, "evaluations", "icloud_free", "VARCHAR(30) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "loyalty_status", "VARCHAR(20) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "loyalty_note", "VARCHAR(200) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "erp_customer_id", "VARCHAR(80) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "loyalty_checked_at", "TIMESTAMP NULL");
    await ensureColumnExists(pool, "evaluations", "visual_condition", "VARCHAR(100) DEFAULT ''");
    // Fluxo de atendimento (Etapa 3)
    await ensureColumnExists(pool, "evaluations", "unit", "VARCHAR(10) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "assigned_user_id", "INT UNSIGNED NULL");
    await ensureColumnExists(pool, "evaluations", "assigned_user_name", "VARCHAR(80) DEFAULT ''");
    await ensureColumnExists(pool, "evaluations", "assigned_at", "TIMESTAMP NULL");
    await ensureColumnExists(pool, "evaluations", "first_response_at", "TIMESTAMP NULL");
    await ensureColumnExists(pool, "evaluations", "status_changed_at", "TIMESTAMP NULL");
    await ensureColumnExists(pool, "evaluations", "offered_value", "INT NULL");
    await ensureColumnExists(pool, "evaluations", "closed_value", "INT NULL");
    await ensureColumnExists(pool, "evaluations", "refusal_reason", "VARCHAR(30) DEFAULT ''");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluation_notes (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        evaluation_id INT UNSIGNED NOT NULL,
        user_id INT UNSIGNED NULL,
        user_name VARCHAR(80) NOT NULL DEFAULT '',
        body TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_evaluation_notes_evaluation (evaluation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluation_messages (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        evaluation_id INT UNSIGNED NOT NULL,
        event VARCHAR(30) NOT NULL,
        recipient VARCHAR(10) NOT NULL,
        status VARCHAR(20) NOT NULL,
        error TEXT,
        body TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_evaluation_messages_evaluation (evaluation_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalog_state (
        product_id VARCHAR(80) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price INT NULL,
        stock_jardim INT NOT NULL DEFAULT 0,
        stock_gll INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS catalog_changes (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        product_id VARCHAR(80) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        kind VARCHAR(20) NOT NULL,
        old_value INT NULL,
        new_value INT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_catalog_changes_created_at (created_at),
        INDEX idx_catalog_changes_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS product_interest (
        day VARCHAR(10) NOT NULL,
        product_id VARCHAR(80) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        clicks INT NOT NULL DEFAULT 0,
        PRIMARY KEY (day, product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS evaluation_erp_entries (
        evaluation_id INT UNSIGNED PRIMARY KEY,
        status VARCHAR(10) NOT NULL,
        erp_product_id VARCHAR(80) NULL,
        imei_last4 VARCHAR(4) NULL,
        user_id INT UNSIGNED NULL,
        user_name VARCHAR(80) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

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
