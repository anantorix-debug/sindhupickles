export interface Migration {
  name: string;
  sql: string;
}
export interface MigrationResult {
  skipped?: string;
  applied: string[];
  alreadyApplied: number;
  changedAfterApplied: string[];
  admin: string | null;
}
export function checksum(sql: string): string;
export function dataChangingReason(sql: string): string | null;
export function runMigrations(opts: {
  migrations: Migration[];
  env?: Record<string, string | undefined>;
  log?: Pick<Console, "info" | "warn">;
  lockWaitSeconds?: number;
}): Promise<MigrationResult>;
export function summarize(result: MigrationResult): string;
