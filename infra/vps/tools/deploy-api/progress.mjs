// Build progress for the admin panel (see server.mjs). Kept apart so it can be tested
// without starting the server.

/**
 * Where a build is and how long it has left, from its log: the app build first, then
 * the page prerender ("Saved <file> (n/total) t=<ms>"), then publishing (deploy-site,
 * which writes no log of its own). Rate comes from the timestamped Saved lines; a log
 * from before they carried t= falls back to the start time in the file name.
 */
export function buildProgress(text, startedAt, now = Date.now(), running = true) {
  const saved = [...text.matchAll(/\((\d+)\/(\d+)\)(?: t=(\d+))?/g)];
  const last = saved.at(-1);
  const done = last ? Number(last[1]) : 0;
  const total = last ? Number(last[2]) : null;
  const finishedPrerender = /Prerendering completed successfully/.test(text);
  const phase = !running ? "finished" : finishedPrerender ? "publishing" : last ? "rendering pages" : /Prerendering|Static server running/.test(text) ? "rendering pages" : "building the app";
  const timed = saved.filter((m) => m[3]);
  let ratePerMin = null;
  if (timed.length >= 2) {
    const a = timed[0], b = timed.at(-1);
    const minutes = (Number(b[3]) - Number(a[3])) / 60000;
    if (minutes > 0.5) ratePerMin = (Number(b[1]) - Number(a[1])) / minutes;
  } else if (done > 0 && startedAt) {
    const minutes = (now - startedAt) / 60000 - 3; // the app build takes about 3 minutes
    if (minutes > 1) ratePerMin = done / minutes;
  }
  const left = total !== null ? total - done : null;
  // Publishing (copying, compressing, checks) runs after the last page: about 4 minutes.
  const etaSec = phase === "rendering pages" && ratePerMin && left !== null ? Math.round((left / ratePerMin) * 60 + 240) : phase === "publishing" ? 240 : null;
  return {
    phase, done, total, startedAt, elapsedSec: startedAt ? Math.round((now - startedAt) / 1000) : null,
    ratePerMin: ratePerMin !== null ? Math.round(ratePerMin * 10) / 10 : null,
    etaSec, finishAt: etaSec !== null ? new Date(now + etaSec * 1000).toISOString() : null,
  };
}
