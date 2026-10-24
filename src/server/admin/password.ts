import "server-only";
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const MAXMEM = 256 * 1024 * 1024; // the existing hashes use N=65536, which needs ~64 MiB

const derive = (password: string, salt: Buffer, keylen: number, opts: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password, salt, keylen, { ...opts, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))));

const equal = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** Hash in this app's own format (used by `scripts/set-admin-password.mjs`). */
export async function hashAdminPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `s1$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

/**
 * Verifies against both formats found in `users.password_hash`:
 *  - `s1$N$r$p$saltHex$hashHex`   (this app)
 *  - `scrypt$N$r$p$salt$hashHex`  (the original backend's format). Its salt encoding isn't
 *    documented, so both the hex-decoded and the plain-text reading are tried.
 */
export async function verifyAdminPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hashHex] = stored.split("$");
  if ((scheme !== "s1" && scheme !== "scrypt") || !salt || !hashHex || !/^[0-9a-f]+$/i.test(hashHex)) return false;
  const expected = Buffer.from(hashHex, "hex");
  const opts = { N: Number(n), r: Number(r), p: Number(p) };
  if (!Number.isFinite(opts.N) || !Number.isFinite(opts.r) || !Number.isFinite(opts.p)) return false;

  const hexSalt = /^[0-9a-f]+$/i.test(salt) && salt.length % 2 === 0;
  const saltReadings = scheme === "s1" ? [Buffer.from(salt, "hex")] : hexSalt ? [Buffer.from(salt, "hex"), Buffer.from(salt, "utf8")] : [Buffer.from(salt, "utf8")];
  for (const s of saltReadings) {
    if (equal(await derive(password, s, expected.length, opts), expected)) return true;
  }
  return false;
}

export const DUMMY_ADMIN_HASH = "s1$16384$8$1$00000000000000000000000000000000$" + "00".repeat(64);
