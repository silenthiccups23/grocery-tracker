import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const tursoUrl = process.env.TURSO_DATABASE_URL;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: tursoUrl ? "turso" : "sqlite",
  dbCredentials: tursoUrl
    ? {
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }
    : {
        url: "./data.db",
      },
});
