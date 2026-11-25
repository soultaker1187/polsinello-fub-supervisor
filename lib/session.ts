/** Signed session cookie, using Web Crypto so it works in middleware and in route handlers. */
export const COOKIE = "sup_session";
const enc = new TextEncoder();

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const authConfigured = () => Boolean(process.env.SESSION_SECRET && process.env.DASHBOARD_PASSWORD);

export async function makeSession(days = 14): Promise<{ value: string; maxAge: number }> {
  const exp = Date.now() + days * 86400000;
  return { value: `${exp}.${await hmac(process.env.SESSION_SECRET!, `session:${exp}`)}`, maxAge: days * 86400 };
}

export async function validSession(value: string | undefined): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !value) return false;
  const [exp, sig] = value.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, await hmac(secret, `session:${exp}`));
}

export async function passwordMatches(input: string): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  const real = process.env.DASHBOARD_PASSWORD;
  if (!secret || !real) return false;
  return safeEqual(await hmac(secret, `pw:${input}`), await hmac(secret, `pw:${real}`));
}
