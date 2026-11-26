process.env.FUB_MOCK = "1";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
async function main() {
  rmSync(".data", { recursive: true, force: true });
  const { tickActivity, getActivity } = await import("../lib/activity");
  let s: any, steps = 0;
  do { s = await tickActivity(16000, { force: steps === 0 }); steps++; } while (s.phase === "scanning" && steps < 40);
  assert.equal(s.phase, "done", s.error);
  const r = (await getActivity())!;
  assert.ok(r.days.length >= 7 && r.days.length <= 8);
  assert.ok(r.days[0].date > r.days[1].date);
  for (const d of r.days) {
    assert.ok(d.leads.length <= 25);
    for (let i = 1; i < d.leads.length; i++) assert.ok(d.leads[i - 1].events >= d.leads[i].events);
    assert.ok(d.leads.every((l) => l.name.startsWith("Sample Person") && !l.types.some(([t]) => t === "Unsubscribed")));
  }
  const expected = Math.floor((7 * 86400000) / (9 * 60000)) + 1;
  assert.ok(Math.abs(r.eventsRead - expected) <= 2, `${r.eventsRead} vs ${expected}`);
  assert.ok(r.regulars.length > 0, "mock has unclaimed regulars");
  assert.ok(r.regulars.every((x) => x.activeDays >= 3 && x.activeDays <= 7 && (x.heldBy === "Pond: Team Pond" || x.heldBy === "No one")));
  for (let i = 1; i < r.regulars.length; i++) assert.ok(r.regulars[i - 1].activeDays >= r.regulars[i].activeDays);
  console.log("unclaimed regulars:", r.regulars.length, "of", r.regularsChecked, "checked; top:", JSON.stringify({ ...r.regulars[0], name: "x" }));
  console.log("activity ok:", steps, "steps,", r.eventsRead, "events,", r.days.map((d) => `${d.date}:${d.activeLeads}`).join(" "));
  rmSync(".data", { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
