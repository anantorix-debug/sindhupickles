// Hostinger runs the STANDALONE build (`output: "standalone"`), started from its own folder. This builds that way into
// .next-sa, starts `server.js` from the standalone folder, and downloads an existing invoice through it, proving pdfkit,
// the fonts and the logo all made it into the deployable server. Read-only on the shop data (uses an order that already
// has an invoice; throwaway admin). Takes a few minutes.   node scripts/standalone-invoice-smoke.mjs
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import mysql from "mysql2/promise";
import { createTestAdmin } from "./_test-admin.mjs";

const PORT = 3115;
const BASE = `http://localhost:${PORT}`;
const DIST = ".next-sa";
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};

// A host passes its settings as environment variables; here they come from .env.local (values are never printed).
const dotenv = Object.fromEntries(
  (existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "")
    .split(/\r?\n/)
    .map((l) => /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")]),
);
const env = { ...dotenv, ...process.env, NEXT_DIST_DIR: DIST, NEXT_OUTPUT: "standalone", SKIP_MIGRATIONS: "true", PORT: String(PORT), HOSTNAME: "127.0.0.1" };
const buildOnce = () => spawnSync("npm", ["run", "build"], { env, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
let b = buildOnce();
// The Next.js CLI sometimes stops once just to print an upgrade notice; running it again continues normally.
if (b.status !== 0 && /stopped to show the upgrade recommendation/.test(`${b.stdout}${b.stderr}`)) b = buildOnce();
check("standalone build succeeds", b.status === 0, b.status === 0 ? "" : `${b.stdout}\n${b.stderr}`.slice(-800));

const root = join(DIST, "standalone");
const assets = join(root, "src", "server", "invoices", "assets");
check("fonts + logo copied into the standalone server", ["NotoSans-Regular.ttf", "NotoSans-Bold.ttf", "logo.png"].every((f) => existsSync(join(assets, f))));
check("pdfkit shipped with the standalone server", existsSync(join(root, "node_modules", "pdfkit")));
// What a host does for any standalone deploy: static files next to the server.
cpSync(join(DIST, "static"), join(root, DIST, "static"), { recursive: true });

const db = await mysql.createConnection({ host: "localhost", user: "root", database: process.env.DB_NAME ?? "sindhu" });
const [[inv]] = await db.query("SELECT order_id, invoice_number FROM invoices ORDER BY id LIMIT 1");
let server = null;
let admin = null;
try {
  server = spawn("node", ["server.js"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  server.stdout.on("data", (d) => (log += d));
  server.stderr.on("data", (d) => (log += d));
  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try { up = (await fetch(`${BASE}/api/store/health`)).status === 200; } catch {}
  }
  check("standalone server starts", up, up ? "" : log.slice(-800));
  check("there is an invoice to download", Boolean(inv));
  admin = await createTestAdmin(db, BASE);
  const res = await fetch(`${BASE}/api/orders/${inv.order_id}/invoice/download`, { headers: { Cookie: admin.cookie } });
  const buf = Buffer.from(await res.arrayBuffer());
  check("standalone server renders the invoice PDF", res.status === 200 && res.headers.get("content-type") === "application/pdf" && buf.subarray(0, 5).toString() === "%PDF-" && /NotoSans/.test(buf.toString("latin1")), `status ${res.status}, ${buf.length} bytes ${res.status !== 200 ? buf.toString().slice(0, 300) + "\n" + log.slice(-800) : ""}`);
  check("same invoice number as before (nothing re-issued)", (await db.query("SELECT invoice_number n FROM invoices WHERE order_id = ?", [inv.order_id]))[0][0].n === inv.invoice_number);
} finally {
  if (admin) await admin.cleanup();
  if (server) spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { shell: true });
  await db.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
