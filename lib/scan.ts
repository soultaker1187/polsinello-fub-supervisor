import { clampSettings, NOTE_SUBJECT, Settings } from "./config";
import { deletePrefix, getJSON, putJSON } from "./store";
import { addCallTask, addNote, fubConfigured, getCalls, getTexts, getUsers, listPage } from "./fub";
import { buildReport, clockStart, gradeLead, Ledger, NewLead, NoteItem, P, planNotes, pruneLedger, Report, scoreResponses, slim, toMs, torontoDate } from "./audit";

export type ScanState = {
  scanId: string;
  phase: "scanning" | "grading" | "notifying" | "done" | "error";
  nextLink: string | null;
  parts: number;
  count: number;
  total: number | null;
  startedAt: number;
  updatedAt: number;
  lockedUntil: number;
  gradeIdx: number;
  noteIdx: number;
  fieldsSeen: string[];
  contactFieldsFound: string[];
  error?: string;
};

export type Alerts = { items: (NoteItem & { at: number })[]; cleared: number[] };
export type HistoryEntry = { date: string; people: number; inScope: number; neglected: number; newLeads: number; inTime: number };

const GRADE_CAP = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const getSettings = async (): Promise<Settings> => clampSettings((await getJSON<Partial<Settings>>("settings.json")) ?? {});
export const getReport = () => getJSON<Report>("report/latest.json");
export const getState = () => getJSON<ScanState>("state.json");
export const getAlerts = async (): Promise<Alerts> => (await getJSON<Alerts>("alerts.json")) ?? { items: [], cleared: [] };
export const getHistory = async (): Promise<HistoryEntry[]> => (await getJSON<HistoryEntry[]>("history.json")) ?? [];

function noteBody(item: NoteItem): string {
  return `${NOTE_SUBJECT}: ${item.reason}. Assigned to ${item.agent}. (Database Supervisor)`;
}

/** First outgoing call (and, if allowed, first personal outgoing text) for a lead; null when there is none. */
export async function firstResponse(personId: number, created: number, settings: Settings): Promise<number | null> {
  const times: number[] = [];
  for (const c of await getCalls(personId)) {
    const t = toMs(c.created);
    if (c.isIncoming === false && t && t >= created - 60000) times.push(t);
  }
  if (settings.responseCounts === "call_or_text") {
    for (const m of await getTexts(personId)) {
      const t = toMs(m.sent ?? m.created);
      // Texts sent by an action plan are automated, so they do not count as a response.
      if (m.isIncoming === false && !m.actionPlanId && t && t >= created - 60000) times.push(t);
    }
  }
  return times.length ? Math.min(...times) : null;
}

async function writeNote(item: NoteItem, settings: Settings, now: number): Promise<void> {
  try {
    await addNote(item.personId, NOTE_SUBJECT, noteBody(item));
    if (settings.alsoCreateTask) await addCallTask(item.personId, item.userId, NOTE_SUBJECT, torontoDate(now));
    item.status = "written";
  } catch {
    item.status = "failed";
  }
  item.at = now;
}

/**
 * Advance the nightly audit by one time-boxed step. Safe to call repeatedly:
 * it resumes where it stopped and does nothing once today's audit is done.
 */
