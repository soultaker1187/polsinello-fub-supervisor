import { tick } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manual "Run audit now" from the dashboard. The middleware has already checked the session.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { force?: boolean };
  const state = await tick(40000, { force: Boolean(body.force) });
  return Response.json(state);
}
