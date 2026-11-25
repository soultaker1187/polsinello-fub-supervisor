process.env.FUB_MOCK = "1";
process.env.FUB_MOCK_DELAY = "250";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
async function main() {
  rmSync(".data", { recursive: true, force: true });
  const { tick, getReport } = await import("../lib/scan");
  let s: any, steps = 0; const phases: string[] = [];
  do { s = await tick(15900, { force: steps === 0 }); phases.push(`${s.phase}:${s.count}`); steps++; } while (!["done", "error"].includes(s.phase) && steps < 80);
  assert.equal(s.phase, "done", s.error);
  const r = (await getReport())!;
  assert.equal(r.totals.people, 1234);
  assert.equal(new Set(r.neglected.map((x) => x.id)).size, r.neglected.length);
  console.log("resumed across", steps, "steps:", phases.join(" > "));
  rmSync(".data", { recursive: true, force: true });
}
main().catch((e) => { console.error(e); process.exit(1); });
