/**
 * Runs once when the server starts. It applies any database migrations the build could not (for example when
 * the build machine has no access to the database). Safe on every start: already-applied migrations are skipped
 * and existing data is never touched (see scripts/migrate-runner.mjs). A failure is logged but never stops the site.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.SKIP_MIGRATIONS === "true") return;

  try {
    const [{ runMigrations, summarize }, { migrations }] = await Promise.all([
      import("../scripts/migrate-runner.mjs"),
      import("../scripts/migrations.generated.mjs"),
    ]);
    console.info(summarize(await runMigrations({ migrations })));
  } catch (err) {
    console.error("[migrate] could not run migrations at start-up:", err instanceof Error ? err.message : err);
  }
}
