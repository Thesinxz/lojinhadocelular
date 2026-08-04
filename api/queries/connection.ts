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
        warranty VARCHAR(120) DEFAULT '1 ano de garantia',
        featured BOOLEAN NOT NULL DEFAULT FALSE,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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
        battery_health VARCHAR(30) DEFAULT '',
        price_cash INT NOT NULL,
        available BOOLEAN NOT NULL DEFAULT TRUE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Adiciona colunas adicionais caso a tabela já exista
    await pool.query(`ALTER TABLE variants ADD COLUMN battery_health VARCHAR(30) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN image_url TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN warranty VARCHAR(120) DEFAULT ''`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN notes TEXT`).catch(() => {});
    await pool.query(`ALTER TABLE variants ADD COLUMN quantity INT NOT NULL DEFAULT 1`).catch(() => {});

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        \`key\` VARCHAR(60) PRIMARY KEY,
        \`value\` TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    tablesEnsured = true;
  } catch (err) {
    console.error("Erro ao verificar/criar tabelas no banco MySQL:", err);
  }
}

export function getDb(): MySql2Database<typeof fullSchema> {
  if (!instance) {
    pool = mysql.createPool(env.databaseUrl);
    ensureTables().catch(() => {});
    instance = drizzle(pool, {
      mode: "default",
      schema: fullSchema,
    });
  }
  return instance;
}
