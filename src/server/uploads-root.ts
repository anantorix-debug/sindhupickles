import path from "node:path";

/**
 * Where uploaded photos are stored. It must be ONE fixed folder that every deploy keeps.
 *  1. UPLOAD_DIR, when set, is used as is.
 *  2. Hostinger "Web Apps" runs each deploy from a brand-new folder `<site>/hbuilds/versions/<id>/...`. Photos saved
 *     next to the app would vanish on the next deploy, so they go to `<site>/uploads`, beside `hbuilds`, which no
 *     deploy replaces.
 *  3. Anywhere else (local development, a plain server): ./uploads in the app folder.
 */
export function resolveUploadsRoot(cwd: string = process.cwd(), env: Record<string, string | undefined> = process.env): { root: string; persistent: boolean } {
  if (env.UPLOAD_DIR) return { root: path.resolve(env.UPLOAD_DIR), persistent: true };
  const normal = cwd.replace(/\\/g, "/");
  const at = normal.indexOf("/hbuilds/versions/");
  if (at > 0) return { root: path.join(normal.slice(0, at), "uploads"), persistent: true };
  return { root: path.join(cwd, "uploads"), persistent: false };
}
