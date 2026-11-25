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
};

export const NOTE_SUBJECT = "Needs A Call";
export const NEW_LEAD_LOOKBACK_DAYS = 7;
export const LIST_CAP = 20000;

export function fubPersonUrl(id: number): string {
  return `https://app.followupboss.com/2/people/view/${id}`;
}

export function clampSettings(input: Partial<Settings>): Settings {
  const s = { ...DEFAULT_SETTINGS, ...input };
  const int = (v: unknown, lo: number, hi: number, d: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  return {
    neglectedDays: int(s.neglectedDays, 1, 365, 14),
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
