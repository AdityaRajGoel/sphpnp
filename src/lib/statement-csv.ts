import type { StatementGrid } from "@/lib/statements";

/**
 * Quote a CSV cell, and neutralise spreadsheet formula injection: a label
 * beginning with = + - @ would run as a formula when the file is opened in
 * Excel or Sheets, so it is prefixed with an apostrophe. Numbers are written
 * raw and never start with a formula character other than a minus sign.
 */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One statement as CSV, oldest period first, figures in rupees crore as stored. */
export function statementToCsv(grid: StatementGrid): string {
  const header = ["Line item (Rs crore)", ...grid.periods].map(csvCell).join(",");
  const body = grid.rows.map((row) => [csvCell(row.label), ...grid.periods.map((_, i) => csvCell(row.values[i] ?? null))].join(","));
  return [header, ...body].join("\r\n");
}

export const statementFileName = (symbol: string, statement: string) =>
  `${symbol.toUpperCase().replace(/[^A-Z0-9&-]/g, "")}-${statement.replace(/[^a-z0-9_]/gi, "")}.csv`;

/** Save text as a file through a temporary object URL. */
export function downloadText(text: string, fileName: string, type = "text/csv;charset=utf-8") {
  // The BOM makes Excel read the rupee sign and Indian names as UTF-8.
  const url = URL.createObjectURL(new Blob(["﻿", text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
