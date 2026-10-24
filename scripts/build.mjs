// `npm run build`: 1) packs the migrations, 2) creates any missing tables / starter rows in the database,
// 3) runs `next build --webpack` with the compiler's thread pools capped.
//
// Step 2 is safe to repeat on every deploy: migrations already applied are skipped, existing data is never touched,
// and anything that could change existing data is refused (see scripts/migrate-runner.mjs). If the database cannot be
// reached from the build machine the build still succeeds; the app applies the same migrations when it starts.
// Set SKIP_MIGRATIONS=true to turn step 2 off.
//
// Step 3: shared hosting (Hostinger) limits how many threads/processes an account can run. Next's native compiler
// (tokio) and the CSS tooling (rayon) start one thread PER CPU CORE in every build process, which on a big build
// server aborts with "OS can't spawn worker thread: Resource temporarily unavailable". The limits must exist in the
// environment before any of those libraries start, which is why they are set here and not in next.config.ts.
// Any value already set in the environment (e.g. in Hostinger's Environment Variables) wins over these defaults.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

// --- 1 + 2: migrations
if (process.env.SKIP_MIGRATIONS === "true") {
  console.log("[migrate] SKIP_MIGRATIONS=true: not touching the database during the build");
} else {
  const gen = spawnSync(process.execPath, [join(here, "gen-migrations.mjs")], { stdio: "inherit" });
  if (gen.status !== 0) process.exit(gen.status ?? 1);
  const { runMigrations, summarize } = await import("./migrate-runner.mjs");
  const { migrations } = await import("./migrations.generated.mjs");
  try {
    console.log(summarize(await runMigrations({ migrations })));
  } catch (err) {
    if (err.kind === "connection") {
      console.warn(`[migrate] ${err.message}. Continuing the build; the app will run the migrations when it starts.`);
    } else {
      console.error(`[migrate] ${err.message}`);
      process.exit(1); // never deploy new code on top of a half-applied or unsafe database change
    }
  }
}

// --- 3: build
const env = { ...process.env };
env.TOKIO_WORKER_THREADS ??= "1";
env.RAYON_NUM_THREADS ??= "1";
env.UV_THREADPOOL_SIZE ??= "2"; // libuv file/crypto pool (default 4 per process)
// Fewer V8 helper threads in every Node process of the build (default 4 each).
if (!/--v8-pool-size/.test(env.NODE_OPTIONS ?? "")) env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --v8-pool-size=1`.trim();

const nextBin = require.resolve("next/dist/bin/next");
const result = spawnSync(process.execPath, [nextBin, "build", "--webpack", ...process.argv.slice(2)], { stdio: "inherit", env });

if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
