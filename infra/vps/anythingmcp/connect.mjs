#!/usr/bin/env node
// Creates (or updates) the sphpnp database connector, its tools from tools.json, and
// the MCP server that exposes them. Safe to re-run: everything is matched by name.
//
//   read -rs pw && printf '%s' "$pw" | AMCP_EMAIL=you@example.com node connect.mjs; unset pw
//   ... node connect.mjs --new-key    also issues an MCP API key for the server (shown once)
//
// The admin password comes from stdin and the database password from .env, so neither
// reaches a command line. Reads .env and tools.json from this script's directory.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const API = (process.env.AMCP_API ?? "http://127.0.0.1:8461").replace(/\/$/, "");
const CONNECTOR = "sphpnp-market-data";
const SERVER = "sphpnp";
const INSTRUCTIONS =
  "Indian equity research data from www.sphpnp.com: IPOs with grey-market premium, SEBI " +
  "offer-document pipeline, company fundamentals, financial statements, a stock screener " +
  "and Kronos model forecast bands. Figures are as collected from public sources; GMP is " +
  "unofficial. Nothing here is investment advice; relay any disclaimer column verbatim.";

const env = Object.fromEntries(
  readFileSync(join(here, ".env"), "utf8")
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
const email = process.env.AMCP_EMAIL;
const password = readFileSync(0, "utf8").replace(/\r?\n$/, "");
if (!email || !password) throw new Error("set AMCP_EMAIL and pipe the admin password on stdin");
if (!env.MCP_READER_PASSWORD) throw new Error("MCP_READER_PASSWORD missing from .env - run setup.sh first");

async function call(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const list = (value) => (Array.isArray(value) ? value : (value?.data ?? value?.items ?? []));

const { accessToken: token } = await call("POST", "/api/auth/login", { email, password });

const connectorBody = {
  name: CONNECTOR,
  type: "DATABASE",
  // No credentials in the URL: they go in authConfig, which is encrypted at rest.
  baseUrl: "postgresql://supabase-db:5432/postgres",
  authType: "CONNECTION_STRING",
  authConfig: { username: "mcp_reader", password: env.MCP_READER_PASSWORD },
};
let connector = list(await call("GET", "/api/connectors", undefined, token)).find((c) => c.name === CONNECTOR);
if (connector) {
  // The type is fixed once created; the update endpoint rejects it.
  const { type: _type, ...update } = connectorBody;
  await call("PUT", `/api/connectors/${connector.id}`, update, token);
} else {
  connector = await call("POST", "/api/connectors", connectorBody, token);
}
console.log(`connector ${CONNECTOR}: ${connector.id}`);

const wanted = JSON.parse(readFileSync(join(here, "tools.json"), "utf8"));
const existing = list(await call("GET", `/api/connectors/${connector.id}/tools`, undefined, token));
for (const tool of wanted) {
  const found = existing.find((t) => t.name === tool.name);
  if (found) await call("PUT", `/api/connectors/${connector.id}/tools/${found.id}`, tool, token);
  else await call("POST", `/api/connectors/${connector.id}/tools`, tool, token);
  console.log(`  ${found ? "updated" : "created"} ${tool.name}`);
}

let server = list(await call("GET", "/api/mcp-servers", undefined, token)).find((s) => s.name === SERVER);
const serverBody = { name: SERVER, description: "sphpnp IPO and fundamentals data", instructions: INSTRUCTIONS };
server = server
  ? await call("PUT", `/api/mcp-servers/${server.id}`, serverBody, token)
  : await call("POST", "/api/mcp-servers", serverBody, token);
await call("PUT", `/api/mcp-servers/${server.id}/connectors`, { connectorIds: [connector.id] }, token);
console.log(`MCP server ${SERVER}: ${API}/mcp/${server.id}`);

if (process.argv.includes("--new-key")) {
  const key = await call("POST", "/api/mcp-keys", { name: `${SERVER} ${new Date().toISOString().slice(0, 10)}`, mcpServerId: server.id }, token);
  console.log(`MCP API key (shown once, send it as X-API-Key): ${key.key ?? key.apiKey ?? JSON.stringify(key)}`);
}
