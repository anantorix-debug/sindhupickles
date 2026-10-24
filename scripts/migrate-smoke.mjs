// Tests the migration system on a THROWAWAY database (zz_migrate_test), which is created and dropped here.
// It never touches the real shop database. Needs a local MySQL where root has no password (same as the other scripts).
import mysql from "mysql2/promise";
import { dataChangingReason, runMigrations } from "./migrate-runner.mjs";
import { migrations } from "./migrations.generated.mjs";

const DB = "zz_migrate_test";
let failed = 0;
const check = (name, ok, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
};
const quiet = { info() {}, warn() {} };

const root = await mysql.createConnection({ host: "localhost", user: "root", multipleStatements: true });
const env = { DB_HOST: "localhost", DB_PORT: "3306", DB_NAME: DB, DB_USER: "root", DB_PASSWORD: "" };
const run = (extra = {}, list = migrations, e = env) => runMigrations({ migrations: list, env: { ...e, ...extra }, log: quiet });
const fresh = async () => {
  await root.query(`DROP DATABASE IF EXISTS ${DB}; CREATE DATABASE ${DB} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query(`USE ${DB}`);
};
const one = async (sql, p = []) => (await root.query(sql, p))[0][0];
const tables = async () => (await root.query("SHOW TABLES"))[0].length;
const adminHash = async (email) => (await one("SELECT password_hash h FROM users WHERE email = ?", [email]))?.h;

try {
  // ---------- 1. brand-new empty database
  await fresh();
  const r1 = await run();
  check("empty database: base schema applied", r1.applied.join(",") === "000_base_schema.sql" && r1.alreadyApplied === 0, r1.applied.join(","));
  check("all 30 tables + the migration ledger exist", (await tables()) === 31);
  check("no starter data is inserted (categories, coupons, counters, users all empty)", [(await one("SELECT COUNT(*) n FROM categories")).n, (await one("SELECT COUNT(*) n FROM coupons")).n, (await one("SELECT COUNT(*) n FROM counters")).n, (await one("SELECT COUNT(*) n FROM users")).n].every((n) => n === 0));

  // ---------- 2. running again is a no-op
  const r2 = await run();
  check("second run applies nothing", r2.applied.length === 0 && r2.alreadyApplied === 1);

  // ---------- 3. a LIVE database that already has data (set up by hand, no ledger): nothing is touched
  await root.query("INSERT INTO counters (name, value) VALUES ('order_number', 1500)");
  await root.query("INSERT INTO coupons (code, type, value, description) VALUES ('SINDHU05', 'PERCENT', 10, 'edited by owner')");
  await root.query("INSERT INTO categories (name, slug, position, active) VALUES ('Owner Category', 'owner-category', 1, 1)");
  await root.query("INSERT INTO customers (name, email, phone) VALUES ('Real Customer', 'real@example.com', '9876543210')");
  await root.query("INSERT INTO users (email, password_hash, name, role) VALUES ('boss@example.com', 'owner-chosen-hash', 'Boss', 'OWNER')");
  await root.query("DROP TABLE schema_migrations"); // simulates a database created before the ledger existed
  const r3 = await run();
  check("legacy database: base schema re-run safely", r3.applied.length === 1);
  check("order counter, coupon, category, customer and admin all untouched", Number((await one("SELECT value FROM counters WHERE name='order_number'")).value) === 1500 && Number((await one("SELECT value FROM coupons WHERE code='SINDHU05'")).value) === 10 && (await one("SELECT COUNT(*) n FROM categories")).n === 1 && (await one("SELECT COUNT(*) n FROM customers")).n === 1 && (await adminHash("boss@example.com")) === "owner-chosen-hash");

  // ---------- 4. a future migration: new table + new column, applied once, existing data untouched
  const future = [
    ...migrations,
    { name: "001_add_wishlist.sql", sql: "CREATE TABLE IF NOT EXISTS wishlist_items (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, customer_id BIGINT UNSIGNED NOT NULL, note VARCHAR(100)) ENGINE=InnoDB;\nALTER TABLE customers ADD COLUMN nickname VARCHAR(60) NULL;" },
  ];
  const r4 = await run({}, future);
  check("new migration applied once", r4.applied.join(",") === "001_add_wishlist.sql");
  check("new table and column exist", (await tables()) === 32 && (await root.query("SHOW COLUMNS FROM customers LIKE 'nickname'"))[0].length === 1);
  check("existing customer and admin untouched by it", (await one("SELECT name FROM customers WHERE email='real@example.com'")).name === "Real Customer" && (await adminHash("boss@example.com")) === "owner-chosen-hash");
  check("rerunning it is a no-op", (await run({}, future)).applied.length === 0);

  // ---------- 5. dangerous migrations are refused and do not run
  const bad = {
    "DROP TABLE": "DROP TABLE customers;",
    "TRUNCATE": "TRUNCATE TABLE categories;",
    "DELETE": "DELETE FROM categories WHERE id > 0;",
    "UPDATE": "UPDATE categories SET active = 0;",
    "ALTER ... MODIFY": "ALTER TABLE customers MODIFY name VARCHAR(5);",
    "ALTER ... DROP COLUMN": "ALTER TABLE customers DROP COLUMN phone;",
    "RENAME TABLE": "RENAME TABLE customers TO customers_old;",
    "ON DUPLICATE KEY UPDATE": "INSERT INTO counters (name, value) VALUES ('order_number', 1) ON DUPLICATE KEY UPDATE value = 1;",
  };
  for (const [label, sql] of Object.entries(bad)) {
    let refused = false;
    try { await run({}, [...future, { name: "002_bad.sql", sql }]); } catch (e) { refused = e.kind === "unsafe"; }
    check(`refused: ${label}`, refused);
  }
  check("none of them ran: data intact", (await one("SELECT COUNT(*) n FROM customers")).n === 1 && (await one("SELECT COUNT(*) n FROM categories WHERE active = 1")).n === 1 && Number((await one("SELECT value FROM counters WHERE name='order_number'")).value) === 1500);
  check("a refused migration is not recorded as applied", (await one("SELECT COUNT(*) n FROM schema_migrations WHERE name='002_bad.sql'")).n === 0);
  check("additive SQL passes the guard (CREATE, ADD COLUMN, INSERT IGNORE, comments, text containing DROP/DELETE)", ["CREATE TABLE IF NOT EXISTS t (a INT);", "ALTER TABLE customers ADD COLUMN x INT;", "INSERT IGNORE INTO counters VALUES ('a', 1);", "-- DROP TABLE x\nSELECT 1;", "INSERT IGNORE INTO coupons (code, type, value, description) VALUES ('X','FLAT',1,'please DELETE me later');"].every((q) => dataChangingReason(q) === null));
  const allowed = await run({}, [...future, { name: "002_cleanup.allow-data-change.sql", sql: "UPDATE categories SET position = position;" }]);
  check("an explicitly marked .allow-data-change. migration is allowed", allowed.applied.join(",") === "002_cleanup.allow-data-change.sql");

  // ---------- 6. a failing migration stops with its name and is retried next time
  let sqlErr = null;
  try { await run({}, [...future, { name: "003_typo.sql", sql: "CREATE TABEL nope (a INT);" }]); } catch (e) { sqlErr = e; }
  check("SQL error: reported with the file name", sqlErr?.kind === "sql" && sqlErr.migration === "003_typo.sql");
  check("SQL error: not recorded, will be retried", (await one("SELECT COUNT(*) n FROM schema_migrations WHERE name='003_typo.sql'")).n === 0);

  // ---------- 7. a migration file edited after it was applied is noticed but not re-run
  const edited = migrations.map((m) => ({ ...m, sql: m.sql + "\n-- edited" }));
  const r7 = await run({}, edited);
  check("edited-after-applied is flagged, not re-run", r7.changedAfterApplied.join(",") === "000_base_schema.sql" && r7.applied.length === 0);

  // ---------- 8. several deploys/servers at the same moment
  await fresh();
  const results = await Promise.allSettled(Array.from({ length: 5 }, () => run()));
  check("5 simultaneous runs: none crashed", results.every((x) => x.status === "fulfilled"), results.filter((x) => x.status === "rejected").map((x) => x.reason?.message).join(" | "));
  const appliedBy = results.filter((x) => x.status === "fulfilled" && x.value.applied.length).length;
  check("5 simultaneous runs: the schema was applied exactly once", appliedBy === 1 && (await tables()) === 31);

  // ---------- 9. first admin: seeded ONCE, then never touched by any later deploy
  await fresh();
  const adminEnv = { INITIAL_ADMIN_EMAIL: "Owner@Example.com", INITIAL_ADMIN_PASSWORD: "a-long-first-password", INITIAL_ADMIN_NAME: "Owner One" };
  const a1 = await run(adminEnv);
  check("first deploy creates the admin (email lower-cased, role OWNER)", a1.admin === "created" && (await one("SELECT role, active, name FROM users WHERE email='owner@example.com'")).role === "OWNER");
  check("only the admin was seeded: no categories, coupons or counters", (await one("SELECT COUNT(*) n FROM users")).n === 1 && (await one("SELECT COUNT(*) n FROM categories")).n === 0 && (await one("SELECT COUNT(*) n FROM coupons")).n === 0 && (await one("SELECT COUNT(*) n FROM counters")).n === 0);
  const original = await adminHash("owner@example.com");
  const a2 = await run(adminEnv);
  check("next deploy, same settings: nothing changes", a2.admin === "already-seeded" && (await adminHash("owner@example.com")) === original);
  await root.query("UPDATE users SET password_hash = 'password-changed-by-owner-later' WHERE email='owner@example.com'");
  const a3 = await run({ ...adminEnv, INITIAL_ADMIN_PASSWORD: "some-other-env-password" });
  check("owner changed the password later: a redeploy does NOT reset it", a3.admin === "already-seeded" && (await adminHash("owner@example.com")) === "password-changed-by-owner-later");
  await root.query("UPDATE users SET email = 'renamed@example.com' WHERE email='owner@example.com'");
  await run(adminEnv);
  check("owner changed the email: no second admin appears", (await one("SELECT COUNT(*) n FROM users")).n === 1);
  await root.query("DELETE FROM users");
  await run(adminEnv);
  check("even if all users were deleted, the seed does not come back", (await one("SELECT COUNT(*) n FROM users")).n === 0);

  await fresh();
  await run();
  await root.query("INSERT INTO users (email, password_hash, name, role) VALUES ('manual@example.com', 'manually-created-hash', 'Manual', 'OWNER')");
  const a4 = await run(adminEnv);
  check("an admin created by hand first: the seed adds nothing", a4.admin === "users-exist" && (await one("SELECT COUNT(*) n FROM users")).n === 1 && (await adminHash("manual@example.com")) === "manually-created-hash");
  await fresh();
  const a5 = await run({ INITIAL_ADMIN_EMAIL: "short@example.com", INITIAL_ADMIN_PASSWORD: "short" });
  check("weak password: nothing created", a5.admin === null && (await one("SELECT COUNT(*) n FROM users")).n === 0);
  const a6 = await run();
  check("no admin settings at all: nothing created", a6.admin === null && (await one("SELECT COUNT(*) n FROM users")).n === 0);

  // ---------- 10. connection problems are reported as such (the build treats them as non-fatal)
  const codes = [];
  for (const badEnv of [{ DB_PORT: "1" }, { DB_PASSWORD: "definitely-wrong" }, { DB_NAME: "zz_does_not_exist" }]) {
    try { await run(badEnv); codes.push("no-error"); } catch (e) { codes.push(e.kind); }
  }
  check("dead port / wrong password / missing database -> 'connection' errors", codes.every((c) => c === "connection"), codes.join(","));
  check("no database settings -> skipped, not an error", (await run({}, migrations, {})).skipped !== undefined);
} finally {
  await root.query(`DROP DATABASE IF EXISTS ${DB}`);
  await root.end();
}
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
