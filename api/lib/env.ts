import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function optional(name: string, fallback = ""): string {
  return process.env[name] || fallback;
}

export const env = {
  appId: optional("APP_ID", "lojinha-app"),
  appSecret: optional("APP_SECRET", "lojinha-secret-default-key-32-chars-min"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
};
