/**
 * The text of a caught error for a JSON response or a job report: its message
 * only, never the error object or its stack (which can carry file paths and
 * internals). Code scanning's js/stack-trace-exposure, 3 Oct 2026.
 */
export function errorText(e: unknown, max = 300): string {
  const text = e instanceof Error ? e.message : typeof e === "string" ? e : "unknown error";
  return text.slice(0, max);
}
