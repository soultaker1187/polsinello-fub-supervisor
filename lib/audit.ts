import { LIST_CAP, NEW_LEAD_LOOKBACK_DAYS, Settings, TZ } from "./config";

const DAY = 86400000;

/** Slim copy of a Follow Up Boss person: only what the checks need. */
export type P = {
  id: number;
  name: string;
  created: number;
  stage: string;
  source: string;
  userId: number | null;
  agent: string;
  pondId: number | null;
  emails: string[];
  phones: string[];
  lastContact: number | null;
  via: string;
};

export type Row = { id: number; name: string; agent: string; userId: number | null; stage: string; source: string; created: number; lastContact: number | null; days: number };
export type NewLead = { id: number; name: string; agent: string; userId: number | null; source: string; created: number; clockStart: number; firstResponse: number | null; minutes: number | null; status: "in_time" | "late" | "none" | "pending" };
export type AgentRow = { userId: number; name: string; assigned: number; inScope: number; neglected: number; pctNeglected: number; newLeads: number; inTime: number; late: number; none: number; medianMinutes: number | null };
export type NoteItem = { personId: number; name: string; userId: number; agent: string; reason: string; status: "planned" | "written" | "failed"; at?: number };

export type Report = {
  scanId: string;
  generatedAt: number;
  settings: Settings;
  totals: { people: number; inScope: number; neglected: number; neverContacted: number; inPonds: number; unassigned: number; noContactInfo: number; noPhone: number; noSource: number; noStage: number; duplicateGroups: number };
  stages: { name: string; count: number; inScope: boolean }[];
  agents: AgentRow[];
  neglected: Row[];
  neglectedTruncated: boolean;
  newLeads: NewLead[];
  hygiene: { noContactInfo: Row[]; unassigned: Row[]; noSource: Row[]; duplicates: { type: "email" | "phone"; people: { id: number; name: string; agent: string }[] }[] };
  notes: { mode: "preview" | "live"; planned: number; written: number; failed: number; heldBackByCaps: number; items: NoteItem[] };
  diagnostics: { fieldsSeen: string[]; contactFieldsFound: string[]; usedLastActivityFallback: boolean; seconds: number };
};

const CONTACT_FIELDS = ["lastCommunication", "lastCall", "lastOutgoingCall", "lastIncomingCall", "lastText", "lastSentText", "lastReceivedText", "lastEmail", "lastSentEmail", "lastReceivedEmail"];

export function toMs(v: unknown): number | null {
  if (!v) return null;
  if (typeof v === "number") return v > 1e11 ? v : v * 1000;
  if (typeof v === "string") {
    let s = v.trim();
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) s = s.replace(" ", "T") + "Z";
    const n = Date.parse(s);
    return Number.isNaN(n) ? null : n;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return toMs(o.date ?? o.created ?? o.dateTime ?? o.sent ?? null);
  }
  return null;
}

const normEmail = (e: string) => e.trim().toLowerCase();
const normPhone = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
};
const values = (arr: unknown): string[] =>
  Array.isArray(arr) ? arr.map((x) => (typeof x === "string" ? x : String((x as { value?: unknown })?.value ?? ""))).filter(Boolean) : [];

export type FieldStats = { fieldsSeen: Set<string>; contactFieldsFound: Set<string> };

export function slim(raw: Record<string, unknown>, stats: FieldStats): P {
  for (const k of Object.keys(raw)) stats.fieldsSeen.add(k);
  let last: number | null = null;
  for (const f of CONTACT_FIELDS) {
    if (f in raw) stats.contactFieldsFound.add(f);
    const ms = toMs(raw[f]);
    if (ms && (!last || ms > last)) last = ms;
  }
  const name = String(raw.name ?? `${raw.firstName ?? ""} ${raw.lastName ?? ""}`).trim() || "(no name)";
  return {
    id: Number(raw.id),
    name,
    created: toMs(raw.created) ?? 0,
    stage: String(raw.stage ?? "").trim(),
    source: String(raw.source ?? "").trim(),
    userId: raw.assignedUserId ? Number(raw.assignedUserId) : null,
    agent: String(raw.assignedTo ?? "").trim(),
    pondId: raw.assignedPondId ? Number(raw.assignedPondId) : null,
    emails: values(raw.emails).map(normEmail).filter((e) => e.includes("@")).slice(0, 4),
    phones: values(raw.phones).map(normPhone).filter((p) => p.length >= 10).slice(0, 4),
    lastContact: last,
    via: String(raw.createdVia ?? ""),
    // lastActivity is kept only as a fallback when the account returns no communication dates at all
    ...(toMs(raw.lastActivity) ? { lastActivity: toMs(raw.lastActivity) } : {}),
  } as P;
}

/** Hour of day (0-24, fractional) and UTC offset for a moment in Toronto. */
function torontoParts(ms: number) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return { y: p.year, m: p.month, d: p.day, hour: p.hour + p.minute / 60, offset: asUtc - Math.floor(ms / 1000) * 1000 };
}

