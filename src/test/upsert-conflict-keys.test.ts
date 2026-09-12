import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/*
 * Every `.upsert(..., { onConflict })` in an edge function must name a unique
 * key the schema actually has.
 *
 * Postgres resolves ON CONFLICT (cols) by finding a unique index over exactly
 * that set of columns. When there is none it rejects the whole statement with
 * "there is no unique or exclusion constraint matching the ON CONFLICT
 * specification" - and postgrest-js RESOLVES with that error rather than
 * throwing, so the write path dies quietly.
 *
 * This has happened twice. 20260910020000_income_source_key.sql moved `source`
 * into fundamentals_income's key; sync-fundamentals-yahoo was updated to match
 * and sync-fundamentals was not, so every NSE income write failed from the next
 * hourly run on. Earlier, a `create table if not exists` for a name that was
 * already taken made a whole table's key imaginary. Both are visible from the
 * source alone, so they are checked here rather than discovered in production.
 */

// Repo-root-relative: vitest runs from the project root (see ipo-reconcile.test.ts).
const ROOT = ".";
const MIGRATIONS = join(ROOT, "supabase", "migrations");
const FUNCTIONS = join(ROOT, "supabase", "functions");

type Key = { name: string; columns: string[] };

const norm = (cols: string[]) => [...cols].map((c) => c.trim().replace(/"/g, "").toLowerCase()).sort().join(",");
const bare = (name: string) => name.replace(/^public\./i, "").replace(/"/g, "").toLowerCase();
/** Postgres' default name for an unnamed constraint, truncated like NAMEDATALEN. */
const defaultName = (table: string, cols: string[], suffix: string) =>
  `${table}_${cols.join("_")}_${suffix}`.slice(0, 63);

/** Splits on commas that are not inside parentheses. */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of body) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim());
}

/** The text between the parenthesis at `open` and its match. */
function balanced(text: string, open: number): string {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    if (text[i] === ")" && --depth === 0) return text.slice(open + 1, i);
  }
  throw new Error(`unbalanced parentheses from offset ${open}`);
}

