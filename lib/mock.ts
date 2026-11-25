/** Fake Follow Up Boss account for local testing (FUB_MOCK=1). No real data. */
const AGENTS = [
  { id: 1, name: "Avery Stone" }, { id: 2, name: "Blake Rivers" }, { id: 3, name: "Casey Lane" },
  { id: 4, name: "Devon Hart" }, { id: 5, name: "Emery Cole" }, { id: 6, name: "Finley Brooks" },
];
const STAGES = ["Lead", "Lead", "Lead", "Hot Prospect", "Nurture", "Nurture", "Active Client", "Past Client", "Closed", "Sphere", "Trash", ""];
const SOURCES = ["Website", "Facebook", "Google Ads", "Referral", "Open House", "", "MyValue"];

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d+Z$/, "Z");

export const mockWrites: { url: string; body: unknown }[] = [];
const TOTAL = 1234;

function person(i: number, now: number) {
  const r = rng(i * 7919 + 13);
  const day = 86400000;
  const recent = i <= 60; // newest 60 arrived in the last week
  const created = recent ? now - Math.floor(r() * 7 * day) - 20 * 60000 : now - Math.floor((8 + r() * 700) * day);
  const agent = AGENTS[Math.floor(r() * AGENTS.length)];
  const inPond = r() < 0.06;
  const unassigned = !inPond && r() < 0.02;
  const contacted = r() < 0.78;
  const lastContact = contacted ? Math.min(now - 3600000, created + Math.floor(r() * (now - created))) : null;
  const dup = i % 97 === 0;
  const base = dup ? i - 1 : i;
  const hasEmail = r() < 0.9;
  const hasPhone = r() < 0.85;
  return {
    id: 100000 + (TOTAL - i),
    created: iso(created),
    updated: iso(now),
    createdVia: r() < 0.1 ? "Import" : "API",
    name: `Sample Person ${String(i).padStart(4, "0")}`,
    stage: STAGES[Math.floor(r() * STAGES.length)],
    source: SOURCES[Math.floor(r() * SOURCES.length)],
    assignedUserId: inPond || unassigned ? null : agent.id,
    assignedTo: inPond || unassigned ? "" : agent.name,
    assignedPondId: inPond ? 9 : null,
    lastActivity: iso(lastContact ?? created),
    lastCommunication: lastContact ? iso(lastContact) : null,
    lastCall: lastContact && r() < 0.5 ? iso(lastContact) : null,
    emails: hasEmail ? [{ value: `person${base}@example.com` }] : [],
    phones: hasPhone ? [{ value: `905-555-${String(1000 + (base % 9000)).padStart(4, "0")}` }] : [],
    tags: [],
  };
}

export async function mockFetch(url: string, init?: { method?: string; body?: unknown }): Promise<unknown> {
  const delay = Number(process.env.FUB_MOCK_DELAY ?? 0);
  if (delay) await new Promise((r) => setTimeout(r, delay));
  const u = new URL(url);
  const now = Date.now();
  if ((init?.method ?? "GET") !== "GET") {
    mockWrites.push({ url: u.pathname, body: init?.body });
    return {};
  }
  if (u.pathname.endsWith("/users")) return { _metadata: { total: AGENTS.length, nextLink: null }, users: AGENTS };
  if (u.pathname.endsWith("/people")) {
    const limit = Number(u.searchParams.get("limit") ?? 10);
    const offset = Number(u.searchParams.get("offset") ?? 0);
    const people = [];
    for (let i = offset + 1; i <= Math.min(TOTAL, offset + limit); i++) people.push(person(i, now));
    const nextOffset = offset + limit;
    const next = new URL(url);
    next.searchParams.set("offset", String(nextOffset));
    return { _metadata: { total: TOTAL, nextLink: nextOffset < TOTAL ? next.toString() : null }, people };
  }
  const pid = Number(u.searchParams.get("personId") ?? 0);
  const i = TOTAL - (pid - 100000);
  const p = person(i, now);
  const r = rng(pid);
  const roll = r();
  const first = new Date(p.created).getTime() + (roll < 0.4 ? 2 : roll < 0.7 ? 45 : 600) * 60000;
  if (u.pathname.endsWith("/calls")) {
    const has = roll < 0.75 && first < now;
    return { _metadata: { nextLink: null }, calls: has ? [{ id: pid, created: iso(first), personId: pid, userId: p.assignedUserId, isIncoming: false, duration: 40 }] : [] };
  }
  if (u.pathname.endsWith("/textMessages")) return { _metadata: { nextLink: null }, textmessages: [] };
  return {};
}
