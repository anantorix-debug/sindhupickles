// `npm run build`. Runs `next build --webpack` with the compiler's thread pools capped.
//
// Why: shared hosting (Hostinger) limits how many threads/processes an account can run. Next's native compiler
// (tokio) and the CSS tooling (rayon) start one thread PER CPU CORE in every build process, which on a big build
// server aborts with "OS can't spawn worker thread: Resource temporarily unavailable". The limits must exist in the
// environment before any of those libraries start, which is why they are set here and not in next.config.ts.
//
// Any value already set in the environment (e.g. in Hostinger's Environment Variables) wins over these defaults.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
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
