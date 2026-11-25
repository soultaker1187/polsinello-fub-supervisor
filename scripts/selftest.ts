/* Runs the whole audit against the mock account and checks the results hang together. */
process.env.FUB_MOCK = "1";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";

async function main() {
  rmSync(".data", { recursive: true, force: true });
  const { tick, getReport, checkNewLeads, getAlerts } = await import("../lib/scan");
  const { clockStart, toMs } = await import("../lib/audit");
  const { mockWrites } = await import("../lib/mock");
  const { putJSON } = await import("../lib/store");
  const { DEFAULT_SETTINGS } = await import("../lib/config");

  // clock: 23:30 Toronto on 2026-11-24 starts at 08:00 next day; 10:00 starts immediately
  const late = Date.parse("2026-11-25T04:30:00Z");
  assert.equal(new Date(clockStart(late, 8, 21)).toISOString(), "2026-11-25T13:00:00.000Z");
  const early = Date.parse("2026-07-10T09:00:00Z"); // 05:00 EDT
  assert.equal(new Date(clockStart(early, 8, 21)).toISOString(), "2026-07-10T12:00:00.000Z");
  const mid = Date.parse("2026-11-25T15:00:00Z");
  assert.equal(clockStart(mid, 8, 21), mid);
  assert.equal(toMs("2016-11-23 01:02:03"), Date.parse("2016-11-23T01:02:03Z"));

  // tiny budget forces several resumable steps
  let s: any, steps = 0;
  do { s = await tick(16500, { force: steps === 0 }); steps++; } while (!["done", "error"].includes(s.phase) && steps < 60);
  assert.equal(s.phase, "done", s.error);
  const r = (await getReport())!;
  assert.equal(r.totals.people, 1234);
  assert.ok(r.totals.neglected > 0 && r.totals.neglected < r.totals.inScope);
  assert.equal(r.agents.reduce((a, b) => a + b.neglected, 0), r.totals.neglected);
  assert.ok(r.neglected.every((x) => x.days >= 14 && x.userId));
  assert.ok(r.neglected.every((x) => !["closed", "past client", "sphere", "trash"].includes(x.stage.toLowerCase())));
  assert.ok(r.totals.duplicateGroups > 0);
  assert.ok(r.newLeads.length > 0 && r.newLeads.every((l) => l.status !== "pending" || Date.now() - l.clockStart < 5 * 60000 + 60000));
  assert.equal(r.notes.mode, "preview");
  assert.ok(r.notes.planned > 0 && r.notes.planned <= 200);
  const perAgent = new Map<number, number>();
  for (const n of r.notes.items) perAgent.set(n.userId, (perAgent.get(n.userId) ?? 0) + 1);
  assert.ok([...perAgent.values()].every((n) => n <= 15));
  assert.equal(mockWrites.length, 0, "preview mode must not write to Follow Up Boss");
  console.log("preview run ok:", steps, "steps |", JSON.stringify(r.totals), "| planned notes", r.notes.planned, "| held", r.notes.heldBackByCaps);

  await checkNewLeads();
  assert.equal(mockWrites.length, 0, "preview new-lead check must not write");
  console.log("preview alerts:", (await getAlerts()).items.length);

  // live run: notes written, capped, and not repeated on the following run
  await putJSON("settings.json", { ...DEFAULT_SETTINGS, mode: "live", maxNotesPerRun: 12, maxNotesPerAgent: 3, alsoCreateTask: true });
  steps = 0;
  do { s = await tick(60000, { force: steps === 0 }); steps++; } while (!["done", "error"].includes(s.phase) && steps < 20);
  const live = (await getReport())!;
  assert.equal(live.notes.written, 12);
  assert.equal(mockWrites.filter((w) => w.url.endsWith("/notes")).length, 12);
  assert.equal(mockWrites.filter((w) => w.url.endsWith("/tasks")).length, 12);
  const firstIds = new Set(live.notes.items.map((i) => i.personId));
  steps = 0;
  do { s = await tick(60000, { force: steps === 0 }); steps++; } while (!["done", "error"].includes(s.phase) && steps < 20);
  const second = (await getReport())!;
  assert.ok(second.notes.items.every((i) => !firstIds.has(i.personId)), "a lead must not be noted twice inside the repeat window");
  console.log("live run ok: sample note =", JSON.stringify(mockWrites[0].body));
  rmSync(".data", { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
