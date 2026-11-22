// Generates FAKE 90-day history so the UI has something to show.
// Run `npm run check` afterwards to overwrite "current" with real status.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const config = JSON.parse(readFileSync("config.json", "utf8"));
const data = { updated: new Date().toISOString(), services: {} };

for (const svc of config.services) {
  const days = {};
  for (let i = 89; i >= 0; i--) {
    const k = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
    const total = 288;
    const r = Math.random();
    let ok = total, slow = 0;
    if (r < 0.03) ok = Math.round(total * 0.5);
    else if (r < 0.08) { ok = Math.round(total * 0.97); slow = 20; }
    days[k] = { total, ok, slow, ms: ok * (200 + Math.random() * 300) };
  }
  data.services[svc.id] = { days, current: { ok: true, ms: 250, code: 200, t: data.updated } };
}

mkdirSync("data", { recursive: true });
writeFileSync("data/status.json", JSON.stringify(data, null, 1));
console.log("seeded demo data");
