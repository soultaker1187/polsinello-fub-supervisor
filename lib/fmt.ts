import { TZ } from "./config";

export const fmtDate = (ms: number | null | undefined) =>
  ms ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "short", day: "numeric" }).format(new Date(ms)) : "Never";
export const fmtDateTime = (ms: number | null | undefined) =>
  ms ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(ms)) : "Never";
export const num = (n: number) => new Intl.NumberFormat("en-CA").format(n);
export const fmtMinutes = (m: number | null) => (m === null ? "No response" : m < 60 ? `${m} min` : m < 1440 ? `${(m / 60).toFixed(1)} hr` : `${(m / 1440).toFixed(1)} days`);
