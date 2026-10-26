import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { ChangePasswordInput, ProfileInput, RegisterInput, ResetPasswordInput } from "@/lib/validation/store";
import type { CustomerPreferences, CustomerProfile } from "@/types/store";
import { ApiError } from "@/server/http";
import { execute, iso, parseJson, query, transaction } from "@/server/db";
import { mailer } from "@/server/store/mailer";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/server/store/password";

const DEFAULT_PREFS: CustomerPreferences = { orderUpdates: true, offers: false };
const RESET_TTL_MS = 60 * 60 * 1000;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export async function getProfile(customerId: string): Promise<CustomerProfile | null> {
  const [r] = await query(
    `SELECT c.id, c.name, c.email, c.phone, c.created_at, cc.preferences
     FROM customers c LEFT JOIN customer_credentials cc ON cc.customer_id = c.id WHERE c.id = ? AND c.status = 'ACTIVE'`,
    [customerId],
  );
  if (!r) return null;
  return {
    id: String(r.id),
    name: r.name,
    email: r.email,
    phone: r.phone,
    createdAt: iso(r.created_at)!,
    preferences: { ...DEFAULT_PREFS, ...parseJson<Partial<typeof DEFAULT_PREFS>>(r.preferences, {}) },
  };
}

export async function register(input: RegisterInput): Promise<string> {
  const hash = await hashPassword(input.password);
  return transaction(async (conn) => {
    const [existing] = await conn.query<import("@/server/db").Row[]>("SELECT id FROM customers WHERE email = ? FOR UPDATE", [input.email]);
    if (existing[0]) {
      // Existing customers (e.g. from earlier orders) must prove email ownership via a reset link
      // before getting a password — otherwise anyone could claim their order history.
      throw new ApiError(409, "An account with this email already exists. Sign in, or use “Forgot password” to set a password.", "email_taken", {
        email: "This email is already registered",
      });
    }
    const [res] = await conn.query<import("mysql2").ResultSetHeader>(
      "INSERT INTO customers (name, email, phone, status, created_at, updated_at) VALUES (?, ?, ?, 'ACTIVE', NOW(3), NOW(3))",
      [input.name, input.email, input.phone],
    );
    await conn.query("INSERT INTO customer_credentials (customer_id, password_hash, preferences) VALUES (?, ?, ?)", [
      res.insertId,
      hash,
      JSON.stringify(DEFAULT_PREFS),
    ]);
    return String(res.insertId);
  });
}

export async function login(email: string, password: string): Promise<string> {
  const [r] = await query(
    `SELECT c.id, c.status, cc.password_hash FROM customers c
     LEFT JOIN customer_credentials cc ON cc.customer_id = c.id WHERE c.email = ?`,
    [email],
  );
  // Always run a hash comparison so timing doesn't reveal whether the account exists.
  const ok = await verifyPassword(password, r?.password_hash ?? DUMMY_HASH);
  if (!r || !r.password_hash || !ok || r.status !== "ACTIVE") {
    throw new ApiError(401, "Incorrect email or password", "invalid_credentials");
  }
  return String(r.id);
}

export async function updateProfile(customerId: string, input: ProfileInput): Promise<void> {
  await execute("UPDATE customers SET name = ?, phone = ?, updated_at = NOW(3) WHERE id = ?", [input.name, input.phone, customerId]);
}

export async function changePassword(customerId: string, input: ChangePasswordInput): Promise<void> {
  const [r] = await query("SELECT password_hash FROM customer_credentials WHERE customer_id = ?", [customerId]);
  if (!r || !(await verifyPassword(input.currentPassword, r.password_hash))) {
    throw new ApiError(422, "Your current password is incorrect", "bad_password", { currentPassword: "Incorrect password" });
  }
  await execute("UPDATE customer_credentials SET password_hash = ? WHERE customer_id = ?", [await hashPassword(input.newPassword), customerId]);
}

/**
 * Shop owner sets a new password for a customer from Admin -> Customers (the customer contacted the shop and the owner
 * checked it is really them). Any unused email reset links for that customer stop working.
 */
export async function adminSetPassword(customerId: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await transaction(async (conn) => {
    const [c] = await conn.query<import("@/server/db").Row[]>("SELECT id FROM customers WHERE id = ? FOR UPDATE", [customerId]);
    if (!c[0]) throw new ApiError(404, "Customer not found", "not_found");
    await conn.query(
      "INSERT INTO customer_credentials (customer_id, password_hash, preferences) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)",
      [customerId, hash, JSON.stringify(DEFAULT_PREFS)],
    );
    await conn.query("DELETE FROM password_resets WHERE customer_id = ?", [customerId]);
  });
}

export async function updatePreferences(customerId: string, prefs: CustomerPreferences): Promise<void> {
  await execute("UPDATE customer_credentials SET preferences = ? WHERE customer_id = ?", [JSON.stringify(prefs), customerId]);
}

/** Always resolves the same way, whether or not the email exists, so it can't be used to probe accounts. */
export async function requestPasswordReset(email: string): Promise<void> {
  const [c] = await query("SELECT id, name FROM customers WHERE email = ? AND status = 'ACTIVE'", [email]);
  if (!c) return;
  const token = randomBytes(32).toString("base64url");
  await transaction(async (conn) => {
    await conn.query("UPDATE password_resets SET used_at = NOW(3) WHERE customer_id = ? AND used_at IS NULL", [c.id]);
    await conn.query("INSERT INTO password_resets (customer_id, token_hash, expires_at) VALUES (?, ?, ?)", [
      c.id,
      sha256(token),
      new Date(Date.now() + RESET_TTL_MS),
    ]);
  });
  try {
    await mailer.send({
      to: email,
      subject: "Reset your Sindhu's Pickles password",
      text: `Hi ${c.name},\n\nUse this link to set a new password (valid for 1 hour):\n${siteUrl()}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
    });
  } catch (err) {
    // Same response whether or not the account exists: a mail outage must not reveal which emails are registered.
    console.error("[auth] password-reset email failed", err);
  }
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const hash = await hashPassword(input.password);
  await transaction(async (conn) => {
    const [rows] = await conn.query<import("@/server/db").Row[]>(
      "SELECT id, customer_id FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW(3) FOR UPDATE",
      [sha256(input.token)],
    );
    const reset = rows[0];
    if (!reset) throw new ApiError(400, "This reset link is invalid or has expired. Please request a new one.", "bad_token");
    await conn.query(
      `INSERT INTO customer_credentials (customer_id, password_hash, preferences) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [reset.customer_id, hash, JSON.stringify(DEFAULT_PREFS)],
    );
    await conn.query("UPDATE password_resets SET used_at = NOW(3) WHERE id = ?", [reset.id]);
  });
}
