import { NextResponse } from "next/server";
import { authConfigured, COOKIE, makeSession, passwordMatches } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");
  const back = (q: string) => NextResponse.redirect(new URL(`/login?${q}`, req.url), 303);
  if (!authConfigured()) return back("e=setup");
  if (!(await passwordMatches(password))) {
    await new Promise((r) => setTimeout(r, 900));
    return back("e=1");
  }
  const s = await makeSession();
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(COOKIE, s.value, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: s.maxAge });
  return res;
}
