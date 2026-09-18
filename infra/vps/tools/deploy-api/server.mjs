// Deployments API for the admin panel: list the built releases, switch the live one,
// and start a rebuild. Installed at /opt/sphpnp/deploy-api/server.mjs and run by
// sphpnp-deploy-api.service as the deploy user.
//
// Why a service at all: publishing is a symlink swap (jobs/deploy-site.sh) and
// /var/www/sphpnp is owned by deploy, so switching releases needs no root - but a static
// page cannot swap a symlink. This is the smallest thing that can, and it deliberately
// cannot do anything else: no shell, no docker socket, no arbitrary paths.
//
// Everything reaching it has already passed Authelia in nginx (admin.sphpnp.com), which
// also passes the signed-in name in X-Remote-User for the audit line.

import { createServer } from "node:http";
import { readdir, readlink, symlink, rename, rm, readFile, appendFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const run = promisify(execFile);

const PORT = 3009;
const HOST = "127.0.0.1";
const ROOT = "/var/www/sphpnp";
const RELEASES = path.join(ROOT, "releases");
const CURRENT = path.join(ROOT, "current");
const BUILD_SCRIPT = "/opt/sphpnp/jobs/build-site.sh";
const BUILD_LOCK = "/tmp/build-site.lock";
const BUILD_LOGS = "/opt/sphpnp/build-logs";
const TOOLS_ENV = "/opt/sphpnp-tools/.env";
const ORIGIN = "https://admin.sphpnp.com";
// Release directories are named by deploy-site.sh as date +%Y%m%d-%H%M%S. Anything that
// does not match this exactly is rejected before it is ever joined to a path.
const RELEASE_NAME = /^\d{8}-\d{6}$/;

const json = (res, status, body) => {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(text),
  });
  res.end(text);
};

/** The name Authelia authenticated, for the audit line. Never trusted for authorisation. */
const userOf = (req) => {
  const name = String(req.headers["x-remote-user"] || "").trim();
  return /^[A-Za-z0-9._-]{1,32}$/.test(name) ? name : "unknown";
};

async function audit(line) {
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" });
  const file = `/var/log/sphpnp-sync/${stamp.slice(0, 10)}.log`;
  await appendFile(file, `${stamp} deploy-api ${line}\n`).catch(() => {});
}

/** Alerts go to the same ntfy topic as every other job; failure to notify is not fatal. */
async function notify(title, message) {
  try {
    const env = await readFile(TOOLS_ENV, "utf8");
    const topic = env.match(/^NTFY_TOPIC=(.+)$/m)?.[1]?.trim();
    if (!topic) return;
    await fetch(`http://127.0.0.1:3005/${topic}`, {
      method: "POST",
      headers: { Title: title },
      body: message,
      signal: AbortSignal.timeout(8000),
    });
  } catch { /* the action already happened; an alert is a courtesy */ }
}

const currentRelease = async () => path.basename(await readlink(CURRENT).catch(() => ""));

async function listReleases() {
  const [entries, current] = await Promise.all([
    readdir(RELEASES, { withFileTypes: true }),
    currentRelease(),
  ]);
  const names = entries.filter((e) => e.isDirectory() && RELEASE_NAME.test(e.name))
    .map((e) => e.name).sort().reverse();

  return Promise.all(names.map(async (name) => {
    const dir = path.join(RELEASES, name);
    // find/du rather than a recursive walk in node: these directories hold ~2,400 files
    // each and this endpoint is polled by the dashboard.
    const [pages, size] = await Promise.all([
      run("find", [dir, "-name", "*.html"]).then((r) => r.stdout.split("\n").filter(Boolean).length).catch(() => null),
      run("du", ["-sb", dir]).then((r) => Number(r.stdout.split("\t")[0])).catch(() => null),
    ]);
    return {
      name,
      current: name === current,
      pages,
      bytes: size,
      // The directory name is the build time, in the server's timezone (IST).
      builtAt: `${name.slice(0, 4)}-${name.slice(4, 6)}-${name.slice(6, 8)} ${name.slice(9, 11)}:${name.slice(11, 13)}:${name.slice(13, 15)}`,
    };
  }));
}

async function switchTo(name, user) {
  if (!RELEASE_NAME.test(name)) return { status: 400, body: { error: "not a release name" } };
  // Must be a directory that actually exists in the releases folder: the regex alone
  // would still allow a name for a release that was trimmed away.
  const available = (await readdir(RELEASES, { withFileTypes: true }))
    .filter((e) => e.isDirectory()).map((e) => e.name);
  if (!available.includes(name)) return { status: 404, body: { error: "no such release" } };

  const from = await currentRelease();
  if (from === name) return { status: 200, body: { current: name, changed: false } };

  // The same atomic swap deploy-site.sh does: build the new link beside the old one and
  // rename over it, so no request ever sees a missing document root.
  const staging = path.join(ROOT, "current.new");
  await rm(staging, { force: true });
  await symlink(path.join(RELEASES, name), staging);
  await rename(staging, CURRENT);

  await audit(`switch ${from} -> ${name} by ${user}`);
  await notify("Live release switched", `${from} -> ${name} by ${user}`);
  return { status: 200, body: { current: name, previous: from, changed: true } };
}

async function buildRunning() {
  // pgrep, not a lock file: flock releases the lock when the build exits, but a stale
  // lock file always remains.
  return run("pgrep", ["-f", "build-site.sh"]).then(() => true).catch(() => false);
}

async function startBuild(user) {
  if (await buildRunning()) return { status: 409, body: { error: "a build is already running" } };
  // flock -n so this can never run alongside the 04:30 cron build; detached so the
  // request returns immediately and the build survives a restart of this service.
  const child = execFile("flock", ["-n", BUILD_LOCK, BUILD_SCRIPT], { detached: true, stdio: "ignore" });
  child.unref();
  await audit(`rebuild started by ${user}`);
  await notify("Site rebuild started", `Started from the admin panel by ${user}`);
  return { status: 202, body: { started: true } };
}

async function buildLog() {
  const files = await readdir(BUILD_LOGS).catch(() => []);
  const newest = files.filter((f) => f.endsWith(".log")).sort().pop();
  if (!newest) return { running: await buildRunning(), log: "" };
  const text = await readFile(path.join(BUILD_LOGS, newest), "utf8").catch(() => "");
  return { running: await buildRunning(), file: newest, log: text.split("\n").slice(-40).join("\n") };
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}`);

    if (req.method === "GET" && url.pathname === "/releases") return json(res, 200, { releases: await listReleases() });
    if (req.method === "GET" && url.pathname === "/build-log") return json(res, 200, await buildLog());

    if (req.method === "POST") {
      // A state-changing call must come from the panel itself. The session cookie alone
      // would let another site post here in the background; requiring our own Origin and
      // a JSON content type means a cross-site form cannot reach these handlers.
      if (req.headers.origin !== ORIGIN) return json(res, 403, { error: "bad origin" });
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
        return json(res, 415, { error: "send application/json" });
      }
      const user = userOf(req);
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4096) return json(res, 413, { error: "body too large" });
      }
      const parsed = body ? JSON.parse(body) : {};

      if (url.pathname === "/switch") {
        const result = await switchTo(String(parsed.release || ""), user);
        return json(res, result.status, result.body);
      }
      if (url.pathname === "/rebuild") {
        const result = await startBuild(user);
        return json(res, result.status, result.body);
      }
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    json(res, 500, { error: String(err?.message || err).slice(0, 200) });
  }
}).listen(PORT, HOST, () => console.log(`deploy-api listening on ${HOST}:${PORT}`));
