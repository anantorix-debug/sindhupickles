// Applies database migrations safely. Used by `npm run build`, by app start-up and by `npm run migrate`.
//
// Guarantees:
//  * Each migration file runs ONCE; the database remembers it in `schema_migrations`. Re-running does nothing.
//  * Additive only. A migration that could change or remove existing data (DROP, TRUNCATE, DELETE, UPDATE,
//    RENAME, REPLACE, ALTER ... MODIFY/CHANGE/DROP) is refused unless its file name contains ".allow-data-change."
//    or ALLOW_DATA_CHANGING_MIGRATIONS=true is set. New tables, new columns and `INSERT IGNORE` seed rows are fine.
//  * Safe when several deploys or servers start at once: a database lock makes them take turns.
//  * Optional first admin: with INITIAL_ADMIN_EMAIL + INITIAL_ADMIN_PASSWORD set, that admin is created ONCE, and only if no
//    user exists at all. It is then marked done, so later deploys never touch accounts, passwords or emails.
import { createHash, randomBytes, scrypt } from "node:crypto";
import mysql from "mysql2/promise";

const LOCK_NAME = "sindhu_pickles_migrations";
const ADMIN_MARKER = "seed:initial-admin";
const CONNECTION_ERRORS = new Set([
  "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "ECONNRESET", "EHOSTUNREACH", "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR", "ER_DBACCESS_DENIED_ERROR",
]);

/** Short fingerprint of a migration (line endings ignored), to notice a file edited after it was applied. */
export const checksum = (sql) => createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);

/** Removes comments and string contents so the safety check only looks at real SQL keywords. */
function stripped(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/'(?:[^'\\]|\\.|'')*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/** Returns the reason a migration could change existing data, or null when it is purely additive. */
export function dataChangingReason(sql) {
  if (/ON\s+DUPLICATE\s+KEY\s+UPDATE/i.test(stripped(sql))) return "contains ON DUPLICATE KEY UPDATE (could overwrite existing rows)";
  for (const raw of stripped(sql).split(";")) {
    const stmt = raw.trim().replace(/\s+/g, " ");
    if (!stmt) continue;
    if (/^(DROP|TRUNCATE|RENAME|REPLACE)\b/i.test(stmt)) return `contains ${stmt.split(" ")[0].toUpperCase()}`;
    if (/^DELETE\b/i.test(stmt)) return "contains DELETE";
    if (/^UPDATE\b/i.test(stmt)) return "contains UPDATE";
    if (/^ALTER\b/i.test(stmt) && /\b(MODIFY|CHANGE|DROP|RENAME)\b/i.test(stmt)) return "alters or removes an existing column/table";
  }
  return null;
}

function connectionError(err) {
  const wrapped = new Error(`database not reachable (${err.code ?? err.message})`);
  wrapped.kind = "connection";
  wrapped.code = err.code;
  return wrapped;
}

