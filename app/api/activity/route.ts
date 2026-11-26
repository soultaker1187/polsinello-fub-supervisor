import { tickActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manual "Refresh activity" from the dashboard. The middleware has already checked the session.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const s = await tickActivity(40000, { force: Boolean(body.force) });
  return Response.json({ phase: s.phase, count: "scanned" in s ? s.scanned : undefined, error: "error" in s ? s.error : undefined });
}
