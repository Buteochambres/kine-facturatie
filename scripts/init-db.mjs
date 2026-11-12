// Eenmalig uit te voeren om de databasetabellen aan te maken:
//   DATABASE_URL="postgresql://..." node scripts/init-db.mjs
// (of laad eerst je .env.local, bv. met `dotenv -e .env.local -- node scripts/init-db.mjs`)
//
// Let op: dit is enkel nog nodig als je de tabellen NIET al via de Neon
// SQL-editor hebt aangemaakt (zie README.md — die weg vermijdt Terminal
// helemaal).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Zet DATABASE_URL eerst (zie .env.example).");
    process.exit(1);
  }

  const sql = readFileSync(path.join(__dirname, "..", "sql", "schema.sql"), "utf-8");
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query(sql);
    console.log("Database-tabellen zijn aangemaakt (of bestonden al).");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