/** When the response clock starts: at arrival during working hours, otherwise at the next start hour. */
export function clockStart(created: number, startHour: number, endHour: number): number {
  const t = torontoParts(created);
  if (t.hour >= startHour && t.hour < endHour) return created;
  const addDay = t.hour >= endHour ? 1 : 0;
  const localTarget = Date.UTC(t.y, t.m - 1, t.d + addDay, startHour, 0, 0);
  let utc = localTarget - t.offset;
  utc = localTarget - torontoParts(utc).offset; // correct across a clock change
  return utc;
}

export function torontoDate(ms: number): string {
  const t = torontoParts(ms);
  return `${t.y}-${String(t.m).padStart(2, "0")}-${String(t.d).padStart(2, "0")}`;
}

const row = (p: P, now: number): Row => ({
  id: p.id, name: p.name, agent: p.agent, userId: p.userId, stage: p.stage, source: p.source, created: p.created,
  lastContact: p.lastContact, days: Math.floor((now - (p.lastContact ?? p.created)) / DAY),
});

export function buildReport(people: P[], users: { id: number; name: string }[], settings: Settings, stats: FieldStats, scanId: string, now: number): Report {
  const fallback = stats.contactFieldsFound.size === 0;
  if (fallback) for (const p of people) p.lastContact = (p as P & { lastActivity?: number }).lastActivity ?? null;

  const excluded = new Set(settings.excludedStages.map((s) => s.toLowerCase()));
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const stageCount = new Map<string, number>();
  const agents = new Map<number, AgentRow>();
  const agent = (id: number, name: string) => {
    let a = agents.get(id);
    if (!a) agents.set(id, (a = { userId: id, name: userName.get(id) ?? name ?? `User ${id}`, assigned: 0, inScope: 0, neglected: 0, pctNeglected: 0, newLeads: 0, inTime: 0, late: 0, none: 0, medianMinutes: null }));
    return a;
  };

  const cutoff = now - settings.neglectedDays * DAY;
  const neglected: Row[] = [];
  const noContactInfo: Row[] = [];
  const unassigned: Row[] = [];
  const noSource: Row[] = [];
  const newLeads: NewLead[] = [];
  const byEmail = new Map<string, P[]>();
  const byPhone = new Map<string, P[]>();
  let inScope = 0, neverContacted = 0, inPonds = 0, noPhone = 0, noStage = 0;

  for (const p of people) {
    stageCount.set(p.stage || "(no stage)", (stageCount.get(p.stage || "(no stage)") ?? 0) + 1);
    if (p.userId) agent(p.userId, p.agent).assigned++;
    if (p.pondId) inPonds++;
    if (!p.stage) noStage++;
    if (!p.phones.length) noPhone++;
    if (!p.phones.length && !p.emails.length) noContactInfo.push(row(p, now));
    if (!p.userId && !p.pondId) unassigned.push(row(p, now));
    if (!p.source) noSource.push(row(p, now));
    for (const e of p.emails) (byEmail.get(e) ?? byEmail.set(e, []).get(e)!).push(p);
    for (const ph of p.phones) (byPhone.get(ph) ?? byPhone.set(ph, []).get(ph)!).push(p);

    const scoped = !excluded.has(p.stage.toLowerCase()) && Boolean(p.userId);
    if (scoped) {
      inScope++;
      agent(p.userId!, p.agent).inScope++;
      const last = p.lastContact ?? null;
      if ((last ?? p.created) < cutoff) {
        neglected.push(row(p, now));
        agent(p.userId!, p.agent).neglected++;
        if (!last) neverContacted++;
      }
    }
    if (p.userId && p.via !== "Import" && p.created > now - NEW_LEAD_LOOKBACK_DAYS * DAY && !excluded.has(p.stage.toLowerCase())) {
      newLeads.push({ id: p.id, name: p.name, agent: agent(p.userId, p.agent).name, userId: p.userId, source: p.source, created: p.created,
        clockStart: clockStart(p.created, settings.clockStartHour, settings.clockEndHour), firstResponse: null, minutes: null, status: "pending" });
    }
  }

  const duplicates: Report["hygiene"]["duplicates"] = [];
  const seenGroup = new Set<string>();
  for (const [type, map] of [["email", byEmail], ["phone", byPhone]] as const) {
    for (const group of map.values()) {
      const ids = [...new Set(group.map((g) => g.id))];
      if (ids.length < 2) continue;
      const key = ids.sort((a, b) => a - b).join("-");
      if (seenGroup.has(key)) continue;
      seenGroup.add(key);
      const uniq = ids.map((id) => group.find((g) => g.id === id)!);
      duplicates.push({ type, people: uniq.map((g) => ({ id: g.id, name: g.name, agent: g.agent })) });
    }
  }

  // Freshest slips first: the leads that most recently crossed the line are the most recoverable.
  neglected.sort((a, b) => (b.lastContact ?? b.created) - (a.lastContact ?? a.created));
  for (const a of agents.values()) a.pctNeglected = a.inScope ? Math.round((a.neglected / a.inScope) * 100) : 0;

  return {
    scanId, generatedAt: now, settings,
    totals: { people: people.length, inScope, neglected: neglected.length, neverContacted, inPonds, unassigned: unassigned.length, noContactInfo: noContactInfo.length, noPhone, noSource: noSource.length, noStage, duplicateGroups: duplicates.length },
    stages: [...stageCount.entries()].map(([name, count]) => ({ name, count, inScope: !excluded.has(name.toLowerCase()) })).sort((a, b) => b.count - a.count),
    agents: [...agents.values()].sort((a, b) => b.neglected - a.neglected),
    neglected: neglected.slice(0, LIST_CAP),
    neglectedTruncated: neglected.length > LIST_CAP,
    newLeads: newLeads.sort((a, b) => b.created - a.created),
    hygiene: { noContactInfo: noContactInfo.slice(0, 2000), unassigned: unassigned.slice(0, 2000), noSource: noSource.slice(0, 2000), duplicates: duplicates.slice(0, 2000) },
    notes: { mode: settings.mode, planned: 0, written: 0, failed: 0, heldBackByCaps: 0, items: [] },
    diagnostics: { fieldsSeen: [...stats.fieldsSeen].sort(), contactFieldsFound: [...stats.contactFieldsFound].sort(), usedLastActivityFallback: fallback, seconds: 0 },
  };
}

