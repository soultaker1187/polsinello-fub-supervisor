export const TZ = "America/Toronto";

export type Settings = {
  /** Days without a call, text or email before a lead counts as neglected. */
  neglectedDays: number;
  /** Minutes a brand-new lead may wait before it is flagged. */
  responseMinutes: number;
  /** What counts as a first response to a new lead. */
  responseCounts: "call" | "call_or_text";
  /** New leads arriving outside these hours (Toronto time) are timed from the next start hour. */
  clockStartHour: number;
  clockEndHour: number;
  /** Stage names left out of the neglected check (case-insensitive). */
  excludedStages: string[];
  /** preview = nothing is written to Follow Up Boss; live = notes are written. */
  mode: "preview" | "live";
  /** Also create a Call task for the agent, so it shows on their task list. */
  alsoCreateTask: boolean;
  /** Days before the same lead can be flagged again. */
  repeatDays: number;
  maxNotesPerRun: number;
  maxNotesPerAgent: number;
  /** Days without contact before a lead is "at risk" (must be below neglectedDays). */
  atRiskDays: number;
  /** Sweeps: move long-neglected leads to a pond. preview = list only; live = move them. */
  sweepMode: "off" | "preview" | "live";
  sweepAfterDays: number;
  sweepPondId: number | null;
  maxSweepsPerRun: number;
  /** Accountability standard used to flag agents on the scorecard. */
  standardMaxNeglectedPct: number;
  standardMinResponsePct: number;
  standardMinNewLeads: number;
  /** Accounts that hold leads nobody is working (besides any user whose name ends with an asterisk). */
  holdingAccounts: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  neglectedDays: 14,
  responseMinutes: 5,
  responseCounts: "call_or_text",
  clockStartHour: 8,
  clockEndHour: 21,
  excludedStages: ["Closed", "Past Client", "Sphere", "Trash"],
  mode: "preview",
  alsoCreateTask: false,
  repeatDays: 7,
  maxNotesPerRun: 200,
  maxNotesPerAgent: 15,
  atRiskDays: 10,
  sweepMode: "preview",
  sweepAfterDays: 30,
  sweepPondId: null,
  maxSweepsPerRun: 50,
  standardMaxNeglectedPct: 50,
  standardMinResponsePct: 50,
  standardMinNewLeads: 3,
  holdingAccounts: [],
};

export const NOTE_SUBJECT = "Needs A Call";
export const NEW_LEAD_LOOKBACK_DAYS = 7;
export const LIST_CAP = 20000;

/** True when a lead's "agent" is really a holding account: a name ending in * or one listed in Settings. */
export function isHoldingAccount(name: string, settings: Pick<Settings, "holdingAccounts">): boolean {
  const n = name.trim().toLowerCase();
  return Boolean(n) && (n.endsWith("*") || settings.holdingAccounts.some((h) => h.toLowerCase() === n));
}

export function fubPersonUrl(id: number): string {
  return `https://app.followupboss.com/2/people/view/${id}`;
}

export function clampSettings(input: Partial<Settings>): Settings {
  const s = { ...DEFAULT_SETTINGS, ...input };
  const int = (v: unknown, lo: number, hi: number, d: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const neglectedDays = int(s.neglectedDays, 1, 365, 14);
  const pond = Math.round(Number(s.sweepPondId));
  return {
    atRiskDays: Math.min(Math.max(neglectedDays - 1, 1), int(s.atRiskDays, 1, 364, 10)),
    sweepMode: s.sweepMode === "live" ? "live" : s.sweepMode === "off" ? "off" : "preview",
    sweepAfterDays: Math.max(neglectedDays, int(s.sweepAfterDays, 1, 730, 30)),
    sweepPondId: Number.isFinite(pond) && pond > 0 ? pond : null,
    maxSweepsPerRun: int(s.maxSweepsPerRun, 1, 500, 50),
    standardMaxNeglectedPct: int(s.standardMaxNeglectedPct, 1, 100, 50),
    standardMinResponsePct: int(s.standardMinResponsePct, 0, 100, 50),
    standardMinNewLeads: int(s.standardMinNewLeads, 1, 100, 3),
    holdingAccounts: Array.isArray(s.holdingAccounts) ? s.holdingAccounts.map((x) => String(x).trim()).filter(Boolean).slice(0, 50) : [],
    neglectedDays,
    responseMinutes: int(s.responseMinutes, 1, 1440, 5),
    responseCounts: s.responseCounts === "call" ? "call" : "call_or_text",
    clockStartHour: int(s.clockStartHour, 0, 23, 8),
    clockEndHour: int(s.clockEndHour, 1, 24, 21),
    excludedStages: Array.isArray(s.excludedStages)
      ? s.excludedStages.map((x) => String(x).trim()).filter(Boolean).slice(0, 100)
      : DEFAULT_SETTINGS.excludedStages,
    mode: s.mode === "live" ? "live" : "preview",
    alsoCreateTask: Boolean(s.alsoCreateTask),
    repeatDays: int(s.repeatDays, 1, 90, 7),
    maxNotesPerRun: int(s.maxNotesPerRun, 1, 1000, 200),
    maxNotesPerAgent: int(s.maxNotesPerAgent, 1, 200, 15),
  };
}
