// `npm run migrate`: applies any pending database migrations (creates missing tables, adds starter rows) and
// skips everything already applied. It never changes existing data. See scripts/migrate-runner.mjs.
//
//   npm run migrate                       uses the DB_* settings in the environment, else in .env.local
//   npm run migrate -- --env some.file    reads DB_* settings from that env file instead
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envFlag = process.argv.indexOf("--env");
const envFile = envFlag > -1 ? process.argv[envFlag + 1] : process.env.DB_NAME ? null : ".env.local";

if (envFile) {
  const path = join(root, envFile);
  if (!existsSync(path)) {
    console.error(`[migrate] ${envFile} not found`);
    process.exit(1);
  }
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^"(.*)"$/, "$1");
  }
}

const gen = spawnSync(process.execPath, [join(root, "scripts", "gen-migrations.mjs")], { stdio: "inherit" });
if (gen.status !== 0) process.exit(gen.status ?? 1);

const { runMigrations, summarize } = await import("./migrate-runner.mjs");
const { migrations } = await import("./migrations.generated.mjs");
try {
  console.log(summarize(await runMigrations({ migrations })));
} catch (err) {
  console.error(`[migrate] ${err.message}`);
  process.exit(1);
}