const scryptHash = async (password) => {
  const salt = randomBytes(16);
  const key = await new Promise((res, rej) => scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
  return `s1$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
};

async function seedAdmin(conn, env, log) {
  const email = env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.INITIAL_ADMIN_PASSWORD;
  if (!email && !password) return null;
  if (!email || !password || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
    log.warn("[migrate] INITIAL_ADMIN_EMAIL / INITIAL_ADMIN_PASSWORD ignored: need a valid email and a password of 10+ characters");
    return null;
  }
  // One-time only. After the first successful run (or if any user already exists) this never does anything again,
  // so a password changed later, an email changed, or an account deleted is never undone by a redeploy.
  const [marker] = await conn.query("SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1", [ADMIN_MARKER]);
  if (marker.length) return "already-seeded";

  const [[count]] = await conn.query("SELECT COUNT(*) AS n FROM users");
  let outcome = "users-exist";
  if (Number(count.n) === 0) {
    await conn.query(
      "INSERT INTO users (email, password_hash, name, role, active) VALUES (?, ?, ?, 'OWNER', 1)",
      [email, await scryptHash(password), env.INITIAL_ADMIN_NAME?.trim() || "Owner"],
    );
    outcome = "created";
  }
  await conn.query("INSERT IGNORE INTO schema_migrations (name, checksum) VALUES (?, 'one-time-seed')", [ADMIN_MARKER]);
  return outcome;
}

/**
 * @param {{ migrations: {name: string, sql: string}[], env?: Record<string,string|undefined>, log?: Pick<Console,"info"|"warn">, lockWaitSeconds?: number }} opts
 * @returns {Promise<{ skipped?: string, applied: string[], alreadyApplied: number, changedAfterApplied: string[], admin: string | null }>}
 */
export async function runMigrations({ migrations, env = process.env, log = console, lockWaitSeconds = 60 }) {
  const result = { applied: [], alreadyApplied: 0, changedAfterApplied: [], admin: null };
  if (!env.DB_NAME || !env.DB_USER) return { ...result, skipped: "DB_NAME / DB_USER not set" };

  let conn;
  try {
    conn = await mysql.createConnection({
      host: env.DB_HOST || "localhost",
      port: Number(env.DB_PORT || 3306),
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD ?? "",
      multipleStatements: true,
      connectTimeout: 10_000,
    });
  } catch (err) {
    throw CONNECTION_ERRORS.has(err.code) ? connectionError(err) : err;
  }

  let locked = false;
  try {
    const [[lock]] = await conn.query("SELECT GET_LOCK(?, ?) AS got", [LOCK_NAME, lockWaitSeconds]);
    if (Number(lock.got) !== 1) return { ...result, skipped: "another process is migrating right now" };
    locked = true;

    await conn.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name       VARCHAR(190) NOT NULL,
         checksum   CHAR(16) NOT NULL,
         applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
         PRIMARY KEY (name)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
    const [doneRows] = await conn.query("SELECT name, checksum FROM schema_migrations");
    const done = new Map(doneRows.map((r) => [r.name, r.checksum]));

    for (const m of [...migrations].sort((a, b) => a.name.localeCompare(b.name))) {
      const sum = checksum(m.sql);
      if (done.has(m.name)) {
        result.alreadyApplied++;
        if (done.get(m.name) !== sum) result.changedAfterApplied.push(m.name);
        continue;
      }
      const reason = dataChangingReason(m.sql);
      if (reason && !m.name.includes(".allow-data-change.") && env.ALLOW_DATA_CHANGING_MIGRATIONS !== "true") {
        throw Object.assign(new Error(`migration ${m.name} refused: ${reason}. Migrations may only ADD things. Rename it to include ".allow-data-change." if you really mean it.`), { kind: "unsafe", migration: m.name });
      }
      try {
        await conn.query(m.sql);
      } catch (err) {
        throw Object.assign(new Error(`migration ${m.name} failed: ${err.message}`), { kind: "sql", migration: m.name, code: err.code });
      }
      await conn.query("INSERT IGNORE INTO schema_migrations (name, checksum) VALUES (?, ?)", [m.name, sum]);
      result.applied.push(m.name);
    }

    result.admin = await seedAdmin(conn, env, log);
    return result;
  } finally {
    if (locked) await conn.query("SELECT RELEASE_LOCK(?)", [LOCK_NAME]).catch(() => undefined);
    await conn.end().catch(() => undefined);
  }
}

/** One readable line for build/start-up logs. */
export function summarize(r) {
  if (r.skipped) return `[migrate] skipped: ${r.skipped}`;
  const parts = [r.applied.length ? `applied ${r.applied.join(", ")}` : "database already up to date", `${r.alreadyApplied} already applied`];
  if (r.admin === "created") parts.push("first admin created (one-time)");
  if (r.changedAfterApplied.length) parts.push(`WARNING: edited after being applied (not re-run): ${r.changedAfterApplied.join(", ")}`);
  return `[migrate] ${parts.join("; ")}`;
}
