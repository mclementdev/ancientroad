import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations : connexion directe (Neon fournit DATABASE_URL_UNPOOLED) ;
    // l'application, elle, utilise DATABASE_URL (poolée) via src/lib/db.ts
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"],
  },
});
