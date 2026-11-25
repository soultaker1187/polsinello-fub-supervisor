import { tick } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const state = await tick(240000);
  return Response.json({ phase: state.phase, count: "count" in state ? state.count : undefined });
}