/** Grade one new lead once its first outgoing call/text time is known (null = none yet). */
export function gradeLead(lead: NewLead, firstResponse: number | null, settings: Settings, now: number): void {
  const limit = settings.responseMinutes * 60000;
  lead.firstResponse = firstResponse;
  if (firstResponse !== null) {
    const waited = Math.max(0, firstResponse - lead.clockStart);
    lead.minutes = Math.round(waited / 60000);
    lead.status = waited <= limit ? "in_time" : "late";
  } else {
    lead.minutes = null;
    lead.status = now - lead.clockStart > limit ? "none" : "pending";
  }
}

export function scoreResponses(report: Report): void {
  const mins = new Map<number, number[]>();
  for (const a of report.agents) { a.newLeads = a.inTime = a.late = a.none = 0; a.medianMinutes = null; }
  const byId = new Map(report.agents.map((a) => [a.userId, a]));
  for (const l of report.newLeads) {
    const a = l.userId ? byId.get(l.userId) : undefined;
    if (!a || l.status === "pending") continue;
    a.newLeads++;
    if (l.status === "in_time") a.inTime++;
    else if (l.status === "late") a.late++;
    else a.none++;
    if (l.minutes !== null) (mins.get(a.userId) ?? mins.set(a.userId, []).get(a.userId)!).push(l.minutes);
  }
  for (const [id, arr] of mins) {
    arr.sort((x, y) => x - y);
    byId.get(id)!.medianMinutes = arr.length % 2 ? arr[(arr.length - 1) / 2] : Math.round((arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2);
  }
}

export type Ledger = Record<string, { at: number; reason: string }>;

/** Decide which leads get a "Needs A Call" note this run, honouring the repeat window and the caps. */
export function planNotes(report: Report, ledger: Ledger, settings: Settings, now: number): { items: NoteItem[]; heldBack: number } {
  const repeat = settings.repeatDays * DAY;
  const perAgent = new Map<number, number>();
  const items: NoteItem[] = [];
  let heldBack = 0;
  const consider = (personId: number, name: string, userId: number | null, agentName: string, reason: string) => {
    if (!userId) return;
    const prev = ledger[String(personId)];
    if (prev && now - prev.at < repeat) return;
    if (items.some((i) => i.personId === personId)) return;
    const n = perAgent.get(userId) ?? 0;
    if (n >= settings.maxNotesPerAgent || items.length >= settings.maxNotesPerRun) { heldBack++; return; }
    perAgent.set(userId, n + 1);
    items.push({ personId, name, userId, agent: agentName, reason, status: "planned" });
  };
  for (const l of report.newLeads) if (l.status === "none") consider(l.id, l.name, l.userId, l.agent, `new lead, no ${settings.responseCounts === "call" ? "call" : "call or text"} yet`);
  for (const r of report.neglected) consider(r.id, r.name, r.userId, r.agent, r.lastContact ? `no contact in ${r.days} days` : `no contact on record in the ${r.days} days since this lead arrived`);
  return { items, heldBack };
}

export function pruneLedger(ledger: Ledger, now: number): Ledger {
  const out: Ledger = {};
  for (const [k, v] of Object.entries(ledger)) if (now - v.at < 90 * DAY) out[k] = v;
  return out;
}
