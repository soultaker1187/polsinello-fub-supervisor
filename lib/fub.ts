import { mockFetch } from "./mock";

const BASE = "https://api.followupboss.com/v1";

export class FubError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const fubConfigured = () => Boolean(process.env.FUB_API_KEY) || process.env.FUB_MOCK === "1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function headers(): Record<string, string> {
  const key = process.env.FUB_API_KEY ?? "";
  const h: Record<string, string> = {
    Authorization: "Basic " + Buffer.from(`${key}:`).toString("base64"),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // Optional: a registered system raises the rate limit. See docs.followupboss.com/reference/identification
  if (process.env.FUB_SYSTEM && process.env.FUB_SYSTEM_KEY) {
    h["X-System"] = process.env.FUB_SYSTEM;
    h["X-System-Key"] = process.env.FUB_SYSTEM_KEY;
  }
  return h;
}

/** One request to Follow Up Boss, honouring Retry-After on 429. Only api.followupboss.com is ever called. */
export async function fub<T = unknown>(pathOrUrl: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const url = pathOrUrl.startsWith("http") ? pathOrUrl : BASE + pathOrUrl;
  if (!url.startsWith(BASE + "/")) throw new FubError(0, "Refusing to call a non-Follow Up Boss URL");
  if (process.env.FUB_MOCK === "1") return mockFetch(url, init) as T;

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: init?.method ?? "GET",
      headers: headers(),
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    if (res.status === 429 && attempt < 5) {
      const wait = Math.min(30, Number(res.headers.get("Retry-After")) || 10);
      await sleep(wait * 1000);
      continue;
    }
    if (res.status >= 500 && attempt < 2) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      throw new FubError(res.status, `Follow Up Boss ${res.status}: ${text}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }
}

type Page<K extends string, T> = { _metadata?: { total?: number; nextLink?: string | null } } & Record<K, T[]>;

export async function listPage<T>(key: string, pathOrUrl: string): Promise<{ items: T[]; nextLink: string | null; total: number | null }> {
  const data = await fub<Page<string, T>>(pathOrUrl);
  return {
    items: (data[key] as T[]) ?? [],
    nextLink: data._metadata?.nextLink || null,
    total: data._metadata?.total ?? null,
  };
}

export async function listAll<T>(key: string, path: string, maxPages = 20): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;
  for (let i = 0; next && i < maxPages; i++) {
    const page: { items: T[]; nextLink: string | null } = await listPage<T>(key, next);
    out.push(...page.items);
    next = page.nextLink;
  }
  return out;
}

export type FubUser = { id: number; name: string; email?: string; role?: string; status?: string };
export type FubCall = { id: number; created: string; personId: number; userId?: number; isIncoming?: boolean; duration?: number };
export type FubText = { id: number; created: string; sent?: string; personId: number; userId?: number; isIncoming?: boolean; actionPlanId?: number | null };

export const getUsers = () => listAll<FubUser>("users", "/users?limit=100");
export const getCalls = (personId: number) => listAll<FubCall>("calls", `/calls?personId=${personId}&limit=100`, 2);
export const getTexts = (personId: number) => listAll<FubText>("textmessages", `/textMessages?personId=${personId}&limit=100`, 2);

export type FubPond = { id: number; name: string };
export const getPonds = () => listAll<FubPond>("ponds", "/ponds?limit=100");

export async function moveToPond(personId: number, pondId: number): Promise<void> {
  await fub(`/people/${personId}`, { method: "PUT", body: { assignedPondId: pondId } });
}

export async function addNote(personId: number, subject: string, body: string): Promise<void> {
  await fub("/notes", { method: "POST", body: { personId, subject, body, isHtml: false } });
}

export async function addCallTask(personId: number, assignedUserId: number, name: string, dueDate: string): Promise<void> {
  await fub("/tasks", { method: "POST", body: { personId, assignedUserId, name, type: "Call", dueDate } });
}