const colList = (s: string) => s.split(",").map((c) => c.trim().replace(/"/g, "").toLowerCase());

/** Replays every migration in filename order and returns the unique keys each table ends with. */
export function uniqueKeysFromMigrations(sqlFiles: string[]): Map<string, Key[]> {
  const tables = new Map<string, Key[]>();

  for (const raw of sqlFiles) {
    const sql = raw
      .replace(/\$\$[\s\S]*?\$\$/g, "") // function bodies
      .replace(/--[^\n]*/g, "")
      // String literals, emptied but kept in place. A DEFAULT can legitimately
      // contain a semicolon or a bracket - stock_forecasts.disclaimer does -
      // and without this the split on ";" below cuts a statement in half and
      // the parenthesis matcher then fails on the fragment. Doubled quotes
      // ('') are Postgres' own escape and are consumed as part of the literal.
      .replace(/'(?:[^']|'')*'/g, "''");

    for (const statement of sql.split(";")) {
      const s = statement.trim();

      const create = /^create\s+table\s+(if\s+not\s+exists\s+)?([\w."]+)\s*\(/i.exec(s);
      if (create) {
        const table = bare(create[2]);
        // `create table if not exists` on a name that already exists is a no-op
        // in Postgres, so its keys must not be recorded either.
        if (create[1] && tables.has(table)) continue;
        const keys: Key[] = [];
        for (const element of splitTopLevel(balanced(s, create[0].length - 1))) {
          const tableLevel = /^(?:constraint\s+([\w"]+)\s+)?(unique|primary\s+key)\s*\(([^)]*)\)/i.exec(element);
          if (tableLevel) {
            const cols = colList(tableLevel[3]);
            const suffix = /primary/i.test(tableLevel[2]) ? "pkey" : "key";
            const name = tableLevel[1] ?? (suffix === "pkey" ? `${table}_pkey` : defaultName(table, cols, "key"));
            keys.push({ name: bare(name), columns: cols });
            continue;
          }
          if (/^(constraint|check|foreign\s+key|exclude)\b/i.test(element)) continue;
          const column = /^([\w"]+)\s/.exec(element);
          if (!column) continue;
          const col = bare(column[1]);
          if (/\bprimary\s+key\b/i.test(element)) keys.push({ name: `${table}_pkey`, columns: [col] });
          else if (/\bunique\b/i.test(element)) keys.push({ name: defaultName(table, [col], "key"), columns: [col] });
        }
        tables.set(table, keys);
        continue;
      }

      const alter = /^alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?([\w."]+)\s+([\s\S]*)$/i.exec(s);
      if (alter) {
        const table = bare(alter[1]);
        const keys = tables.get(table) ?? [];
        for (const action of splitTopLevel(alter[2])) {
          const add = /^add\s+constraint\s+([\w"]+)\s+(unique|primary\s+key)\s*\(([^)]*)\)/i.exec(action);
          if (add) keys.push({ name: bare(add[1]), columns: colList(add[3]) });
          const drop = /^drop\s+constraint\s+(?:if\s+exists\s+)?([\w"]+)/i.exec(action);
          if (drop) {
            const name = bare(drop[1]);
            const i = keys.findIndex((k) => k.name === name);
            if (i !== -1) keys.splice(i, 1);
          }
        }
        tables.set(table, keys);
        continue;
      }

      const index = /^create\s+unique\s+index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?([\w"]+)\s+on\s+(?:only\s+)?([\w."]+)\s*(?:using\s+\w+\s*)?\(/i.exec(s);
      if (index) {
        const rest = s.slice(index[0].length - 1);
        const cols = colList(balanced(rest, 0));
        // A partial unique index cannot be inferred from a bare column list,
        // so PostgREST's onConflict can never use one.
        if (/\)\s*where\b/i.test(rest)) continue;
        const table = bare(index[2]);
        tables.set(table, [...(tables.get(table) ?? []), { name: bare(index[1]), columns: cols }]);
        continue;
      }

      const dropIndex = /^drop\s+index\s+(?:concurrently\s+)?(?:if\s+exists\s+)?([\w."]+)/i.exec(s);
      if (dropIndex) {
        const name = bare(dropIndex[1]);
        for (const keys of tables.values()) {
          const i = keys.findIndex((k) => k.name === name);
          if (i !== -1) keys.splice(i, 1);
        }
      }
    }
  }
  return tables;
}

type Upsert = { file: string; line: number; table: string; columns: string[] };

/** Pairs each onConflict with the nearest `.from("table")` before it. */
export function upsertsInSource(file: string, source: string): Upsert[] {
  const found: Upsert[] = [];
  const conflict = /onConflict:\s*["'`]([^"'`]+)["'`]/g;
  for (let m = conflict.exec(source); m; m = conflict.exec(source)) {
    const before = source.slice(0, m.index);
    const froms = [...before.matchAll(/\.from\(\s*["'`]([\w.]+)["'`]\s*\)/g)];
    const table = froms[froms.length - 1]?.[1];
    if (!table) throw new Error(`${file}: onConflict with no preceding .from()`);
    found.push({
      file,
      line: before.split("\n").length,
      table: bare(table),
      columns: colList(m[1]),
    });
  }
  return found;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("migration key replay", () => {
  it("records table-level, column-level and index keys", () => {
    const keys = uniqueKeysFromMigrations([
      `create table t (id bigint primary key, slug text not null unique, a int, b int, unique (a, b));
       create unique index t_ab_idx on public.t (b, a);`,
    ]);
    expect(keys.get("t")!.map((k) => norm(k.columns))).toEqual(["id", "slug", "a,b", "a,b"]);
  });

  it("forgets a constraint dropped by its default name", () => {
    const keys = uniqueKeysFromMigrations([
      "create table inc (symbol text, period_end date, unique (symbol, period_end));",
      "alter table public.inc drop constraint if exists inc_symbol_period_end_key;",
    ]);
    expect(keys.get("inc")).toEqual([]);
  });

  it("ignores a create-if-not-exists for a table that already exists", () => {
    const keys = uniqueKeysFromMigrations([
      "create table ca (company text, ex_date date, unique (company, ex_date));",
      "create table if not exists ca (symbol text, unique (symbol));",
    ]);
    expect(keys.get("ca")!.map((k) => norm(k.columns))).toEqual(["company,ex_date"]);
  });

  it("does not count a partial unique index", () => {
    const keys = uniqueKeysFromMigrations([
      "create table p (a int); create unique index p_a on p (a) where a > 0;",
    ]);
    expect(keys.get("p")).toEqual([]);
  });
});

describe("edge function upserts", () => {
  const migrationFiles = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"));
  const keys = uniqueKeysFromMigrations(migrationFiles);

  const upserts = walk(FUNCTIONS).flatMap((path) =>
    upsertsInSource(path.replace(/^\.\//, ""), readFileSync(path, "utf8")),
  );

  it("finds the upserts it is meant to police", () => {
    // A regex that silently stopped matching would pass every check below.
    expect(upserts.length).toBeGreaterThanOrEqual(20);
  });

  it.each(upserts.map((u) => [`${u.file}:${u.line} ${u.table}(${u.columns.join(",")})`, u] as const))(
    "%s names an existing unique key",
    (_label, u) => {
      const tableKeys = keys.get(u.table);
      expect(tableKeys, `no migration creates ${u.table}`).toBeDefined();
      expect(tableKeys!.map((k) => norm(k.columns))).toContain(norm(u.columns));
    },
  );
});
