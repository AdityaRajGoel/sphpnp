/**
 * Sync run observation: one row per invocation, opened before the work and
 * closed after it.
 *
 * The ordering is the design. A summary written only at the end cannot survive
 * the run being killed - which is exactly what happened when a fundamentals
 * batch hit WORKER_RESOURCE_LIMIT after writing 176 rows and left no trace that
 * it had ever started. Opening the row first means a crash leaves
 * status='running' with a null finished_at, and that unclosed row IS the alert.
 *
 * Every method swallows its own errors. Observability must never be able to
 * fail the job it observes: a sync that dies because its logging table is
 * unreachable is strictly worse than a sync with a gap in its log.
 */
export type SupabaseLike = {
  from: (table: string) => {
    insert: (rows: unknown) => Promise<{ error: { message: string } | null }>;
    update: (values: unknown) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };
};

const TABLE = "sync_observations";

export class SyncObservation {
  readonly runId: string;
  private readonly writes: Record<string, number> = {};
  private readonly failures: Record<string, number> = {};
  private opened = false;
  /**
   * What open() recorded, kept so close() can merge rather than replace.
   *
   * `detail` is a single jsonb column, so writing it at close overwrote the
   * open-time context wholesale - losing `batch`, the list of symbols the run
   * was working on. That is the one field an unclosed row exists to preserve:
   * knowing a run died is far less useful than knowing what it died holding.
   */
  private openDetail: Record<string, unknown> = {};

  constructor(
    private readonly supabase: SupabaseLike,
    private readonly job: string,
  ) {
    this.runId = crypto.randomUUID();
  }

  /** Opens the row. Call before any work, so a kill mid-run is still visible. */
  async open(detail: Record<string, unknown> = {}): Promise<void> {
    this.openDetail = detail;
    const { error } = await this.supabase.from(TABLE).insert({
      job: this.job,
      run_id: this.runId,
      status: "running",
      detail,
    });
    // Logged, never thrown - see the class comment.
    if (error) console.error(`observation open failed for ${this.job}:`, error.message);
    else this.opened = true;
  }

  /** Records rows actually written to a table. Counts, not booleans. */
  recordWrite(table: string, rows = 1): void {
    if (rows <= 0) return;
    this.writes[table] = (this.writes[table] ?? 0) + rows;
  }

  /**
   * Records a failure by kind ("registry", "parse", "cursor"). Kept separate
   * from writes so a partial run is not flattened into one verdict - the
   * distinction between "wrote nothing because NSE refused us" and "wrote
   * nothing because there was nothing to write" is the whole point.
   */
  recordFailure(kind: string, count = 1): void {
    if (count <= 0) return;
    this.failures[kind] = (this.failures[kind] ?? 0) + count;
  }

  /** True when nothing was written - the shape both prior incidents took. */
  get wroteNothing(): boolean {
    return Object.keys(this.writes).length === 0;
  }

  /** Closes the row. Safe to call when open() failed; it simply no-ops. */
  async close(
    outcome: { status?: "ok" | "failed"; error?: string; detail?: Record<string, unknown> } = {},
  ): Promise<void> {
    if (!this.opened) return;
    const status =
      outcome.status ?? (Object.keys(this.failures).length > 0 || outcome.error ? "failed" : "ok");
    const { error } = await this.supabase
      .from(TABLE)
      .update({
        finished_at: new Date().toISOString(),
        status,
        writes: this.writes,
        failures: this.failures,
        // Merged, not replaced. `detail` is one jsonb column, so assigning the
        // close-time object alone discarded everything open() had recorded.
        // Close-time keys win on collision; open-time context survives.
        detail: { ...this.openDetail, ...(outcome.detail ?? {}) },
        ...(outcome.error ? { error: outcome.error.slice(0, 2000) } : {}),
      })
      .eq("job", this.job)
      .eq("run_id", this.runId);
    if (error) console.error(`observation close failed for ${this.job}:`, error.message);
  }
}