export async function tick(budgetMs: number, opts: { force?: boolean } = {}): Promise<ScanState | { phase: "not_configured" } | { phase: "locked" }> {
  if (!fubConfigured()) return { phase: "not_configured" };
  const started = Date.now();
  const left = () => budgetMs - (Date.now() - started);
  const today = torontoDate(started);

  let state = await getState();
  if (state && state.lockedUntil > started && !["done", "error"].includes(state.phase)) return { phase: "locked" };
  const stale = !state || state.scanId.slice(0, 10) !== today;
  if (stale || (opts.force && ["done", "error"].includes(state!.phase))) {
    const scanId = `${today}-${started}`;
    state = { scanId, phase: "scanning", nextLink: "/people?limit=100&fields=allFields", parts: 0, count: 0, total: null, startedAt: started, updatedAt: started, lockedUntil: 0, gradeIdx: 0, noteIdx: 0, fieldsSeen: [], contactFieldsFound: [] };
  }
  const s = state!;
  if (s.phase === "done" || s.phase === "error") return s;
  const dir = `scan/${s.scanId}/`;
  const save = async (lock: boolean) => {
    s.updatedAt = Date.now();
    s.lockedUntil = lock ? Date.now() + Math.max(left(), 0) + 20000 : 0;
    await putJSON("state.json", s);
  };
  await save(true);

  try {
    if (s.phase === "scanning") {
      const stats = { fieldsSeen: new Set(s.fieldsSeen), contactFieldsFound: new Set(s.contactFieldsFound) };
      let buf: P[] = [];
      const flush = async () => {
        if (buf.length) await putJSON(`${dir}part-${s.parts++}.json`, buf);
        buf = [];
        s.fieldsSeen = [...stats.fieldsSeen];
        s.contactFieldsFound = [...stats.contactFieldsFound];
      };
      while (s.nextLink && left() > 15000) {
        const page = await listPage<Record<string, unknown>>("people", s.nextLink);
        for (const raw of page.items) buf.push(slim(raw, stats));
        s.count += page.items.length;
        s.total = page.total ?? s.total;
        s.nextLink = page.items.length ? page.nextLink : null;
        if (buf.length >= 20000) { await flush(); await save(true); }
      }
      await flush();
      if (!s.nextLink) {
        const people: P[] = [];
        for (let i = 0; i < s.parts; i++) people.push(...((await getJSON<P[]>(`${dir}part-${i}.json`)) ?? []));
        const settings = await getSettings();
        const users = await getUsers().catch(() => []);
        const report = buildReport(people, users, settings, { fieldsSeen: new Set(s.fieldsSeen), contactFieldsFound: new Set(s.contactFieldsFound) }, s.scanId, Date.now());
        await putJSON(`${dir}draft.json`, report);
        s.phase = "grading";
      }
      await save(true);
    }

    if (s.phase === "grading" && left() > 10000) {
      const report = (await getJSON<Report>(`${dir}draft.json`))!;
      const settings = report.settings;
      const end = Math.min(report.newLeads.length, GRADE_CAP);
      while (s.gradeIdx < end && left() > 8000) {
        const lead: NewLead = report.newLeads[s.gradeIdx];
        gradeLead(lead, await firstResponse(lead.id, lead.created, settings).catch(() => null), settings, Date.now());
        s.gradeIdx++;
      }
      if (s.gradeIdx >= end) {
        scoreResponses(report);
        const ledger = (await getJSON<Ledger>("ledger.json")) ?? {};
        const plan = planNotes(report, ledger, settings, Date.now());
        report.notes = { mode: settings.mode, planned: plan.items.length, written: 0, failed: 0, heldBackByCaps: plan.heldBack, items: plan.items };
        s.phase = "notifying";
      }
      await putJSON(`${dir}draft.json`, report);
      await save(true);
    }

    if (s.phase === "notifying" && left() > 8000) {
      const report = (await getJSON<Report>(`${dir}draft.json`))!;
      // Re-read the switch at write time, so turning the supervisor back to preview stops notes at once.
      const live = (await getSettings()).mode === "live" && report.settings.mode === "live";
      if (live) {
        const ledger = (await getJSON<Ledger>("ledger.json")) ?? {};
        while (s.noteIdx < report.notes.items.length && left() > 6000) {
          const item = report.notes.items[s.noteIdx];
          await writeNote(item, report.settings, Date.now());
          if (item.status === "written") { report.notes.written++; ledger[String(item.personId)] = { at: Date.now(), reason: item.reason }; }
          else report.notes.failed++;
          s.noteIdx++;
          await sleep(1100); // Follow Up Boss allows 10 note requests per 10 seconds
        }
        await putJSON("ledger.json", pruneLedger(ledger, Date.now()));
      } else {
        report.notes.mode = "preview";
        s.noteIdx = report.notes.items.length;
      }
      if (s.noteIdx >= report.notes.items.length) {
        report.generatedAt = Date.now();
        report.diagnostics.seconds = Math.round((Date.now() - s.startedAt) / 1000);
        await putJSON("report/latest.json", report);
        const graded = report.newLeads.filter((l) => l.status !== "pending");
        const history = (await getHistory()).filter((h) => h.date !== today);
        history.push({ date: today, people: report.totals.people, inScope: report.totals.inScope, neglected: report.totals.neglected, newLeads: graded.length, inTime: graded.filter((l) => l.status === "in_time").length });
        await putJSON("history.json", history.slice(-120));
        await deletePrefix(dir);
        s.phase = "done";
      } else {
        await putJSON(`${dir}draft.json`, report);
      }
    }
    await save(false);
  } catch (err) {
    s.phase = "error";
    s.error = String((err as Error)?.message ?? err).slice(0, 300);
    await save(false);
  }
  return s;
}

/** Every five minutes: flag brand-new leads that have waited past the response standard. */
export async function checkNewLeads(): Promise<{ checked: number; flagged: number; mode: string } | { phase: "not_configured" }> {
  if (!fubConfigured()) return { phase: "not_configured" };
  const now = Date.now();
  const settings = await getSettings();
  const excluded = new Set(settings.excludedStages.map((x) => x.toLowerCase()));
  const alerts = await getAlerts();
  const known = new Set<number>([...alerts.items.map((i) => i.personId), ...alerts.cleared]);
  const stats = { fieldsSeen: new Set<string>(), contactFieldsFound: new Set<string>() };
  const page = await listPage<Record<string, unknown>>("people", "/people?limit=50&fields=allFields");
  const limit = settings.responseMinutes * 60000;
  let checked = 0, flagged = 0, changed = false;
  const ledger = settings.mode === "live" ? (await getJSON<Ledger>("ledger.json")) ?? {} : {};

  for (const raw of page.items) {
    const p = slim(raw, stats);
    if (!p.userId || p.via === "Import" || excluded.has(p.stage.toLowerCase()) || known.has(p.id)) continue;
    const clock = clockStart(p.created, settings.clockStartHour, settings.clockEndHour);
    const waited = now - clock;
    if (waited < limit || now - p.created > 12 * 3600000) continue;
    checked++;
    const first = await firstResponse(p.id, p.created, settings).catch(() => undefined);
    if (first === undefined) continue; // could not check; try again next time
    changed = true;
    if (first !== null) { alerts.cleared.push(p.id); continue; }
    const item: NoteItem & { at: number } = { personId: p.id, name: p.name, userId: p.userId, agent: p.agent, reason: `new lead, no ${settings.responseCounts === "call" ? "call" : "call or text"} within ${settings.responseMinutes} minutes`, status: "planned", at: now };
    if (settings.mode === "live") {
      await writeNote(item, settings, now);
      if (item.status === "written") ledger[String(p.id)] = { at: now, reason: item.reason };
      await sleep(1100);
    }
    alerts.items.unshift(item);
    flagged++;
  }
  if (changed) {
    alerts.items = alerts.items.slice(0, 300);
    alerts.cleared = alerts.cleared.slice(-600);
    await putJSON("alerts.json", alerts);
    if (settings.mode === "live" && flagged) await putJSON("ledger.json", ledger);
  }
  return { checked, flagged, mode: settings.mode };
}
