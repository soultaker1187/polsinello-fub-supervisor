import { getJSON, putJSON } from "./store";
import { fub, fubConfigured, getPonds, listPage } from "./fub";
import { clampSettings, isHoldingAccount, Settings } from "./config";
import { toMs, torontoDate } from "./audit";

const DAY = 86400000;
const DAYS = 7;
const TOP = 25;
const IGNORED = new Set(["Unsubscribed"]);

type Tally = { n: number; types: Record<string, number> };
export type ActivityState = {
  runId: string;
  phase: "scanning" | "done" | "error";
  nextLink: string | null;
  cutoff: number;
  scanned: number;
  pages: number;
  counts: Record<string, Record<string, Tally>>; // day -> personId -> tally
  startedAt: number;
  updatedAt: number;
  lockedUntil: number;
  error?: string;
};
export type ActiveLead = { id: number; name: string; agent: string; stage: string; source: string; events: number; types: [string, number][]; lastContact: number | null };
export type Regular = { id: number; name: string; heldBy: string; stage: string; source: string; activeDays: number; events: number; types: [string, number][]; lastActive: string; lastContact: number | null };
export const REGULAR_MIN_DAYS = 3;
export type ActivityReport = { generatedAt: number; eventsRead: number; regulars: Regular[]; regularsChecked: number; regularsTruncated: boolean; days: { date: string; events: number; activeLeads: number; leads: ActiveLead[] }[] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const getActivity = () => getJSON<ActivityReport>("activity.json");

/**
 * Read the last seven days of lead events (website visits, property views, inquiries and so on)
 * and rank each day's most active leads. Time-boxed and resumable, like the audit.
 */
export async function tickActivity(budgetMs: number, opts: { force?: boolean } = {}): Promise<ActivityState | { phase: "not_configured" | "locked" }> {
  if (!fubConfigured()) return { phase: "not_configured" };
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const today = torontoDate(started);

  let s = await getJSON<ActivityState>("activity-state.json");
  if (s && s.lockedUntil > started && s.phase === "scanning") return { phase: "locked" };
  if (!s || s.runId.slice(0, 10) !== today || (opts.force && s.phase !== "scanning")) {
    s = { runId: `${today}-${started}`, phase: "scanning", nextLink: "/events?limit=100", cutoff: started - DAYS * DAY, scanned: 0, pages: 0, counts: {}, startedAt: started, updatedAt: started, lockedUntil: 0 };
  }
  if (s.phase !== "scanning") return s;
  const save = async (lock: boolean) => {
    s!.updatedAt = Date.now();
    s!.lockedUntil = lock ? Date.now() + Math.max(left(), 0) + 20000 : 0;
    await putJSON("activity-state.json", s);
  };
  await save(true);

  try {
    while (s.nextLink && left() > 12000) {
      const page = await listPage<Record<string, unknown>>("events", s.nextLink);
      let fresh = 0;
      for (const e of page.items) {
        const t = toMs(e.created);
        if (!t || t < s.cutoff) continue;
        fresh++;
        const pid = Number(e.personId);
        const type = String(e.type ?? "Other");
        if (!pid || IGNORED.has(type)) continue;
        const day = torontoDate(t);
        const tally = ((s.counts[day] ??= {})[String(pid)] ??= { n: 0, types: {} });
        tally.n++;
        tally.types[type] = (tally.types[type] ?? 0) + 1;
      }
      s.scanned += fresh;
      s.pages++;
      if (s.pages === 1 && page.items.length && fresh === 0) throw new Error("Follow Up Boss returned its oldest events first, so recent activity could not be read this way.");
      // Events come newest first: a page with nothing inside the window means we have gone far enough back.
      s.nextLink = page.items.length && fresh > 0 ? page.nextLink : null;
      if (s.pages > 5000) s.nextLink = null;
      await sleep(1050); // events endpoint allows about 10 requests per 10 seconds
    }

    if (!s.nextLink) {
      const days = Object.keys(s.counts).sort().reverse().slice(0, DAYS + 1);
      const top = new Map<string, [string, Tally][]>();
      const ids = new Set<string>();
      for (const d of days) {
        const ranked = Object.entries(s.counts[d]).sort((a, b) => b[1].n - a[1].n).slice(0, TOP);
        top.set(d, ranked);
        for (const [id] of ranked) ids.add(id);
      }
      // Leads active on several different days: the "regulars".
      const perLead = new Map<string, { days: number; events: number; last: string; types: Record<string, number> }>();
      for (const d of days.slice(0, DAYS)) {
        for (const [id, tally] of Object.entries(s.counts[d])) {
          const x = perLead.get(id) ?? { days: 0, events: 0, last: d, types: {} };
          x.days++;
          x.events += tally.n;
          if (d > x.last) x.last = d;
          for (const [t, n] of Object.entries(tally.types)) x.types[t] = (x.types[t] ?? 0) + n;
          perLead.set(id, x);
        }
      }
      const regularAll = [...perLead.entries()].filter(([, x]) => x.days >= REGULAR_MIN_DAYS).sort((a, b) => b[1].days - a[1].days || b[1].events - a[1].events);
      const regularIds = regularAll.slice(0, 1500);
      for (const [id] of regularIds) ids.add(id);

      const people = new Map<string, Record<string, unknown>>();
      const all = [...ids];
      for (let i = 0; i < all.length; i += 50) {
        const res = await fub<{ people?: Record<string, unknown>[] }>(`/people?limit=100&fields=allFields&includeTrash=true&id=${all.slice(i, i + 50).join(",")}`);
        for (const p of res.people ?? []) people.set(String(p.id), p);
      }
      const lastContact = (p: Record<string, unknown> | undefined) => {
        let best: number | null = null;
        for (const f of ["lastCommunication", "lastCall", "lastText", "lastEmail", "lastSentText", "lastSentEmail", "lastOutgoingCall"]) {
          const ms = toMs(p?.[f]);
          if (ms && (!best || ms > best)) best = ms;
        }
        return best;
      };
      const settings: Settings = clampSettings((await getJSON<Partial<Settings>>("settings.json")) ?? {});
      const pondName = new Map((await getPonds().catch(() => [])).map((x) => [Number(x.id), String(x.name ?? `Pond ${x.id}`)]));
      const regulars: Regular[] = [];
      for (const [id, x] of regularIds) {
        const p = people.get(id);
        if (!p) continue;
        const agent = String(p.assignedTo ?? "").trim();
        const pondId = Number(p.assignedPondId) || 0;
        const heldBy = pondId ? `Pond: ${pondName.get(pondId) ?? pondId}` : !p.assignedUserId && !agent ? "No one" : isHoldingAccount(agent, settings) ? `Holding account: ${agent}` : "";
        if (!heldBy) continue; // a specific agent has this lead
        regulars.push({
          id: Number(id),
          name: String(p.name ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`).trim() || `Contact ${id}`,
          heldBy, stage: String(p.stage ?? ""), source: String(p.source ?? ""),
          activeDays: x.days, events: x.events, lastActive: x.last,
          types: Object.entries(x.types).sort((a, b) => b[1] - a[1]).slice(0, 4),
          lastContact: lastContact(p),
        });
      }
      const report: ActivityReport = {
        generatedAt: Date.now(),
        eventsRead: s.scanned,
        regulars: regulars.slice(0, 500),
        regularsChecked: regularIds.length,
        regularsTruncated: regularAll.length > regularIds.length,
        days: days.map((d) => ({
          date: d,
          events: Object.values(s!.counts[d]).reduce((a, b) => a + b.n, 0),
          activeLeads: Object.keys(s!.counts[d]).length,
          leads: top.get(d)!.map(([id, tally]) => {
            const p = people.get(id);
            return {
              id: Number(id),
              name: String(p?.name ?? `${p?.firstName ?? ""} ${p?.lastName ?? ""}`).trim() || `Contact ${id}`,
              agent: String(p?.assignedTo ?? ""),
              stage: String(p?.stage ?? ""),
              source: String(p?.source ?? ""),
              events: tally.n,
              types: Object.entries(tally.types).sort((a, b) => b[1] - a[1]).slice(0, 4),
              lastContact: lastContact(p),
            };
          }),
        })),
      };
      await putJSON("activity.json", report);
      s.counts = {};
      s.phase = "done";
    }
    await save(false);
  } catch (err) {
    s.phase = "error";
    s.error = String((err as Error)?.message ?? err).slice(0, 300);
    s.counts = {};
    await save(false);
  }
  return s;
}
