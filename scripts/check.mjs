// Pings every service in config.json and folds the result into data/status.json
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const config = JSON.parse(readFileSync("config.json", "utf8"));
const FILE = "data/status.json";
const KEEP_DAYS = 90;
const TIMEOUT_MS = 10000;
const SLOW_MS = 3000; // slower than this counts as degraded

const data = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { services: {} };

async function ping(svc) {
  const start = Date.now();
  try {
    const res = await fetch(svc.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "hkl-status-checker" },
    });
    const ms = Date.now() - start;
    // Site is behind a bot challenge (e.g. Turnstile): a 403 challenge page still proves it is serving
    if (svc.challengeOk && res.status === 403) {
      const body = await res.text();
      if (body.includes("Verifying you are human")) return { ok: true, ms, code: 200 };
    }
    if (svc.expect) {
      const body = await res.text();
      if (!body.includes(svc.expect)) return { ok: false, ms, code: res.status };
    }
    return { ok: res.status < 400, ms, code: res.status };
  } catch {
    return { ok: false, ms: Date.now() - start, code: 0 };
  }
}

const now = new Date();
const day = now.toISOString().slice(0, 10);

await Promise.all(
  config.services.map(async (svc) => {
    const r = await ping(svc);
    const s = (data.services[svc.id] ??= { days: {} });
    s.current = { ...r, t: now.toISOString() };
    const d = (s.days[day] ??= { total: 0, ok: 0, slow: 0, ms: 0 });
    d.total++;
    if (r.ok) d.ok++;
    if (r.ok && r.ms > SLOW_MS) d.slow++;
    d.ms += r.ms;
    const keys = Object.keys(s.days).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete s.days[k];
    console.log(`${r.ok ? "UP  " : "DOWN"} ${svc.name} ${r.code} ${r.ms}ms`);
  })
);

data.updated = now.toISOString();
mkdirSync("data", { recursive: true });
writeFileSync(FILE, JSON.stringify(data, null, 1));
